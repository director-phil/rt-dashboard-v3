import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const XERO_TENANT_ID = "854c7ae0-43b7-415d-85b3-728a9a3da702";

async function callZapierMCP(toolName: string, toolArgs: Record<string, unknown>) {
  const mcpUrl = process.env.ZAPIER_MCP_URL;
  if (!mcpUrl) throw new Error("ZAPIER_MCP_URL not configured");

  const args = { ...toolArgs };
  if (!args.instructions) args.instructions = `Call ${toolName}`;
  if (args.headers && typeof args.headers === "object") {
    args.headers = Object.entries(args.headers as Record<string, string>)
      .map(([k, v]) => `${k}: ${v}`).join("\n");
  }

  const res = await fetch(mcpUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: args } }),
    cache: "no-store",
  });

  const rawText = await res.text();
  if (!res.ok) throw new Error(`Zapier MCP error ${res.status}: ${rawText.slice(0, 300)}`);

  let jsonStr = rawText;
  if (rawText.startsWith("event:") || rawText.startsWith("data:") || rawText.includes("\ndata:")) {
    const lines = rawText.split("\n").filter(l => l.startsWith("data:"));
    jsonStr = lines[lines.length - 1]?.replace(/^data:\s*/, "") || "{}";
  }
  return JSON.parse(jsonStr);
}

function parseZapierBody(result: Record<string, unknown>): Record<string, unknown> {
  const content = (result?.result as Record<string, unknown>)?.content || result?.content || [];
  const textBlock = (content as Record<string, unknown>[]).find(c => c.type === "text");
  if (!textBlock?.text) return {};
  const outer = JSON.parse(textBlock.text as string) as Record<string, unknown>;
  const results = (outer?.results as Record<string, unknown>[]) || [];
  const body = (results[0]?.response as Record<string, unknown>)?.body;
  if (!body) return {};
  return typeof body === "string" ? JSON.parse(body) : body as Record<string, unknown>;
}

const parseNum = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return isNaN(n) ? 0 : n;
};

export async function GET(_req: NextRequest) {
  try {
    const now = new Date();
    const fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const toDate = now.toISOString().split("T")[0];

    // Use P&L report — fast single call, structured data
    const result = await callZapierMCP("xero_api_request_beta", {
      instructions: `Get profit and loss report for ${fromDate} to ${toDate}`,
      url: `https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?fromDate=${fromDate}&toDate=${toDate}`,
      method: "GET",
      headers: { "Xero-tenant-id": XERO_TENANT_ID, Accept: "application/json" },
    });

    const xeroData = parseZapierBody(result);
    const reports = (xeroData.Reports || []) as Record<string, unknown>[];
    const report = reports[0] || {};
    const rows = (report.Rows || []) as Record<string, unknown>[];

    // Parse P&L rows into structured sections
    const sections: Record<string, { total: number; items: { name: string; amount: number }[] }> = {};
    let currentSection = "";

    for (const row of rows) {
      const rowType = String(row.RowType || "");
      const title = String(row.Title || "");

      if (rowType === "Section" && title) {
        currentSection = title;
        sections[currentSection] = { total: 0, items: [] };
      }

      const subRows = (row.Rows || []) as Record<string, unknown>[];
      for (const sub of subRows) {
        const cells = (sub.Cells || []) as Record<string, unknown>[];
        const name = String(cells[0]?.Value || "");
        const amount = parseNum(cells[1]?.Value);
        if (!name) continue;

        if (name.startsWith("Total ")) {
          if (sections[currentSection]) sections[currentSection].total = amount;
        } else if (sections[currentSection]) {
          sections[currentSection].items.push({ name, amount });
        }
      }
    }

    const income = sections["Income"]?.total || 0;
    const cogs = sections["Less Cost of Sales"]?.total || 0;
    const grossProfit = sections["Gross Profit"] ? (sections["Gross Profit"]?.items[0]?.amount || income - cogs) : income - cogs;
    const opExpenses = sections["Less Operating Expenses"] || { total: 0, items: [] };
    const netProfit = grossProfit - opExpenses.total;

    return NextResponse.json({
      ok: true,
      period: `${fromDate} to ${toDate}`,
      income: Math.round(income),
      cogs: Math.round(cogs),
      grossProfit: Math.round(grossProfit),
      grossMarginPct: income > 0 ? Math.round((grossProfit / income) * 1000) / 10 : 0,
      operatingExpenses: Math.round(opExpenses.total),
      netProfit: Math.round(netProfit),
      netMarginPct: income > 0 ? Math.round((netProfit / income) * 1000) / 10 : 0,
      expenseBreakdown: opExpenses.items
        .sort((a, b) => b.amount - a.amount)
        .map(e => ({ name: e.name, amount: Math.round(e.amount) })),
      updatedAt: new Date().toISOString(),
      source: "Xero P&L via Zapier",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, updatedAt: new Date().toISOString() }, { status: 500 });
  }
}
