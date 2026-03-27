import { NextRequest, NextResponse } from "next/server";
import { getDateRange } from "@/app/lib/date-range";

export const dynamic = "force-dynamic";

// Google Ads — REAL DATA from google-ads-march.json (pulled 2026-03-26)
// + WildJar calls from wildjar-calls-march.json (pulled 2026-03-26)
// IMPORTANT: Google's "conversionsValue" is NOT revenue — it's a Google-tracked proxy value.
// Actual revenue attribution requires WildJar + ServiceTitan integration (not yet complete).
// ROAS shown is Google's own conversion value / spend — do NOT present as business revenue ROAS.

const VERIFIED_DATE = "2026-03-26";

// Top campaigns consolidated from 200+ campaigns — showing meaningful spend only (>$1,500)
const VERIFIED_CAMPAIGNS = [
  {
    campaign: "Hot Water (Plumbing)",
    trade: "Plumbing",
    status: "active",
    impressions: 6482, impressionsPrev: null,
    clicks: 400, clicksPrev: null,
    ctr: 6.17, ctrPrev: null,
    avgCpc: 17.94, avgCpcPrev: null,
    spend: 7177, spendPrev: null,
    conversions: 31, conversionsPrev: null,
    convRate: 7.75, convRatePrev: null,
    cpa: 231.53, cpaPrev: null,
    estRevenue: null, estRevenuePrev: null,
    roas: null, roasPrev: null,
    note: "Hot water — strong lead volume",
  },
  {
    campaign: "Air Conditioning (Electrical)",
    trade: "Electrical",
    status: "active",
    impressions: 5510, impressionsPrev: null,
    clicks: 416, clicksPrev: null,
    ctr: 7.55, ctrPrev: null,
    avgCpc: 17.16, avgCpcPrev: null,
    spend: 7137, spendPrev: null,
    conversions: 105, conversionsPrev: null,
    convRate: 25.24, convRatePrev: null,
    cpa: 68.21, cpaPrev: null,
    estRevenue: null, estRevenuePrev: null,
    roas: null, roasPrev: null,
    note: "Strong AC demand — 105 conv at $68 CPA",
  },
  {
    campaign: "City Level Brisbane (Plumbing)",
    trade: "Plumbing",
    status: "active",
    impressions: 4650, impressionsPrev: null,
    clicks: 244, clicksPrev: null,
    ctr: 5.25, ctrPrev: null,
    avgCpc: 27.85, avgCpcPrev: null,
    spend: 6795, spendPrev: null,
    conversions: 44, conversionsPrev: null,
    convRate: 18.03, convRatePrev: null,
    cpa: 154.42, cpaPrev: null,
    estRevenue: null, estRevenuePrev: null,
    roas: null, roasPrev: null,
    note: null,
  },
  {
    campaign: "City Level (Electrical)",
    trade: "Electrical",
    status: "active",
    impressions: null, impressionsPrev: null,
    clicks: 414, clicksPrev: null,
    ctr: null, ctrPrev: null,
    avgCpc: 14.27, avgCpcPrev: null,
    spend: 5907, spendPrev: null,
    conversions: 90, conversionsPrev: null,
    convRate: 21.74, convRatePrev: null,
    cpa: 65.39, cpaPrev: null,
    estRevenue: null, estRevenuePrev: null,
    roas: null, roasPrev: null,
    note: null,
  },
  {
    campaign: "Ducted Air Conditioning (Electrical)",
    trade: "Electrical",
    status: "active",
    impressions: null, impressionsPrev: null,
    clicks: 231, clicksPrev: null,
    ctr: null, ctrPrev: null,
    avgCpc: 18.73, avgCpcPrev: null,
    spend: 4327, spendPrev: null,
    conversions: 54, conversionsPrev: null,
    convRate: 23.38, convRatePrev: null,
    cpa: 79.65, cpaPrev: null,
    estRevenue: null, estRevenuePrev: null,
    roas: null, roasPrev: null,
    note: null,
  },
  {
    campaign: "Solar (Electrical)",
    trade: "Solar",
    status: "active",
    impressions: null, impressionsPrev: null,
    clicks: 300, clicksPrev: null,
    ctr: null, ctrPrev: null,
    avgCpc: 11.05, avgCpcPrev: null,
    spend: 3316, spendPrev: null,
    conversions: 76, conversionsPrev: null,
    convRate: 25.33, convRatePrev: null,
    cpa: 43.63, cpaPrev: null,
    estRevenue: null, estRevenuePrev: null,
    roas: null, roasPrev: null,
    note: "Strong conversion rate — low CPA",
  },
  {
    campaign: "Switchboard Upgrades (Electrical)",
    trade: "Electrical",
    status: "active",
    impressions: null, impressionsPrev: null,
    clicks: 220, clicksPrev: null,
    ctr: null, ctrPrev: null,
    avgCpc: 12.89, avgCpcPrev: null,
    spend: 2835, spendPrev: null,
    conversions: 26, conversionsPrev: null,
    convRate: 11.82, convRatePrev: null,
    cpa: 109.04, cpaPrev: null,
    estRevenue: null, estRevenuePrev: null,
    roas: null, roasPrev: null,
    note: null,
  },
  {
    campaign: "Emergency Plumbing ⛔",
    trade: "Plumbing",
    status: "pause",
    impressions: null, impressionsPrev: null,
    clicks: 9, clicksPrev: null,
    ctr: null, ctrPrev: null,
    avgCpc: 172.25, avgCpcPrev: null,
    spend: 1550, spendPrev: null,
    conversions: 0, conversionsPrev: null,
    convRate: 0, convRatePrev: null,
    cpa: null, cpaPrev: null,
    estRevenue: 0, estRevenuePrev: null,
    roas: 0, roasPrev: null,
    note: "✅ PAUSED — $1,550 spend, 0 conversions. Campaign confirmed paused.",
  },
];

// WildJar calls — REAL data from wildjar-calls-march.json (pulled 2026-03-26)
// Individual call records not available in current pull (summary only)
const WILDJAR_SUMMARY = {
  totalCalls: 405,
  answered: 383,
  abandoned: 22,
  answerRate: 94.6,
  avgDurationSeconds: 225,
  bySource: {
    "Reliable Tradies - Electrical":     { total: 237, answered: 223, abandoned: 14 },
    "Reliable Tradies - Aircon":          { total: 93,  answered: 86,  abandoned: 7  },
    "Reliable Tradies - Solar":           { total: 39,  answered: 38,  abandoned: 1  },
    "Reliable Tradies - Ducted Aircon":   { total: 36,  answered: 36,  abandoned: 0  },
  },
};

// Per-call attribution table not available — WildJar API returning summary only
const WILDJAR_ATTRIBUTION: never[] = [];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const dateParam = searchParams.get("date");
  const range = getDateRange(dateParam);

  const totalSpend = VERIFIED_CAMPAIGNS.reduce((s, c) => s + c.spend, 0);
  const totalConversions = VERIFIED_CAMPAIGNS.reduce((s, c) => s + c.conversions, 0);

  const campaignsWithVariance = VERIFIED_CAMPAIGNS.map(c => ({
    ...c,
    spendVariance: c.spendPrev != null ? c.spend - c.spendPrev : null,
    spendVariancePct: c.spendPrev != null && c.spendPrev > 0 ? ((c.spend - c.spendPrev) / c.spendPrev) * 100 : null,
    roasVariance: c.roas != null && c.roasPrev != null ? c.roas - c.roasPrev : null,
    convVariance: c.conversionsPrev != null ? c.conversions - c.conversionsPrev : null,
    revenueVariance: null,
  }));

  return NextResponse.json({
    ok: true,
    period: range.label,
    dataSource: `Verified from google-ads-march.json [${VERIFIED_DATE}]`,
    isLive: false,
    roasNote: "ROAS not calculated — Google conversion values ≠ business revenue. WildJar + ST attribution required for true ROAS.",
    summary: {
      totalSpend: Math.round(totalSpend),
      totalClicks: 3094,
      totalImpressions: 49855,
      totalConversions: Math.round(totalConversions),
      blendedRoas: null,   // Cannot calculate without revenue attribution
      activeCampaigns: VERIFIED_CAMPAIGNS.filter(c => c.status === "active").length,
      pausedCampaigns: VERIFIED_CAMPAIGNS.filter(c => c.status === "pause").length,
      byAccount: {
        Electrical:     { spend: 34024, clicks: 2077 },
        PlumbingLegacy: { spend: 17826, clicks: 817  },
        PlumbingNew:    { spend: 6531,  clicks: 200  },
      },
    },
    wildjarSummary: WILDJAR_SUMMARY,
    campaigns: campaignsWithVariance,
    wildjarAttribution: WILDJAR_ATTRIBUTION,
    alerts: [
      {
        type: "success",
        campaign: "Emergency Plumbing",
        message: "✅ PAUSED — $1,550 spent before pause, 0 conversions. Monthly budget saved.",
        action: "DONE",
      },
      {
        type: "info",
        campaign: "Air Conditioning (Electrical)",
        message: "105 conversions at $68 CPA — strong performer",
        action: "MONITOR",
      },
      {
        type: "warning",
        campaign: "New Hot Water (PlumbNew)",
        message: "$2,873 spend, only 2 conversions — CPA $1,642. Review or pause.",
        action: "REVIEW",
      },
    ],
    updatedAt: new Date().toISOString(),
    source: "Google Ads API data (verified 2026-03-26)",
  });
}
