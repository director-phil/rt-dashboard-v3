import { NextRequest, NextResponse } from "next/server";
import { stFetchAll } from "@/app/lib/st-fetch-all";
import { getDateRange, parseTrade } from "@/app/lib/date-range";

export const dynamic = "force-dynamic";

function normalizeTrade(buName: string): string {
  const n = buName.toLowerCase();
  if (n.includes("electrical")) return "electrical";
  if (n.includes("hvac") || n.includes("air") || n.includes("ac")) return "hvac";
  if (n.includes("solar") || n.includes("battery")) return "solar";
  if (n.includes("plumb")) return "plumbing";
  return "other";
}

async function fetchRevenue(from: string, to: string, tradeFilter: string | null, staffFilter: string | null) {
  const params: Record<string, string> = {
    createdOnOrAfter: from,
    createdBefore: to,
    active: "True",
    pageSize: "500",
  };

  const invoices = await stFetchAll(`/accounting/v2/tenant/${process.env.ST_TENANT_ID}/invoices`, params);

  let filtered = invoices as Record<string, unknown>[];

  // Apply trade filter via business unit
  if (tradeFilter) {
    filtered = filtered.filter(inv => {
      const bu = ((inv.businessUnit as Record<string, unknown>)?.name as string) || "";
      return normalizeTrade(bu) === tradeFilter;
    });
  }

  // Apply staff filter
  if (staffFilter && staffFilter !== "All Staff") {
    filtered = filtered.filter(inv => {
      const techName = (inv.technician as Record<string, unknown>)?.name as string || "";
      return techName.toLowerCase().includes(staffFilter.toLowerCase().split("-").join(" "));
    });
  }

  // ST returns totals as strings sometimes — always coerce to number
  const parseNum = (v: unknown): number => {
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return isNaN(n) ? 0 : n;
  };

  const total = filtered.reduce((s, inv) => s + parseNum(inv.total), 0);
  const count = filtered.length;

  // By trade breakdown
  const byTrade: Record<string, { revenue: number; count: number }> = {};
  for (const inv of filtered) {
    const bu = ((inv.businessUnit as Record<string, unknown>)?.name as string) || "";
    const trade = normalizeTrade(bu);
    if (!byTrade[trade]) byTrade[trade] = { revenue: 0, count: 0 };
    byTrade[trade].revenue += parseNum(inv.total);
    byTrade[trade].count++;
  }

  return { total, count, byTrade };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateParam  = searchParams.get("date");
  const tradeParam = searchParams.get("trade");
  const staffParam = searchParams.get("staff");

  const range = getDateRange(dateParam);
  const trade = parseTrade(tradeParam);
  const staff = staffParam || null;

  try {
    const [current, previous] = await Promise.all([
      fetchRevenue(range.from, range.to, trade, staff),
      fetchRevenue(range.prevFrom, range.prevTo, trade, staff),
    ]);

    const change = current.total - previous.total;
    const changePct = previous.total > 0 ? (change / previous.total) * 100 : 0;

    return NextResponse.json({
      ok: true,
      period: range.label,
      current: {
        total: Math.round(current.total),
        count: current.count,
        byTrade: current.byTrade,
      },
      previous: {
        total: Math.round(previous.total),
        count: previous.count,
      },
      change: Math.round(change),
      changePct: Math.round(changePct * 10) / 10,
      updatedAt: new Date().toISOString(),
      source: "ServiceTitan",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/revenue]", msg);
    return NextResponse.json({ ok: false, error: msg, updatedAt: new Date().toISOString() }, { status: 500 });
  }
}
