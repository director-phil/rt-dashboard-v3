import { NextRequest, NextResponse } from "next/server";
import { stFetchAll } from "@/app/lib/st-fetch-all";
import { getDateRange } from "@/app/lib/date-range";

export const dynamic = "force-dynamic";

const COMMISSION_THRESHOLD = 80000;
const NET_SALE_FACTOR = 0.95;
const COMMISSION_RATE = 0.015;

// Whitelist of real field technicians — sourced from Phillip 2026-03-25
const TECH_WHITELIST = new Set([
  "mitch powell",
  "romello moore",
  "curtis jeffrey",
  "kyle rootes",
  "zachary lingard",
  "zach lingard",
  "dean retra",
  "hayden sibley",
  "scott gullick",
  "lachlan henzell",
  "rusty daniells",
  "bradley tinworth mt",
  "bradley tinworth",
  "kristian calcagno",
  "alex naughton",
  "david white",
  "bailey somerville",
  "daniel hayes",
  "alex peisler",
]);

function isTech(name: string): boolean {
  if (!name || name.includes("@")) return false;
  return TECH_WHITELIST.has(name.trim().toLowerCase());
}

const parseNum = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v as string) : Number(v);
  return isNaN(n) ? 0 : n;
};

async function fetchTechMetrics(from: string, to: string) {
  const tenantId = process.env.ST_TENANT_ID!;

  // Step 1: bulk fetch all dispatch assignments in date range (2-3 API calls total)
  const assignments = await stFetchAll(
    `/dispatch/v2/tenant/${tenantId}/appointment-assignments`,
    {
      modifiedOnOrAfter: from,
      modifiedBefore: to,
      pageSize: "500",
    }
  ) as Record<string, unknown>[];

  // Build jobId → technicianName map
  const jobToTech: Record<string, string> = {};
  for (const a of assignments) {
    const jobId = String(a.jobId);
    const techName = (a.technicianName as string || "").trim();
    // Only keep active/done assignments for whitelisted techs
    if (a.status === "Dismissed" || !isTech(techName)) continue;
    // If multiple techs on a job, keep the most recent (last one seen)
    jobToTech[jobId] = techName;
  }

  if (Object.keys(jobToTech).length === 0) return [];

  // Step 2: fetch completed jobs in range
  const jobs = await stFetchAll(
    `/jpm/v2/tenant/${tenantId}/jobs`,
    {
      completedOnOrAfter: from,
      completedBefore: to,
      jobStatus: "Completed",
      pageSize: "500",
    }
  ) as Record<string, unknown>[];

  // Step 3: aggregate revenue per tech
  const techMap: Record<string, { name: string; revenue: number; jobCount: number }> = {};

  for (const job of jobs) {
    const jobId = String(job.id);
    const techName = jobToTech[jobId];
    if (!techName) continue;

    const key = techName.toLowerCase();
    if (!techMap[key]) {
      techMap[key] = { name: techName, revenue: 0, jobCount: 0 };
    }
    techMap[key].revenue += parseNum(job.total);
    techMap[key].jobCount++;
  }

  return Object.values(techMap);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateParam = searchParams.get("date");
  const range = getDateRange(dateParam);

  try {
    const [current, previous] = await Promise.all([
      fetchTechMetrics(range.from, range.to),
      fetchTechMetrics(range.prevFrom, range.prevTo),
    ]);

    const prevMap = new Map(previous.map(t => [t.name.toLowerCase(), t]));

    const technicians = current.map(tech => {
      const prev = prevMap.get(tech.name.toLowerCase());
      const revChange = prev ? tech.revenue - prev.revenue : null;
      const revChangePct = prev && prev.revenue > 0
        ? ((tech.revenue - prev.revenue) / prev.revenue) * 100
        : null;

      const netSale = tech.revenue * NET_SALE_FACTOR;
      const meetsThreshold = tech.revenue >= COMMISSION_THRESHOLD;
      const commission = meetsThreshold ? netSale * COMMISSION_RATE : 0;
      const progressPct = Math.min(100, Math.round((tech.revenue / COMMISSION_THRESHOLD) * 100));

      return {
        name: tech.name.trim(),
        revenueMTD: Math.round(tech.revenue),
        prevRevenue: prev ? Math.round(prev.revenue) : null,
        revChange: revChange !== null ? Math.round(revChange) : null,
        revChangePct: revChangePct !== null ? Math.round(revChangePct * 10) / 10 : null,
        jobCount: tech.jobCount,
        commission: Math.round(commission * 100) / 100,
        meetsThreshold,
        progressPct,
        thresholdGap: Math.max(0, Math.round(COMMISSION_THRESHOLD - tech.revenue)),
      };
    }).sort((a, b) => b.revenueMTD - a.revenueMTD);

    return NextResponse.json({
      ok: true,
      period: range.label,
      commissionThreshold: COMMISSION_THRESHOLD,
      technicians,
      noData: technicians.length === 0,
      updatedAt: new Date().toISOString(),
      source: "ServiceTitan",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, updatedAt: new Date().toISOString() }, { status: 500 });
  }
}
