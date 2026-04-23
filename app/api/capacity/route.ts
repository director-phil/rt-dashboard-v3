import { NextRequest, NextResponse } from "next/server";
import { getSTToken } from "@/app/lib/st-auth";

export const dynamic = "force-dynamic";

const TENANT_ID = process.env.ST_TENANT_ID!;
const APP_KEY = process.env.ST_APP_KEY!;

async function stFetch(path: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const token = await getSTToken();
  const url = new URL(`https://api.servicetitan.io${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, "ST-App-Key": APP_KEY },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ST ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return res.json();
}

async function fetchAll(path: string, params: Record<string, string> = {}): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 20) {
    const data = await stFetch(path, { ...params, page: String(page), pageSize: "200" });
    const items = (data.data as Record<string, unknown>[]) || [];
    all.push(...items);
    hasMore = data.hasMore === true || items.length >= 200;
    page++;
  }
  return all;
}

function normalizeTrade(buName: string): string {
  const n = (buName || "").toLowerCase();
  if (n.includes("electrical") || n.includes("solar") && n.includes("elec")) return "Electrical";
  if (n.includes("air") || n.includes("hvac") || n.includes("condition") || n.includes("ducted") || n.includes("split") || n.includes("cooling")) return "AC/HVAC";
  if (n.includes("solar") || n.includes("battery") || n.includes("panel")) return "Solar";
  if (n.includes("plumb") || n.includes("drain") || n.includes("water") || n.includes("pipe")) return "Plumbing";
  return buName || "Service";
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateParam = searchParams.get("date") || "week";

  const now = new Date();
  const aestNow = new Date(now.getTime() + 10 * 3600000);

  let fromISO: string;
  let toISO: string;
  let periodLabel: string;

  if (dateParam === "today") {
    const y = aestNow.getUTCFullYear();
    const m = String(aestNow.getUTCMonth() + 1).padStart(2, "0");
    const d = String(aestNow.getUTCDate()).padStart(2, "0");
    fromISO = `${y}-${m}-${d}T00:00:00+10:00`;
    toISO   = `${y}-${m}-${d}T23:59:59+10:00`;
    periodLabel = "Today";
  } else {
    const dayOfWeek = aestNow.getUTCDay();
    const daysToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(aestNow.getTime() + daysToMon * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    const fmt = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    fromISO = `${fmt(monday)}T00:00:00+10:00`;
    toISO   = `${fmt(sunday)}T23:59:59+10:00`;
    periodLabel = "This Week";
  }

  try {
    // 1. Fetch appointments in window
    const appointments = await fetchAll(`/jpm/v2/tenant/${TENANT_ID}/appointments`, {
      startsOnOrAfter: fromISO,
      startsOnOrBefore: toISO,
    });

    if (appointments.length === 0) {
      return NextResponse.json({ ok: true, period: periodLabel, techCount: 0, totalJobs: 0, techs: [], updatedAt: new Date().toISOString(), source: "ServiceTitan" });
    }

    // 2. Bulk fetch dispatch assignments for this date range
    const assignments = await fetchAll(`/dispatch/v2/tenant/${TENANT_ID}/appointment-assignments`, {
      modifiedOnOrAfter: fromISO,
      modifiedBefore: toISO,
    });

    // appointmentId → technicianName[] (all assigned techs, not just the last one)
    const apptToTechs = new Map<string, string[]>();
    for (const a of assignments) {
      if (a.status === "Dismissed") continue;
      const techName = ((a.technicianName as string) || "").trim();
      if (!techName) continue;
      const apptId = String(a.appointmentId);
      const existing = apptToTechs.get(apptId) || [];
      if (!existing.includes(techName)) existing.push(techName);
      apptToTechs.set(apptId, existing);
    }

    // 3. Batch fetch jobs for the unique job IDs
    const jobIdSet = new Set<string>();
    for (const appt of appointments) {
      const jid = appt.jobId as number | string;
      if (jid) jobIdSet.add(String(jid));
    }

    const jobMap = new Map<string, Record<string, unknown>>();
    const jobIds = Array.from(jobIdSet);
    for (let i = 0; i < jobIds.length; i += 50) {
      try {
        const batch = jobIds.slice(i, i + 50);
        const jobs = await fetchAll(`/jpm/v2/tenant/${TENANT_ID}/jobs`, { ids: batch.join(","), pageSize: "50" });
        for (const job of jobs) jobMap.set(String(job.id), job);
      } catch { /* continue */ }
    }

    // 3b. Fetch business unit names
    const buMap = new Map<number, string>();
    try {
      const buData = await fetchAll(`/settings/v2/tenant/${TENANT_ID}/business-units`, { pageSize: "200" });
      for (const bu of buData) buMap.set(Number(bu.id), String(bu.name || ""));
    } catch { /* use empty map, trades will show as "Service" */ }

    // 4. Group by tech
    type JobEntry = { id: string; jobNumber: string; time: string; type: string; trade: string; status: string; value: number; durationHours: number; };
    type TechEntry = { name: string; jobs: JobEntry[]; totalValue: number; scheduledHours: number; };
    const techSchedule: Record<string, TechEntry> = {};

    for (const appt of appointments) {
      const apptId = String(appt.id);
      const techNames = apptToTechs.get(apptId) || ["Unassigned"];
      const status = (appt.status as string) || "Scheduled";

      const startStr = (appt.start as string) || "";
      const timeStr = startStr
        ? new Date(startStr).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Australia/Brisbane" })
        : "—";

      const durationMins = (appt.duration as number) || 0;
      const durationHours = durationMins > 0 ? durationMins / 60 : 2;

      const jobId = String(appt.jobId || "");
      const job = jobMap.get(jobId) || {};
      const jobNumber = (job.jobNumber as string) || "";
      const buId = Number(job.businessUnitId) || 0;
      const trade = normalizeTrade(buMap.get(buId) || "");
      const jobType = (job.jobTypeName as string) || (job.type as string) || trade;
      const jobValue = (job.total as number) || 0;
      const jobStatus = status || (job.jobStatus as string) || "Scheduled";

      for (const techName of techNames) {
        if (!techSchedule[techName]) {
          techSchedule[techName] = { name: techName, jobs: [], totalValue: 0, scheduledHours: 0 };
        }
        techSchedule[techName].jobs.push({ id: apptId, jobNumber, time: timeStr, type: jobType, trade, status: jobStatus, value: jobValue, durationHours });
        techSchedule[techName].totalValue += jobValue;
        techSchedule[techName].scheduledHours += durationHours;
      }
    }

    const techs = Object.values(techSchedule).sort((a, b) => {
      if (a.name === "Unassigned") return 1;
      if (b.name === "Unassigned") return -1;
      return b.totalValue - a.totalValue;
    });

    return NextResponse.json({
      ok: true,
      period: periodLabel,
      fromDate: fromISO,
      toDate: toISO,
      techCount: techs.filter(t => t.name !== "Unassigned").length,
      totalJobs: appointments.length,
      techs,
      updatedAt: new Date().toISOString(),
      source: "ServiceTitan",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, updatedAt: new Date().toISOString() }, { status: 500 });
  }
}
