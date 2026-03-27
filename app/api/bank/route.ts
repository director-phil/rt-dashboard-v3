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
    // Use Balance Sheet to get real bank balances (Accounts endpoint doesn't include balance)
    const today = new Date().toISOString().split("T")[0];
    const result = await callZapierMCP("xero_api_request_beta", {
      instructions: "Get balance sheet to find current bank account balances",
      url: `https://api.xero.com/api.xro/2.0/Reports/BalanceSheet?date=${today}`,
      method: "GET",
      headers: { "Xero-tenant-id": XERO_TENANT_ID, Accept: "application/json" },
    });

    const xeroData = parseZapierBody(result);
    const reports = (xeroData.Reports || []) as Record<string, unknown>[];
    const report = reports[0] || {};
    const rows = (report.Rows || []) as Record<string, unknown>[];

    // Extract bank section
    const bankAccounts: { name: string; balance: number }[] = [];
    let inBankSection = false;
    let totalBank = 0;

    for (const section of rows) {
      const title = String(section.Title || "");
      if (title === "Bank") inBankSection = true;
      else if (title && title !== "Bank" && inBankSection) inBankSection = false;

      if (inBankSection) {
        const subRows = (section.Rows || []) as Record<string, unknown>[];
        for (const row of subRows) {
          const cells = (row.Cells || []) as Record<string, unknown>[];
          if (cells.length < 2) continue;
          const name = String(cells[0]?.Value || "");
          const balance = parseNum(cells[1]?.Value);
          if (name && name !== "Total Bank" && !name.startsWith("Total")) {
            bankAccounts.push({ name, balance });
          }
          if (name === "Total Bank") totalBank = balance;
        }
      }
    }

    // Also extract AR and key liabilities for context
    let ar = 0;
    let ap = 0;
    for (const section of rows) {
      const subRows = (section.Rows || []) as Record<string, unknown>[];
      for (const row of subRows) {
        const cells = (row.Cells || []) as Record<string, unknown>[];
        const name = String(cells[0]?.Value || "");
        const val = parseNum(cells[1]?.Value);
        if (name === "Accounts Receivable") ar = val;
        if (name === "Accounts Payable") ap = val;
      }
    }

    return NextResponse.json({
      ok: true,
      bankAccounts,
      totalBank: totalBank || bankAccounts.reduce((s, a) => s + a.balance, 0),
      ar,
      ap,
      netCash: (totalBank || bankAccounts.reduce((s, a) => s + a.balance, 0)) - ap,
      updatedAt: new Date().toISOString(),
      source: "Xero Balance Sheet via Zapier",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, bankAccounts: [], updatedAt: new Date().toISOString() }, { status: 500 });
  }
}
