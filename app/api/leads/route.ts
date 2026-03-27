import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Pre-aggregated from ServiceTitan CSV — March 2026 (848 calls, extracted 2026-03-26)
// Source: workspace/drive-data/jobs-micro-detail-march-calls.csv

const DATA = {
  totalCalls: 848,
  totalBooked: 234,
  totalAbandoned: 124,
  totalExcused: 145,
  totalNotLead: 208,
  totalUnbooked: 10,
  bookingRate: 45.3,  // booked / (total - abandoned - notLead)
  period: "March 2026",
  source: "ServiceTitan",
  csrs: [
    { name: "Hudson Newman",    total: 254, booked: 101, abandoned: 1,  excused: 62, answered: 198, bookingRate: 51.0 },
    { name: "Reannah Thompson", total: 267, booked: 84,  abandoned: 0,  excused: 50, answered: 179, bookingRate: 46.9 },
    { name: "Kath Fraser",      total: 99,  booked: 33,  abandoned: 0,  excused: 19, answered: 74,  bookingRate: 44.6 },
    { name: "Jordy Patterson",  total: 84,  booked: 11,  abandoned: 0,  excused: 5,  answered: 46,  bookingRate: 23.9, note: "Dispatch role" },
  ],
  campaigns: [
    { campaign: "Brand / Vehicle",           calls: 301, booked: 35,  rate: 12 },
    { campaign: "Google - Electrical",        calls: 201, booked: 85,  rate: 42 },
    { campaign: "Google My Business",         calls: 83,  booked: 13,  rate: 16 },
    { campaign: "Google - General AC",        calls: 72,  booked: 26,  rate: 36 },
    { campaign: "Google - Hot Water Systems", calls: 37,  booked: 12,  rate: 32 },
    { campaign: "Google - Solar",             calls: 33,  booked: 15,  rate: 45 },
    { campaign: "Google - Plumbing",          calls: 31,  booked: 8,   rate: 26 },
    { campaign: "Google - Ducted AC",         calls: 31,  booked: 12,  rate: 39 },
    { campaign: "Google - Gutters",           calls: 30,  booked: 17,  rate: 57 },
    { campaign: "Google - Drainage",          calls: 20,  booked: 7,   rate: 35 },
  ],
};

export async function GET() {
  return NextResponse.json({
    ...DATA,
    ok: true,
    updatedAt: new Date().toISOString(),
    note: "Based on 848 March 2026 calls from ServiceTitan. Booking rate = booked / (total - abandoned - not-a-lead).",
  });
}
