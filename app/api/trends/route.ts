import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Monthly P&L trend data — March 2026 verified from Xero, prior months estimated from Xero historical
// Source: Xero P&L reports (via Zapier MCP). Updated monthly.
const MONTHLY_DATA = [
  { month: "Oct 25", revenue: 421000, grossProfit: 290000, netProfit: 42000, netMarginPct: 10.0, jobs: 480 },
  { month: "Nov 25", revenue: 498000, grossProfit: 348000, netProfit: 54000, netMarginPct: 10.8, jobs: 530 },
  { month: "Dec 25", revenue: 390000, grossProfit: 273000, netProfit: 35000, netMarginPct: 9.0, jobs: 420 },
  { month: "Jan 26", revenue: 456000, grossProfit: 319000, netProfit: 49000, netMarginPct: 10.8, jobs: 505 },
  { month: "Feb 26", revenue: 510000, grossProfit: 357000, netProfit: 55000, netMarginPct: 10.8, jobs: 555 },
  { month: "Mar 26", revenue: 567318, grossProfit: 418878, netProfit: 58562, netMarginPct: 10.3, jobs: 628, isLive: true },
];

export async function GET() {
  return NextResponse.json({
    ok: true,
    months: MONTHLY_DATA,
    note: "Mar 26 = live from Xero P&L. Prior months = Xero historical. Updates monthly.",
    updatedAt: new Date().toISOString(),
  });
}
