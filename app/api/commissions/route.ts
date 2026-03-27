import { NextRequest, NextResponse } from "next/server";
import { stFetchAll } from "@/app/lib/st-fetch-all";
import { getDateRange } from "@/app/lib/date-range";

export const dynamic = "force-dynamic";

const COMMISSION_THRESHOLD = 80000;
const NET_SALE_FACTOR = 0.95;
const COMMISSION_RATE = 0.015;

// Real field technicians only — no office/CSR/admin
const TECH_WHITELIST = new Set([
  "mitch powell", "romello moore", "curtis jeffrey", "kyle rootes",
  "zachary lingard", "zach lingard", "dean retra", "hayden sibley",
  "scott gullick", "lachlan henzell", "rusty daniells",
  "bradley tinworth mt", "bradley tinworth", "kristian calcagno",
  "alex naughton", "david white", "bailey somerville",
  "daniel hayes", "alex peisler",
]);

function isTech(name: string): boolean {
  if (!name || name.includes("@")) return false;
  return TECH_WHITELIST.has(name.trim().toLowerCase());
}

const parseNum = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v as string) : Number(v);
  return isNaN(n) ? 0 : n;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateParam = searchParams.get("date");
  const range = getDateRange(dateParam);

  try {
    const tenantId = process.env.ST_TENANT_ID!;

    // Step 1: bulk fetch dispatch assignments for period
    const assignments = await stFetchAll(
      `/dispatch/v2/tenant/${tenantId}/appointment-assignments`,
      {
        modifiedOnOrAfter: range.from,
        modifiedBefore: range.to,
        pageSize: "500",
      }
    ) as Record<string, unknown>[];

    // jobId → technicianName (field techs only)
    const jobToTech: Record<string, string> = {};
    for (const a of assignments) {
      if (a.status === "Dismissed") continue;
      const techName = ((a.technicianName as string) || "").trim();
      if (!isTech(techName)) continue;
      jobToTech[String(a.jobId)] = techName;
    }

    // Step 2: fetch completed jobs for revenue
    const jobs = await stFetchAll(
      `/jpm/v2/tenant/${tenantId}/jobs`,
      {
        completedOnOrAfter: range.from,
        completedBefore: range.to,
        jobStatus: "Completed",
        pageSize: "500",
      }
    ) as Record<string, unknown>[];

    // Step 3: aggregate per tech
    const techMap: Record<string, {
      name: string;
      revenue: number;
      jobCount: number;
    }> = {};

    for (const job of jobs) {
      const jobId = String(job.id);
      const techName = jobToTech[jobId];
      if (!techName) continue;

      const key = techName.toLowerCase();
      if (!techMap[key]) {
        techMap[key] = { name: techName.trim(), revenue: 0, jobCount: 0 };
      }
      techMap[key].revenue += parseNum(job.total);
      techMap[key].jobCount++;
    }

    const techResults = Object.values(techMap).map(tech => {
      const meetsThreshold = tech.revenue >= COMMISSION_THRESHOLD;
      const netValue = tech.revenue * NET_SALE_FACTOR;
      // 1.5% for doing + 1.5% for selling (assume both for field techs)
      const installerCommission = meetsThreshold ? netValue * COMMISSION_RATE : 0;
      const salesmanCommission = 0; // Requires sold-by data not available here
      const totalCommission = installerCommission + salesmanCommission;
      const progressPct = Math.min(100, Math.round((tech.revenue / COMMISSION_THRESHOLD) * 100));

      return {
        name: tech.name,
        role: "Installer",
        grossJobsValue: Math.round(tech.revenue),
        netValue: Math.round(netValue),
        installerCommission: Math.round(installerCommission * 100) / 100,
        salesmanCommission: 0,
        totalCommission: Math.round(totalCommission * 100) / 100,
        jobCount: tech.jobCount,
        meetsThreshold,
        progressPct,
        thresholdGap: Math.max(0, Math.round(COMMISSION_THRESHOLD - tech.revenue)),
      };
    }).sort((a, b) => b.grossJobsValue - a.grossJobsValue);

    const totalCommission = techResults.reduce((s, t) => s + t.totalCommission, 0);
    const earnerCount = techResults.filter(t => t.meetsThreshold).length;

    return NextResponse.json({
      ok: true,
      period: range.label,
      threshold: COMMISSION_THRESHOLD,
      netSaleFactor: NET_SALE_FACTOR,
      commissionRate: COMMISSION_RATE,
      totalCommission: Math.round(totalCommission * 100) / 100,
      earnerCount,
      techCount: techResults.length,
      technicians: techResults,
      updatedAt: new Date().toISOString(),
      source: "ServiceTitan",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, updatedAt: new Date().toISOString() }, { status: 500 });
  }
}
