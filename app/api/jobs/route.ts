import { NextRequest, NextResponse } from "next/server";
import { stFetchAll } from "@/app/lib/st-fetch-all";
import { getDateRange, parseTrade } from "@/app/lib/date-range";

export const dynamic = "force-dynamic";

const NET_SALE_FACTOR = 0.95;
const MARGIN_FLOOR = 0.15;

// Business unit ID → trade name mapping (from ST data)
const BU_TRADE_MAP: Record<number, string> = {
  115365: "AC/HVAC",
  134689640: "Electrical",
  // Additional BUs will fall through to "Other"
};

function normalizeTrade(buName: string): string {
  const n = (buName || "").toLowerCase();
  if (n.includes("electrical")) return "Electrical";
  if (n.includes("air") || n.includes("hvac") || n.includes("condition") || n.includes("ducted") || n.includes("split") || n.includes("cooling")) return "AC/HVAC";
  if (n.includes("solar") || n.includes("battery") || n.includes("panel")) return "Solar";
  if (n.includes("plumb") || n.includes("drain") || n.includes("water") || n.includes("pipe")) return "Plumbing";
  return buName || "Other";
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateParam  = searchParams.get("date");
  const tradeParam = searchParams.get("trade");
  const staffParam = searchParams.get("staff");

  const range = getDateRange(dateParam);
  const trade = parseTrade(tradeParam);
  const staffFilter = (staffParam && staffParam !== "All Staff")
    ? staffParam.toLowerCase().replace(/-/g, " ")
    : null;

  try {
    const tenantId = process.env.ST_TENANT_ID!;

    // Bulk fetch dispatch assignments for the period (efficient: 2-3 calls)
    const assignments = await stFetchAll(
      `/dispatch/v2/tenant/${tenantId}/appointment-assignments`,
      {
        modifiedOnOrAfter: range.from,
        modifiedBefore: range.to,
        pageSize: "500",
      }
    ) as Record<string, unknown>[];

    // jobId → techName
    const jobToTech: Record<string, string> = {};
    for (const a of assignments) {
      if (a.status === "Dismissed") continue;
      const jobId = String(a.jobId);
      const techName = ((a.technicianName as string) || "").trim();
      if (techName) jobToTech[jobId] = techName;
    }

    // Fetch completed jobs
    const jobs = await stFetchAll(
      `/jpm/v2/tenant/${tenantId}/jobs`,
      {
        completedOnOrAfter: range.from,
        completedBefore: range.to,
        jobStatus: "Completed",
        pageSize: "500",
      }
    ) as Record<string, unknown>[];

    // Fetch business unit names for trade mapping
    let buMap: Record<number, string> = {};
    try {
      const buData = await stFetchAll(
        `/settings/v2/tenant/${tenantId}/business-units`,
        { pageSize: "200" }
      ) as Record<string, unknown>[];
      for (const bu of buData) {
        buMap[Number(bu.id)] = String(bu.name || "");
      }
    } catch {
      // BU names optional — fall back to ID-based map
      buMap = BU_TRADE_MAP as unknown as Record<number, string>;
    }

    const parseNum = (v: unknown): number => {
      const n = typeof v === "string" ? parseFloat(v as string) : Number(v);
      return isNaN(n) ? 0 : n;
    };

    let enriched = jobs.map(job => {
      const techName = jobToTech[String(job.id)] || "Unassigned";
      const buId = Number(job.businessUnitId) || 0;
      const buName = buMap[buId] || "";
      const tradeName = normalizeTrade(buName);
      const invoiceTotal = parseNum(job.total);
      const netSale = invoiceTotal * NET_SALE_FACTOR;
      const marginPct = 100; // We don't have cost breakdown from jobs v2
      const marginFlag = invoiceTotal < 100; // Flag tiny jobs

      return {
        jobId: String(job.id),
        jobNumber: (job.jobNumber as string) || String(job.id),
        date: (job.completedOn as string) || (job.createdOn as string) || "",
        tech: techName,
        trade: tradeName,
        invoiceTotal: Math.round(invoiceTotal),
        netSale: Math.round(netSale),
        marginFlag,
      };
    });

    // Apply filters
    if (trade) {
      enriched = enriched.filter(j => j.trade.toLowerCase().replace("/", "").replace("-", "") === trade.replace("/", "").replace("-", ""));
    }
    if (staffFilter) {
      enriched = enriched.filter(j => j.tech.toLowerCase().includes(staffFilter));
    }

    enriched.sort((a, b) => b.invoiceTotal - a.invoiceTotal);

    const totals = {
      jobs: enriched.length,
      totalRevenue: enriched.reduce((s, j) => s + j.invoiceTotal, 0),
      totalNetSale: enriched.reduce((s, j) => s + j.netSale, 0),
    };

    return NextResponse.json({
      ok: true,
      period: range.label,
      jobs: enriched,
      totals,
      noData: enriched.length === 0,
      updatedAt: new Date().toISOString(),
      source: "ServiceTitan",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, updatedAt: new Date().toISOString() }, { status: 500 });
  }
}
