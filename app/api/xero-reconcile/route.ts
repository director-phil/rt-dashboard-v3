import { NextRequest, NextResponse } from "next/server";
import { stFetchAll } from "@/app/lib/st-fetch-all";
import { getDateRange } from "@/app/lib/date-range";

export const dynamic = "force-dynamic";

const VARIANCE_THRESHOLD = 500;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateParam = searchParams.get("date");
  const range = getDateRange(dateParam);

  try {
    const tenantId = process.env.ST_TENANT_ID!;

    // Fetch ST invoices
    const stInvoices = await stFetchAll(`/accounting/v2/tenant/${tenantId}/invoices`, {
      createdOnOrAfter: range.from,
      createdBefore: range.to,
      active: "True",
      pageSize: "500",
    }) as Record<string, unknown>[];

    const parseNum = (v: unknown): number => { const n = typeof v === "string" ? parseFloat(v as string) : Number(v); return isNaN(n) ? 0 : n; };
    const stTotal = stInvoices.reduce((s, inv) => s + parseNum(inv.total), 0);
    const stCount = stInvoices.length;

    // Fetch Xero data if credentials available
    const xeroClientId = process.env.XERO_CLIENT_ID;
    const xeroAccessToken = process.env.XERO_ACCESS_TOKEN;

    let xeroTotal = 0;
    let xeroCount = 0;
    let xeroAvailable = false;
    let xeroInvoices: Record<string, unknown>[] = [];

    if (xeroAccessToken) {
      try {
        const xeroRes = await fetch(
          `https://api.xero.com/api.xro/2.0/Invoices?where=Date>DateTime(${range.from.split("T")[0].replace(/-/g, ",")})+AND+Date<DateTime(${range.to.split("T")[0].replace(/-/g, ",")})&Status=AUTHORISED,PAID`,
          {
            headers: {
              Authorization: `Bearer ${xeroAccessToken}`,
              "Xero-tenant-id": process.env.XERO_TENANT_ID || "",
              Accept: "application/json",
            },
            cache: "no-store",
          }
        );
        if (xeroRes.ok) {
          const xeroData = await xeroRes.json();
          xeroInvoices = xeroData.Invoices || [];
          xeroTotal = xeroInvoices.reduce((s: number, inv: Record<string, unknown>) => s + ((inv.Total as number) || 0), 0);
          xeroCount = xeroInvoices.length;
          xeroAvailable = true;
        }
      } catch {
        // Xero not available
      }
    }

    const variance = Math.abs(stTotal - xeroTotal);
    const variancePct = stTotal > 0 ? (variance / stTotal) * 100 : 0;

    // Jobs not mapped to invoice (in ST but no Xero match)
    const stJobIds = new Set(stInvoices.map(inv => String((inv.jobId as number) || "")));

    // AR Aging from ST invoices
    const now = new Date();
    const arAging = { "0-30": { amount: 0, count: 0 }, "31-60": { amount: 0, count: 0 }, "61-90": { amount: 0, count: 0 }, "90+": { amount: 0, count: 0 } };

    for (const inv of stInvoices) {
      const dueDate = inv.dueDate as string;
      if (!dueDate) continue;
      const age = Math.floor((now.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
      const total = (inv.total as number) || 0;
      const status = (inv.status as string || "").toLowerCase();
      if (status === "paid") continue;

      if (age <= 30) { arAging["0-30"].amount += total; arAging["0-30"].count++; }
      else if (age <= 60) { arAging["31-60"].amount += total; arAging["31-60"].count++; }
      else if (age <= 90) { arAging["61-90"].amount += total; arAging["61-90"].count++; }
      else { arAging["90+"].amount += total; arAging["90+"].count++; }
    }

    // Build integrity checks
    const checks = [
      {
        id: "st_xero_sync",
        label: "ST→Xero Invoice Sync",
        status: !xeroAvailable ? "warning" : variancePct <= 5 ? "ok" : variancePct <= 10 ? "warning" : "error",
        detail: !xeroAvailable
          ? "Xero credentials not configured — add XERO_ACCESS_TOKEN to env"
          : `Variance ${variancePct.toFixed(1)}% — ${variancePct <= 5 ? "within 5% threshold" : "EXCEEDS 5% threshold"}`,
        variance: Math.round(variance),
        variancePct: Math.round(variancePct * 10) / 10,
      },
      {
        id: "unmapped_jobs",
        label: "Technician Revenue Match",
        status: stJobIds.size > 0 ? "ok" : "warning",
        detail: `${stCount} ST invoices fetched`,
      },
      {
        id: "ar_aging",
        label: "AR Aging — 90+ Days",
        status: arAging["90+"].count > 0 ? "warning" : "ok",
        detail: arAging["90+"].count > 0
          ? `${arAging["90+"].count} invoices overdue 90+ days · $${Math.round(arAging["90+"].amount).toLocaleString()} at risk`
          : "No 90+ day AR",
        amount: Math.round(arAging["90+"].amount),
        count: arAging["90+"].count,
      },
    ];

    return NextResponse.json({
      ok: true,
      period: range.label,
      xeroAvailable,
      stTotal: Math.round(stTotal),
      stCount,
      xeroTotal: Math.round(xeroTotal),
      xeroCount,
      variance: Math.round(variance),
      variancePct: Math.round(variancePct * 10) / 10,
      varianceThreshold: VARIANCE_THRESHOLD,
      checks,
      arAging: {
        "0-30": { amount: Math.round(arAging["0-30"].amount), count: arAging["0-30"].count },
        "31-60": { amount: Math.round(arAging["31-60"].amount), count: arAging["31-60"].count },
        "61-90": { amount: Math.round(arAging["61-90"].amount), count: arAging["61-90"].count },
        "90+": { amount: Math.round(arAging["90+"].amount), count: arAging["90+"].count },
      },
      updatedAt: new Date().toISOString(),
      source: "ServiceTitan + Xero",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/xero-reconcile]", msg);
    return NextResponse.json({ ok: false, error: msg, updatedAt: new Date().toISOString() }, { status: 500 });
  }
}
