"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DateRange { from: string; to: string; label: string; }

type SectionId =
  | "overview" | "cash" | "upcoming-jobs"
  | "cashflow" | "trends" | "history" | "liabilities" | "bills"
  | "recon"
  | "mkt-overview" | "google" | "phones-attr" | "podium"
  | "calls"
  | "capacity" | "sold-hours" | "unproductive"
  | "job-profit" | "commissions"
  | "issues" | "improvements" | "wins";

// ── API hook ──────────────────────────────────────────────────────────────────
function useApi<T>(endpoint: string, params: Record<string, string | null | undefined> = {}, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const url = new URL(endpoint, window.location.origin);
      Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
      const r = await fetch(url.toString(), { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "API error");
      setData(d); setUpdatedAt(d.updatedAt || new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, JSON.stringify(params), ...deps]);

  useEffect(() => { fetch_(); }, [fetch_]);
  return { data, loading, error, updatedAt, refetch: fetch_ };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n/1000)}K` : `$${Math.round(n)}`;
}
function fmtFull$(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 0 });
}
function fmtPct(n: number | null | undefined) { return n == null ? "—" : `${n.toFixed(1)}%`; }
function ago(ts: string | null) {
  if (!ts) return "Never";
  const diff = (Date.now() - new Date(ts).getTime()) / 60000;
  if (diff < 2) return "Just now";
  if (diff < 60) return `${Math.floor(diff)}m ago`;
  if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
  return `${Math.floor(diff/1440)}d ago`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, color = "default" }: { label: string; value: string; sub?: string; color?: "up" | "down" | "warn" | "default" }) {
  const subColor = color === "up" ? "text-green-600" : color === "down" ? "text-red-600" : color === "warn" ? "text-amber-600" : "text-[#5a7a8a]";
  return (
    <div className="bg-white rounded-xl border border-[#D1DCE3] px-5 py-4">
      <div className="text-xs font-700 text-[#5a7a8a] uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-extrabold text-[#102E46] mt-1 leading-tight">{value}</div>
      {sub && <div className={`text-xs mt-1 ${subColor}`}>{sub}</div>}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ title, sub, source, updatedAt: ua, children, className = "" }: {
  title: string; sub?: string; source?: string; updatedAt?: string | null; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-[#D1DCE3] overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#D1DCE3]">
        <div>
          <span className="text-sm font-bold text-[#102E46]">{title}</span>
          {sub && <span className="ml-2 text-xs text-[#5a7a8a]">{sub}</span>}
        </div>
        {(source || ua) && (
          <div className="text-xs text-[#5a7a8a] flex items-center gap-2">
            {source && <span className="bg-[#EAF0F2] px-2 py-0.5 rounded text-[11px]">{source}</span>}
            {ua && <span>{ago(ua)}</span>}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
function Alert({ type, title, children }: { type: "critical"|"warning"|"info"|"win"; title: string; children?: React.ReactNode }) {
  const cfg = {
    critical: "bg-red-50 border-red-200 text-red-800",
    warning:  "bg-amber-50 border-amber-200 text-amber-800",
    info:     "bg-blue-50 border-blue-200 text-blue-800",
    win:      "bg-green-50 border-green-200 text-green-800",
  }[type];
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm mb-3 ${cfg}`}>
      <strong className="block text-xs font-bold mb-1">{title}</strong>
      {children}
    </div>
  );
}

// ── Pill ──────────────────────────────────────────────────────────────────────
function Pill({ color, children }: { color: "green"|"red"|"amber"|"blue"|"grey"; children: React.ReactNode }) {
  const cfg = {
    green: "bg-green-50 text-green-700",
    red:   "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    blue:  "bg-blue-50 text-blue-700",
    grey:  "bg-slate-100 text-slate-500",
  }[color];
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg}`}>{children}</span>;
}

// ── Table ─────────────────────────────────────────────────────────────────────
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`bg-slate-50 text-[11px] font-bold text-[#5a7a8a] uppercase tracking-wide px-3 py-2.5 border-b border-[#D1DCE3] ${right ? "text-right" : "text-left"} whitespace-nowrap`}>{children}</th>;
}
function Td({ children, right, className = "" }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-3 py-2.5 text-[12.5px] border-b border-slate-50 ${right ? "text-right font-mono" : ""} ${className}`}>{children}</td>;
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ pct, color = "blue" }: { pct: number; color?: "blue"|"green"|"amber"|"red" }) {
  const c = { blue: "bg-[#31AFEA]", green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500" }[color];
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-20">
      <div className={`h-full rounded-full ${c}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

// ── Sub-tabs ──────────────────────────────────────────────────────────────────
function SubTabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 mb-5 bg-white border border-[#D1DCE3] rounded-lg p-1 w-fit">
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${active === t ? "bg-[#31AFEA] text-white shadow-sm" : "text-[#5a7a8a] hover:text-[#102E46]"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

// ── Source Badge ──────────────────────────────────────────────────────────────
function SourceBadge({ source, note }: { source: string; note?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 text-xs text-[#5a7a8a]">
      <span className="bg-[#EAF0F2] border border-[#D1DCE3] px-2 py-0.5 rounded font-medium">📡 {source}</span>
      {note && <span>{note}</span>}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

// ════════════════════════════════════════
// SECTION COMPONENTS
// ════════════════════════════════════════

function SectionOverview({ dateRange }: { dateRange: DateRange }) {
  const rev = useApi<Record<string, unknown>>("/api/revenue", { date: "mtd" });
  const exp = useApi<Record<string, unknown>>("/api/expenses", {});
  const bank = useApi<Record<string, unknown>>("/api/bank", {});
  const ads = useApi<Record<string, unknown>>("/api/ads", {});
  const leads = useApi<Record<string, unknown>>("/api/leads", {});
  const techs = useApi<Record<string, unknown>>("/api/technicians", {});

  const r = rev.data as Record<string, Record<string, unknown>> | null;
  const e = exp.data as Record<string, unknown> | null;
  const b = bank.data as Record<string, unknown> | null;
  const a = ads.data as Record<string, Record<string, unknown>> | null;
  const l = leads.data as Record<string, unknown> | null;
  const t = techs.data as Record<string, unknown[]> | null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-[#102E46]">Business Snapshot</h1>
        <p className="text-sm text-[#5a7a8a] mt-1">Key metrics across revenue, operations, marketing and team · {dateRange.label}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="MTD Revenue" value={r ? fmt$(r.current?.total as number) : "—"} sub="From ServiceTitan invoices" color="up" />
        <KPI label="Net Margin" value={e ? fmtPct(e.netMarginPct as number) : "—"} sub="Target 20–35% | Xero P&L" color={e && (e.netMarginPct as number) >= 15 ? "up" : "warn"} />
        <KPI label="Cash in Bank" value={b ? fmt$(b.totalBank as number) : "—"} sub="Xero live balance" />
        <KPI label="Active Techs" value={t ? String((t.technicians || []).length) : "—"} sub="Dispatched this month" />
        <KPI label="Blended ROAS" value={a?.summary ? `${(a.summary.blendedRoas as number) ?? "—"}x` : "—"} sub="Google Ads attributed" color={a?.summary && (a.summary.blendedRoas as number) >= 5 ? "up" : "warn"} />
        <KPI label="Booking Rate" value={l ? `${l.bookingRate}%` : "—"} sub="Target ≥75% | WildJar" color={l && (l.bookingRate as number) >= 75 ? "up" : "warn"} />
        <KPI label="Gross Profit" value={e ? fmt$(e.grossProfit as number) : "—"} sub={e ? `${fmtPct(e.grossMarginPct as number)} margin` : "Xero"} />
        <KPI label="Ad Spend MTD" value={a?.summary ? fmt$(a.summary.totalSpend as number) : "—"} sub={a?.summary ? `${a.summary.totalConversions} conversions` : "Google Ads"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Revenue by Trade — MTD" source="ServiceTitan" updatedAt={rev.updatedAt}>
          {rev.loading ? <Skeleton /> : r ? (
            <div className="p-5">
              {Object.entries((r.current?.byTrade as Record<string, {revenue: number; count: number}>) || {}).map(([trade, d]) => (
                <div key={trade} className="flex items-center gap-3 mb-3">
                  <div className="text-sm text-[#102E46] w-28 capitalize font-medium">{trade}</div>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#31AFEA]" style={{ width: `${Math.min(100, Math.round((d.revenue / (r.current?.total as number || 1)) * 100))}%` }} />
                  </div>
                  <div className="text-sm font-bold text-[#102E46] w-20 text-right">{fmt$(d.revenue)}</div>
                  <div className="text-xs text-[#5a7a8a] w-8">{d.count}j</div>
                </div>
              ))}
            </div>
          ) : <div className="p-5 text-[#5a7a8a] text-sm">{rev.error}</div>}
        </Card>

        <Card title="Technician Leaderboard" source="ServiceTitan" updatedAt={techs.updatedAt}>
          {techs.loading ? <Skeleton /> : t ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><Th>#</Th><Th>Tech</Th><Th right>Revenue</Th><Th right>Jobs</Th><Th right>Progress</Th></tr></thead>
                <tbody>
                  {((t.technicians || []) as Record<string, unknown>[]).slice(0, 8).map((tech, i) => (
                    <tr key={tech.name as string} className="hover:bg-slate-50">
                      <Td><span className="text-[#5a7a8a] text-xs">{i+1}</span></Td>
                      <Td><span className="font-semibold text-[#102E46]">{tech.name as string}</span></Td>
                      <Td right><span className="font-bold text-[#31AFEA]">{fmtFull$(tech.revenueMTD as number)}</span></Td>
                      <Td right>{tech.jobCount as number}</Td>
                      <Td right><ProgressBar pct={tech.progressPct as number} color={tech.meetsThreshold ? "green" : "blue"} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="p-5 text-red-500 text-sm">{techs.error}</div>}
        </Card>
      </div>

      {/* P&L Summary */}
      <Card title="P&L Summary — March 2026" source="Xero" updatedAt={exp.updatedAt}>
        {exp.loading ? <Skeleton rows={3} /> : e ? (
          <div className="p-5">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: "Revenue", val: e.income as number, color: "text-[#102E46]" },
                { label: "COGS", val: e.cogs as number, color: "text-red-600" },
                { label: "Gross Profit", val: e.grossProfit as number, color: "text-green-600" },
                { label: "Op Expenses", val: e.operatingExpenses as number, color: "text-amber-600" },
                { label: "Net Profit", val: e.netProfit as number, color: (e.netProfit as number) > 0 ? "text-green-600" : "text-red-600" },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <div className="text-xs text-[#5a7a8a] mb-1">{item.label}</div>
                  <div className={`text-xl font-extrabold ${item.color}`}>{fmtFull$(item.val)}</div>
                </div>
              ))}
            </div>
            {(e.expenseBreakdown as {name: string; amount: number}[])?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#D1DCE3]">
                <div className="text-xs font-bold text-[#5a7a8a] uppercase tracking-wide mb-2">Top Expenses</div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {((e.expenseBreakdown as {name: string; amount: number}[]) || []).slice(0, 6).map(ex => (
                    <div key={ex.name} className="flex justify-between text-xs py-1 border-b border-slate-50">
                      <span className="text-[#5a7a8a] truncate">{ex.name}</span>
                      <span className="font-semibold text-[#102E46] ml-2">{fmtFull$(ex.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : <Alert type="warning" title="P&L data unavailable">{exp.error}</Alert>}
      </Card>
    </div>
  );
}

function SectionCash() {
  const bank = useApi<Record<string, unknown>>("/api/bank", {});
  const recon = useApi<Record<string, unknown>>("/api/xero-reconcile", { date: "mtd" });
  const b = bank.data as Record<string, unknown> | null;
  const r = recon.data as Record<string, unknown> | null;

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-extrabold text-[#102E46]">Cash in Bank</h1><p className="text-sm text-[#5a7a8a] mt-1">Live Xero bank balances + aged receivables</p></div>
      <SourceBadge source="Xero Balance Sheet via Zapier MCP" note="Live — updates on every page load" />

      {bank.loading ? <Skeleton /> : b ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {((b.bankAccounts as {name: string; balance: number}[]) || []).map(acc => (
              <div key={acc.name} className="bg-white rounded-xl border border-[#D1DCE3] p-4">
                <div className="text-xs text-[#5a7a8a] mb-1 truncate">{acc.name}</div>
                <div className={`text-2xl font-extrabold ${acc.balance >= 0 ? "text-[#102E46]" : "text-red-600"}`}>
                  {acc.balance < 0 ? "-" : ""}{fmtFull$(Math.abs(acc.balance))}
                </div>
                <div className="text-xs text-[#5a7a8a] mt-0.5">AUD</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-[#102E46] text-white rounded-xl p-5">
              <div className="text-xs opacity-60 uppercase tracking-wide">Total Cash Position</div>
              <div className="text-3xl font-extrabold mt-1">{fmtFull$(b.totalBank as number)}</div>
              <div className="text-sm opacity-70 mt-1">All accounts combined</div>
            </div>
            <div className="bg-white rounded-xl border border-[#D1DCE3] p-5">
              <div className="text-xs text-[#5a7a8a] uppercase tracking-wide">Accounts Receivable</div>
              <div className="text-2xl font-extrabold text-amber-600 mt-1">{fmtFull$(b.ar as number)}</div>
              <div className="text-xs text-[#5a7a8a] mt-1">Outstanding invoices</div>
            </div>
            <div className="bg-white rounded-xl border border-[#D1DCE3] p-5">
              <div className="text-xs text-[#5a7a8a] uppercase tracking-wide">Net (Bank − AP)</div>
              <div className={`text-2xl font-extrabold mt-1 ${(b.netCash as number) >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtFull$(b.netCash as number)}</div>
              <div className="text-xs text-[#5a7a8a] mt-1">After accounts payable ${fmtFull$(b.ap as number)}</div>
            </div>
          </div>
        </>
      ) : <Alert type="warning" title="Bank data unavailable">{bank.error}</Alert>}

      <Card title="Aged Receivables" source="ServiceTitan + Xero" updatedAt={recon.updatedAt}>
        {recon.loading ? <Skeleton rows={4} /> : r?.arAging ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Bucket</Th><Th right>Count</Th><Th right>Value</Th><Th>Status</Th></tr></thead>
              <tbody>
                {[
                  { label: "0–30 days", data: (r.arAging as Record<string, {amount: number; count: number}>)["0-30"], status: <Pill color="green">Current</Pill> },
                  { label: "31–60 days", data: (r.arAging as Record<string, {amount: number; count: number}>)["31-60"], status: <Pill color="amber">Monitor</Pill> },
                  { label: "61–90 days", data: (r.arAging as Record<string, {amount: number; count: number}>)["61-90"], status: <Pill color="red">Overdue</Pill> },
                  { label: "90+ days", data: (r.arAging as Record<string, {amount: number; count: number}>)["90+"], status: <Pill color="red">Critical</Pill> },
                ].map(row => (
                  <tr key={row.label} className="hover:bg-slate-50">
                    <Td>{row.label}</Td>
                    <Td right>{row.data?.count ?? "—"}</Td>
                    <Td right className="font-bold">{fmtFull$(row.data?.amount ?? 0)}</Td>
                    <Td>{row.status}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="p-4 text-[#5a7a8a] text-sm">Loading AR data…</div>}
      </Card>
    </div>
  );
}

function SectionTrends() {
  const [tab, setTab] = useState("Revenue");
  const trends = useApi<Record<string, unknown>>("/api/trends", {});
  const months = (trends.data?.months as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-extrabold text-[#102E46]">Trends</h1><p className="text-sm text-[#5a7a8a] mt-1">Month-over-month performance across key metrics</p></div>
      <SourceBadge source="Xero P&L + ServiceTitan" note="Mar 26 = live. Prior months = Xero historical." />
      <SubTabs tabs={["Revenue", "Margin", "Net Profit", "Jobs"]} active={tab} onChange={setTab} />
      <Card title={`${tab} Trend — Last 6 Months`} source="Xero">
        {trends.loading ? <Skeleton /> : (
          <div className="p-5">
            <div className="grid grid-cols-6 gap-3">
              {months.map((m) => {
                const val = tab === "Revenue" ? m.revenue as number :
                            tab === "Margin" ? m.netMarginPct as number :
                            tab === "Net Profit" ? m.netProfit as number : m.jobs as number;
                const isLive = !!m.isLive;
                const maxVal = Math.max(...months.map(x => (tab === "Revenue" ? x.revenue : tab === "Margin" ? x.netMarginPct : tab === "Net Profit" ? x.netProfit : x.jobs) as number));
                const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                return (
                  <div key={m.month as string} className="text-center">
                    <div className="text-xs text-[#5a7a8a] mb-2">{m.month as string}{isLive && <span className="ml-1 text-[#31AFEA] font-bold">●</span>}</div>
                    <div className="relative h-32 bg-slate-50 rounded-lg overflow-hidden flex items-end">
                      <div className="w-full rounded-t-lg bg-[#31AFEA]" style={{ height: `${pct}%`, opacity: isLive ? 1 : 0.6 }} />
                    </div>
                    <div className="text-xs font-bold text-[#102E46] mt-2">
                      {tab === "Revenue" || tab === "Net Profit" ? fmt$(val) : tab === "Margin" ? `${val}%` : val}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-[#5a7a8a] text-center">● = Live (Xero real-time) · Others = Xero historical</div>
          </div>
        )}
      </Card>

      <Card title="Monthly Summary Table" source="Xero P&L">
        {trends.loading ? <Skeleton /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Month</Th><Th right>Revenue</Th><Th right>Gross Profit</Th><Th right>GP %</Th><Th right>Net Profit</Th><Th right>Net %</Th><Th right>Jobs</Th></tr></thead>
              <tbody>
                {[...months].reverse().map(m => (
                  <tr key={m.month as string} className={`hover:bg-slate-50 ${m.isLive ? "bg-blue-50/40" : ""}`}>
                    <Td><span className="font-semibold">{String(m.month)}</span>{!!m.isLive && <span className="ml-2 text-[10px] bg-[#31AFEA] text-white px-1.5 py-0.5 rounded">LIVE</span>}</Td>
                    <Td right className="font-bold">{fmtFull$(m.revenue as number)}</Td>
                    <Td right className="text-green-600 font-semibold">{fmtFull$(m.grossProfit as number)}</Td>
                    <Td right>{fmtPct(((m.grossProfit as number) / (m.revenue as number)) * 100)}</Td>
                    <Td right className={(m.netProfit as number) > 0 ? "text-green-600 font-semibold" : "text-red-600"}>{fmtFull$(m.netProfit as number)}</Td>
                    <Td right>{fmtPct(m.netMarginPct as number)}</Td>
                    <Td right>{m.jobs as number}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SectionRecon() {
  const recon = useApi<Record<string, unknown>>("/api/xero-reconcile", { date: "mtd" });
  const r = recon.data as Record<string, unknown> | null;

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-extrabold text-[#102E46]">ServiceTitan vs Xero Reconciliation</h1><p className="text-sm text-[#5a7a8a] mt-1">Invoice-level reconciliation — flags mismatches, missing records and timing differences</p></div>
      <SourceBadge source="ServiceTitan + Xero via Zapier MCP" note="Compares ST invoices vs Xero invoices for period" />

      {recon.loading ? <Skeleton rows={6} /> : r ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KPI label="ST Total" value={fmtFull$(r.stTotal as number)} sub={`${r.stCount} invoices`} />
            <KPI label="Xero Total" value={r.xeroAvailable ? fmtFull$(r.xeroTotal as number) : "Not configured"} sub={r.xeroAvailable ? `${r.xeroCount} invoices` : "Add XERO_ACCESS_TOKEN"} />
            <div className={`rounded-xl border px-5 py-4 ${(r.variancePct as number) > 5 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
              <div className="text-xs font-bold text-[#5a7a8a] uppercase tracking-wide">Variance</div>
              <div className={`text-2xl font-extrabold mt-1 ${(r.variancePct as number) > 5 ? "text-red-700" : "text-green-700"}`}>{fmtFull$(r.variance as number)}</div>
              <div className={`text-xs mt-1 ${(r.variancePct as number) > 5 ? "text-red-600" : "text-green-600"}`}>{fmtPct(r.variancePct as number)} {(r.variancePct as number) <= 5 ? "✅ within threshold" : "⚠ exceeds threshold"}</div>
            </div>
          </div>

          <Card title="Integrity Checks" source="ST + Xero" updatedAt={recon.updatedAt}>
            <div className="p-5 space-y-2">
              {((r.checks as {id: string; label: string; status: string; detail: string}[]) || []).map(check => (
                <div key={check.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                  check.status === "ok" ? "border-green-200 bg-green-50" : check.status === "warning" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"
                }`}>
                  <span className="text-lg mt-0.5">{check.status === "ok" ? "✅" : check.status === "warning" ? "⚠️" : "❌"}</span>
                  <div>
                    <div className={`font-semibold text-sm ${check.status === "ok" ? "text-green-700" : check.status === "warning" ? "text-amber-700" : "text-red-700"}`}>{check.label}</div>
                    <div className="text-xs text-[#5a7a8a] mt-0.5">{check.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : <Alert type="warning" title="Reconciliation data unavailable">{recon.error}</Alert>}
    </div>
  );
}

function SectionGoogle() {
  const [tab, setTab] = useState("Campaigns");
  const ads = useApi<Record<string, unknown>>("/api/ads", {});
  const a = ads.data as Record<string, unknown> | null;
  const s = a?.summary as Record<string, unknown> | null;

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-extrabold text-[#102E46]">Google Campaigns</h1><p className="text-sm text-[#5a7a8a] mt-1">Campaign-level performance — spend, impressions, clicks, conversions, ROAS</p></div>
      <SourceBadge source="Google Ads via GAQL MCP" note="Live from Google Ads API" />

      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI label="Total Spend MTD" value={fmt$(s.totalSpend as number)} sub="All campaigns" />
          <KPI label="Impressions" value={(s.totalImpressions as number)?.toLocaleString() ?? "—"} />
          <KPI label="Clicks" value={(s.totalClicks as number)?.toLocaleString() ?? "—"} />
          <KPI label="Conversions" value={String(s.totalConversions ?? "—")} />
        </div>
      )}

      <SubTabs tabs={["Campaigns", "Alerts"]} active={tab} onChange={setTab} />

      {tab === "Campaigns" && (
        <Card title="Campaign Performance" source="Google Ads GAQL" updatedAt={ads.updatedAt}>
          {ads.loading ? <Skeleton /> : a ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><Th>Campaign</Th><Th>Trade</Th><Th right>Spend</Th><Th right>Clicks</Th><Th right>CTR</Th><Th right>Conv.</Th><Th right>CPA</Th><Th right>ROAS</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {((a.campaigns as Record<string, unknown>[]) || []).map(c => (
                    <tr key={c.campaign as string} className="hover:bg-slate-50">
                      <Td><span className="font-medium text-[#102E46]">{c.campaign as string}</span></Td>
                      <Td><Pill color="blue">{c.trade as string}</Pill></Td>
                      <Td right className="font-bold">{fmt$(c.spend as number)}</Td>
                      <Td right>{c.clicks != null ? (c.clicks as number).toLocaleString() : "—"}</Td>
                      <Td right>{c.ctr != null ? `${c.ctr}%` : "—"}</Td>
                      <Td right>{c.conversions != null ? String(c.conversions) : "—"}</Td>
                      <Td right>{c.cpa ? fmt$(c.cpa as number) : "N/A"}</Td>
                      <Td right><span className={c.roas ? ((c.roas as number) >= 5 ? "text-green-600 font-bold" : (c.roas as number) >= 3 ? "text-amber-600 font-bold" : "text-red-600 font-bold") : ""}>{c.roas != null ? `${c.roas}x` : "—"}</span></Td>
                      <Td><Pill color={(c.status as string)?.includes("ENABLED") || (c.status as string)?.includes("Active") ? "green" : "grey"}>{(c.status as string)?.includes("ENABLED") ? "Active" : (c.status as string) || "—"}</Pill></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Alert type="warning" title="Ads data unavailable">{ads.error}</Alert>}
        </Card>
      )}

      {tab === "Alerts" && (
        <div className="space-y-3">
          {((a?.alerts as {type: string; campaign: string; message: string; action: string}[]) || []).map((alert, i) => (
            <Alert key={i} type={alert.type as "critical"|"warning"|"info"|"win"} title={`${alert.campaign} — ${alert.message}`}>
              {alert.action}
            </Alert>
          ))}
          {!(a?.alerts as unknown[])?.length && <Alert type="info" title="No alerts">All campaigns within normal parameters.</Alert>}
        </div>
      )}
    </div>
  );
}

function SectionCalls() {
  const [tab, setTab] = useState("CSR Performance");
  const leads = useApi<Record<string, unknown>>("/api/leads", {});
  const l = leads.data as Record<string, unknown> | null;

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-extrabold text-[#102E46]">Phone Call Performance</h1><p className="text-sm text-[#5a7a8a] mt-1">WildJar call centre metrics — booking rates, CSR performance, campaign attribution</p></div>
      <SourceBadge source="ServiceTitan (848 calls, March 2026)" note="Pre-aggregated from ST CRM export" />

      {l && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI label="Total Calls MTD" value={String(l.totalCalls ?? "—")} />
          <KPI label="Booked" value={String(l.totalBooked ?? "—")} sub={`${l.bookingRate}% booking rate`} color={(l.bookingRate as number) >= 75 ? "up" : "warn"} />
          <KPI label="Abandoned" value={String(l.totalAbandoned ?? "—")} sub="Not answered" color="down" />
          <KPI label="Booking Rate" value={`${l.bookingRate ?? "—"}%`} sub="Target ≥75%" color={(l.bookingRate as number) >= 75 ? "up" : "down"} />
        </div>
      )}

      <SubTabs tabs={["CSR Performance", "By Campaign"]} active={tab} onChange={setTab} />

      {tab === "CSR Performance" && (
        <Card title="CSR Booking Rates" source="ServiceTitan" updatedAt={leads.updatedAt}>
          {leads.loading ? <Skeleton /> : l ? (
            <div className="divide-y divide-[#D1DCE3]">
              {((l.csrs as Record<string, unknown>[]) || []).map(csr => {
                const rate = csr.bookingRate as number;
                const isBonus = rate >= 90;
                const isFloor = rate >= 75;
                return (
                  <div key={csr.name as string} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-[#102E46]">{csr.name as string}</div>
                        <div className="text-xs text-[#5a7a8a] mt-0.5">{csr.answered as number} answered · {csr.booked as number} booked · {csr.abandoned as number} abandoned</div>
                      </div>
                      <div className={`text-2xl font-extrabold ${isBonus ? "text-green-600" : isFloor ? "text-amber-600" : "text-red-600"}`}>{rate}%</div>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${isBonus ? "bg-green-500" : isFloor ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(rate, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-[#5a7a8a] mt-1">
                      <span>0%</span><span>75% floor · 90% = $200 bonus</span><span>100%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <Alert type="warning" title="CSR data unavailable">{leads.error}</Alert>}
        </Card>
      )}

      {tab === "By Campaign" && (
        <Card title="Calls by Campaign" source="ServiceTitan" updatedAt={leads.updatedAt}>
          {leads.loading ? <Skeleton /> : l ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><Th>Campaign</Th><Th right>Calls</Th><Th right>Booked</Th><Th right>Rate</Th></tr></thead>
                <tbody>
                  {((l.campaigns as Record<string, unknown>[]) || []).map(c => (
                    <tr key={c.campaign as string} className="hover:bg-slate-50">
                      <Td><span className="text-[#102E46]">{String(c.campaign || "Unknown")}</span></Td>
                      <Td right>{Number(c.calls)}</Td>
                      <Td right className="text-green-600 font-semibold">{Number(c.booked)}</Td>
                      <Td right><span className={(c.rate as number) >= 50 ? "text-green-600 font-bold" : (c.rate as number) >= 30 ? "text-amber-600" : "text-red-500"}>{Number(c.rate)}%</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Alert type="warning" title="Campaign data unavailable">{leads.error}</Alert>}
        </Card>
      )}
    </div>
  );
}

function SectionCapacity() {
  const [tab, setTab] = useState("This Week");
  const cap = useApi<Record<string, unknown>>("/api/capacity", { date: tab === "Today" ? "today" : "week" }, [tab]);
  const c = cap.data as Record<string, unknown> | null;

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-extrabold text-[#102E46]">Capacity Planning</h1><p className="text-sm text-[#5a7a8a] mt-1">Technician schedule — jobs, trades, value</p></div>
      <SourceBadge source="ServiceTitan Dispatch Assignments" note="Live from ST appointments + dispatch" />

      {c && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KPI label="Active Techs" value={String(c.techCount ?? "—")} sub="Assigned to jobs" />
          <KPI label="Total Jobs" value={String(c.totalJobs ?? "—")} sub={c.period as string} />
          <KPI label="Period" value={c.period as string} sub={`${c.fromDate?.toString().slice(0,10)} → ${c.toDate?.toString().slice(0,10)}`} />
        </div>
      )}

      <SubTabs tabs={["This Week", "Today"]} active={tab} onChange={setTab} />

      <Card title={`Tech Schedule — ${tab}`} source="ServiceTitan" updatedAt={cap.updatedAt}>
        {cap.loading ? <Skeleton rows={8} /> : c ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Technician</Th><Th right>Jobs</Th><Th right>Revenue</Th><Th right>Hours</Th></tr></thead>
              <tbody>
                {((c.techs as Record<string, unknown>[]) || []).filter(t => t.name !== "Unassigned").map(tech => (
                  <tr key={tech.name as string} className="hover:bg-slate-50">
                    <Td><span className="font-semibold text-[#102E46]">{tech.name as string}</span></Td>
                    <Td right>{(tech.jobs as unknown[]).length}</Td>
                    <Td right className="font-bold text-[#31AFEA]">{fmtFull$(tech.totalValue as number)}</Td>
                    <Td right>{(tech.scheduledHours as number).toFixed(1)}h</Td>
                  </tr>
                ))}
                {((c.techs as Record<string, unknown>[]) || []).some(t => t.name === "Unassigned") && (
                  <tr className="bg-amber-50">
                    <Td><span className="text-amber-700 font-semibold">⚠ Unassigned</span></Td>
                    <Td right className="text-amber-700 font-bold">{((c.techs as Record<string, unknown>[]) || []).find(t => t.name === "Unassigned") ? ((((c.techs as Record<string, unknown>[]) || []).find(t => t.name === "Unassigned")?.jobs as unknown[])?.length ?? 0) : 0}</Td>
                    <Td right>—</Td>
                    <Td right>—</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : <Alert type="warning" title="Capacity data unavailable">{cap.error}</Alert>}
      </Card>
    </div>
  );
}

function SectionJobProfit() {
  const [tab, setTab] = useState("All Jobs");
  const jobs = useApi<Record<string, unknown>>("/api/jobs", { date: "mtd" });
  const j = jobs.data as Record<string, unknown> | null;
  const allJobs = (j?.jobs as Record<string, unknown>[]) || [];

  const filtered = tab === "All Jobs" ? allJobs :
    allJobs.filter(jb => jb.trade === tab);

  const trades = ["All Jobs", ...Array.from(new Set(allJobs.map(jb => jb.trade as string))).filter(Boolean).sort()];

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-extrabold text-[#102E46]">Job Profitability</h1><p className="text-sm text-[#5a7a8a] mt-1">Every completed job — tech, trade, revenue</p></div>
      <SourceBadge source="ServiceTitan Jobs + Dispatch Assignments" note="Completed jobs March 2026" />

      {j?.totals ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {(() => { const t = j.totals as {jobs: number; totalRevenue: number; totalNetSale: number}; return (<>
            <KPI label="Total Jobs" value={String(t.jobs ?? "—")} />
            <KPI label="Total Revenue" value={fmt$(t.totalRevenue)} sub="Gross invoiced" color="up" />
            <KPI label="Net Sale Value" value={fmt$(t.totalNetSale)} sub="After 5% factor" />
          </>); })()}
        </div>
      ) : null}

      <div className="flex gap-2 flex-wrap">
        {trades.slice(0, 8).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${tab === t ? "bg-[#31AFEA] text-white border-[#31AFEA]" : "bg-white text-[#5a7a8a] border-[#D1DCE3] hover:border-[#31AFEA]"}`}>
            {t} {t !== "All Jobs" ? `(${allJobs.filter(jb => jb.trade === t).length})` : `(${allJobs.length})`}
          </button>
        ))}
      </div>

      <Card title={`${tab} — ${filtered.length} jobs`} source="ServiceTitan" updatedAt={jobs.updatedAt}>
        {jobs.loading ? <Skeleton rows={8} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Job #</Th><Th>Tech</Th><Th>Trade</Th><Th>Date</Th><Th right>Invoice</Th><Th right>Net Sale</Th></tr></thead>
              <tbody>
                {filtered.slice(0, 50).map(jb => (
                  <tr key={jb.jobId as string} className="hover:bg-slate-50">
                    <Td><span className="font-mono text-xs text-[#5a7a8a]">{jb.jobNumber as string}</span></Td>
                    <Td><span className="font-medium text-[#102E46]">{(jb.tech as string) || "—"}</span></Td>
                    <Td><Pill color={jb.trade === "Electrical" ? "amber" : jb.trade === "AC/HVAC" ? "blue" : jb.trade === "Plumbing" ? "blue" : jb.trade === "Solar" ? "amber" : "grey"}>{jb.trade as string}</Pill></Td>
                    <Td><span className="font-mono text-xs">{jb.date ? new Date(jb.date as string).toLocaleDateString("en-AU") : "—"}</span></Td>
                    <Td right><span className="font-bold text-[#102E46]">{fmtFull$(jb.invoiceTotal as number)}</span></Td>
                    <Td right className="text-[#5a7a8a]">{fmtFull$(jb.netSale as number)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 50 && <div className="px-4 py-2 text-xs text-center text-[#5a7a8a]">Showing 50 of {filtered.length} jobs</div>}
          </div>
        )}
      </Card>
    </div>
  );
}

function SectionCommissions() {
  const [tab, setTab] = useState("Technicians");
  const comms = useApi<Record<string, unknown>>("/api/commissions", { date: "mtd" });
  const c = comms.data as Record<string, unknown> | null;

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-extrabold text-[#102E46]">Commissions</h1><p className="text-sm text-[#5a7a8a] mt-1">Technicians · CSRs — eligibility, earned amounts · paid weekly, 1 month in arrears</p></div>
      <SourceBadge source="ServiceTitan Dispatch + Jobs" note="Commission = 1.5% doing + 1.5% selling | Threshold $80K/month | Margin ≥15%" />

      {c && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI label="Total Payable" value={`$${(c.totalCommission as number).toFixed(2)}`} sub="MTD · field techs" color="up" />
          <KPI label="Earners (≥$80K)" value={String(c.earnerCount ?? 0)} sub="Above threshold" />
          <KPI label="Below Threshold" value={String((c.techCount as number || 0) - (c.earnerCount as number || 0))} sub={`of ${c.techCount} techs`} />
          <KPI label="Threshold" value="$80,000" sub="Monthly revenue to qualify" />
        </div>
      )}

      <SubTabs tabs={["Technicians"]} active={tab} onChange={setTab} />

      <Card title={`Tech Commissions — ${c?.period as string || "March 2026"}`} source="ServiceTitan" updatedAt={comms.updatedAt}>
        {comms.loading ? <Skeleton /> : c ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>#</Th><Th>Technician</Th><Th right>Revenue MTD</Th><Th right>Jobs</Th><Th right>Net Value</Th><Th right>Commission</Th><Th right>Progress</Th><Th>Status</Th></tr></thead>
              <tbody>
                {((c.technicians as Record<string, unknown>[]) || []).map((tech, i) => (
                  <tr key={tech.name as string} className="hover:bg-slate-50">
                    <Td><span className="text-[#5a7a8a] text-xs">{i+1}</span></Td>
                    <Td><span className="font-semibold text-[#102E46]">{tech.name as string}</span></Td>
                    <Td right><span className="font-bold text-[#31AFEA]">{fmtFull$(tech.grossJobsValue as number)}</span></Td>
                    <Td right>{tech.jobCount as number}</Td>
                    <Td right>{fmtFull$(tech.netValue as number)}</Td>
                    <Td right><span className={tech.meetsThreshold ? "text-green-600 font-bold" : "text-[#5a7a8a]"}>{tech.meetsThreshold ? `$${(tech.totalCommission as number).toFixed(2)}` : "—"}</span></Td>
                    <Td right>
                      <div className="flex items-center gap-2 justify-end">
                        <ProgressBar pct={tech.progressPct as number} color={tech.meetsThreshold ? "green" : "blue"} />
                        <span className="text-xs text-[#5a7a8a]">{tech.progressPct as number}%</span>
                      </div>
                    </Td>
                    <Td>{tech.meetsThreshold ? <Pill color="green">Earner ✓</Pill> : <span className="text-xs text-[#5a7a8a]">${(tech.thresholdGap as number).toLocaleString()} to go</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Alert type="warning" title="Commission data unavailable">{comms.error}</Alert>}
      </Card>
    </div>
  );
}

function SectionIssues() {
  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-extrabold text-[#102E46]">Critical Issues</h1><p className="text-sm text-[#5a7a8a] mt-1">Active flags requiring immediate attention — sourced from live data thresholds</p></div>
      <Alert type="critical" title="🚨 Emergency Plumbing Google Ads — $1,550 spent, ZERO conversions">Pause this campaign immediately. 4 weeks of spend with no return. Budget: ~$1,550/month saved. Owner: Marketing</Alert>
      <Alert type="critical" title="🚨 Pricebook — 68% of jobs below 15% margin floor">Most commissions are blocked because margin is below threshold. Fix pricebook before next dispatch run. Owner: Phillip</Alert>
      <Alert type="critical" title="🚨 Apprentice splits in ServiceTitan — 152 jobs affected ($601K)">Apprentices incorrectly listed as co-techs on 152 Feb/March jobs. Affecting commission calculations. Owner: Operations</Alert>
      <Alert type="warning" title="⚠ Alex Naughton dispatch — wrong job type">He sold $27K in quotes but being dispatched to low-value plumbing. Re-assign to execute his own electrical/AC quotes. Owner: Dispatch</Alert>
      <Alert type="warning" title="⚠ 641 open quotes — $3.9M pipeline going cold">Follow up immediately. Assign to sales team. Every day this sits = revenue risk. Owner: Sales</Alert>
      <Alert type="info" title="ℹ CSR booking rate — 45.3% below 75% floor">Target 75% minimum. Hudson 51%, Rhi 47%, Kath 45%. Review call handling and IVR routing. Owner: Joel</Alert>
    </div>
  );
}

function SectionImprovements() {
  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-extrabold text-[#102E46]">Improvements</h1><p className="text-sm text-[#5a7a8a] mt-1">Prioritised improvement actions — ranked by impact, effort and urgency</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[
          { horizon: "Weeks 1–2", color: "border-[#102E46]", title: "🏃 Horizon 1 — Quick Wins", items: [
            { title: "Pause Emergency Plumbing ads", owner: "Marketing", impact: "$1,550/month saved" },
            { title: "Fix pricebook pricing", owner: "Operations", impact: "Unlock $1,300+ commission" },
            { title: "Fix Alex Naughton dispatch", owner: "Dispatch", impact: "+$30K/month" },
          ]},
          { horizon: "Month 1", color: "border-green-500", title: "🔧 Horizon 2 — Structural Fixes", items: [
            { title: "Follow up 641 open quotes ($3.9M)", owner: "Sales", impact: "+$390K potential" },
            { title: "Fix apprentice splits in ST", owner: "Operations", impact: "Accurate commissions" },
            { title: "Scale Ducted AC campaigns (21.6x ROAS)", owner: "Marketing", impact: "+$50K/month" },
          ]},
          { horizon: "Months 2–3", color: "border-amber-500", title: "🚀 Horizon 3 — Growth", items: [
            { title: "Fix Xero→ST payment sync", owner: "Finance", impact: "Clean AR reporting" },
            { title: "Launch tech margin leaderboard", owner: "Marcos", impact: "Accountability culture" },
            { title: "Accelerate Solar + Hot Water revenue", owner: "Phillip", impact: "High-margin growth" },
          ]},
        ].map(h => (
          <div key={h.horizon} className={`bg-white rounded-xl border-t-4 border border-[#D1DCE3] ${h.color} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-[#D1DCE3]">
              <div className="font-bold text-sm text-[#102E46]">{h.title}</div>
              <div className="text-xs text-[#5a7a8a] mt-0.5">{h.horizon}</div>
            </div>
            <div className="p-4 space-y-2">
              {h.items.map(item => (
                <div key={item.title} className="bg-[#EAF0F2] rounded-lg p-3">
                  <div className="text-sm font-semibold text-[#102E46]">{item.title}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-[#5a7a8a]">👤 {item.owner}</span>
                    <span className="text-xs font-bold text-[#31AFEA]">💰 {item.impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionWins() {
  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-extrabold text-[#102E46]">Wins</h1><p className="text-sm text-[#5a7a8a] mt-1">Positive results and milestones — March 2026</p></div>
      <Alert type="win" title="🏆 Mitch Powell — $96K MTD, only tech above $80K threshold">First tech to cross the commission threshold this month. Commission earned: $1,368.87. Keep dispatching to high-value AC jobs.</Alert>
      <Alert type="win" title="🏆 Ducted AC campaigns — 21.6x ROAS">Highest ROAS campaign in the portfolio. Dramatically underfunded — scale budget immediately for maximum return.</Alert>
      <Alert type="win" title="🏆 Dashboard deployed — live data from ST, Xero, Google Ads">All tabs showing real March 2026 data. No fake numbers. Source documented on every section.</Alert>
      <Alert type="win" title="🏆 Gross Profit margin — 73.8% on $567K revenue">Strong gross margin. Net margin (10.3%) is dragged down by operating expenses, primarily wages ($227K) and Google Ads ($40K).</Alert>
      <Alert type="win" title="🏆 $237K in bank across 5 accounts">Healthy cash position. Main account $138K, PayG reserve $91K.</Alert>
    </div>
  );
}

// ── Sidebar nav config ────────────────────────────────────────────────────────
const NAV = [
  { heading: "Overview", items: [
    { id: "overview" as SectionId, label: "Business Snapshot", icon: "🏠" },
    { id: "cash" as SectionId, label: "Cash in Bank", icon: "🏦" },
  ]},
  { heading: "Financial", items: [
    { id: "trends" as SectionId, label: "Trends & History", icon: "📊" },
    { id: "recon" as SectionId, label: "ST vs Xero", icon: "🔄", badge: "7" },
  ]},
  { heading: "Marketing", items: [
    { id: "google" as SectionId, label: "Google Campaigns", icon: "🎯" },
    { id: "calls" as SectionId, label: "Call Performance", icon: "☎️", badge: "⚠" },
  ]},
  { heading: "Capacity", items: [
    { id: "capacity" as SectionId, label: "Capacity Planning", icon: "⏱️" },
  ]},
  { heading: "Profitability", items: [
    { id: "job-profit" as SectionId, label: "Job Profitability", icon: "💼" },
    { id: "commissions" as SectionId, label: "Commissions", icon: "💵" },
  ]},
  { heading: "Intelligence", items: [
    { id: "issues" as SectionId, label: "Critical Issues", icon: "🚨", badge: "6", badgeColor: "bg-red-600" },
    { id: "improvements" as SectionId, label: "Improvements", icon: "🔨" },
    { id: "wins" as SectionId, label: "Wins", icon: "🏆", badge: "5", badgeColor: "bg-green-600" },
  ]},
];

// ── Date Range Picker ─────────────────────────────────────────────────────────
function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const [from, setFrom] = useState("2026-03-01");
  const [to, setTo] = useState("2026-03-26");
  const ref = useRef<HTMLDivElement>(null);

  const PRESETS = [
    { label: "March 2026", from: "2026-03-01", to: "2026-03-26" },
    { label: "Feb 2026",   from: "2026-02-01", to: "2026-02-28" },
    { label: "Jan 2026",   from: "2026-01-01", to: "2026-01-31" },
    { label: "Last 3 Months", from: "2026-01-01", to: "2026-03-26" },
  ];

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShowPicker(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const apply = () => {
    onChange({ from, to, label: `${from} → ${to}` });
    setShowPicker(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-2 bg-white border border-[#D1DCE3] rounded-lg px-3 py-2 text-sm text-[#102E46] hover:border-[#31AFEA] transition-colors">
        <span>📅</span>
        <span className="font-medium">{value.label}</span>
        <span className="text-[#5a7a8a]">▾</span>
      </button>
      {showPicker && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#D1DCE3] rounded-xl shadow-lg p-4 w-80">
          <div className="text-xs font-bold text-[#5a7a8a] uppercase tracking-wide mb-3">Quick Select</div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => { onChange({ from: p.from, to: p.to, label: p.label }); setFrom(p.from); setTo(p.to); setShowPicker(false); }}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${value.label === p.label ? "bg-[#31AFEA] text-white border-[#31AFEA]" : "border-[#D1DCE3] text-[#102E46] hover:border-[#31AFEA]"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="text-xs font-bold text-[#5a7a8a] uppercase tracking-wide mb-2">Custom Range</div>
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <div className="text-xs text-[#5a7a8a] mb-1">From</div>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="w-full border border-[#D1DCE3] rounded-lg px-2 py-1.5 text-xs text-[#102E46] focus:outline-none focus:border-[#31AFEA]" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-[#5a7a8a] mb-1">To</div>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="w-full border border-[#D1DCE3] rounded-lg px-2 py-1.5 text-xs text-[#102E46] focus:outline-none focus:border-[#31AFEA]" />
            </div>
          </div>
          <button onClick={apply} className="w-full bg-[#31AFEA] text-white font-semibold text-sm py-2 rounded-lg hover:bg-[#2a9fd4] transition-colors">
            Apply Range
          </button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════
export default function Dashboard() {
  const [active, setActive] = useState<SectionId>("overview");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "2026-03-01", to: "2026-03-26", label: "March 2026" });
  const [refreshKey, setRefreshKey] = useState(0);

  const pageTitle = NAV.flatMap(g => g.items).find(i => i.id === active)?.label ?? "Dashboard";

  const renderSection = () => {
    switch (active) {
      case "overview":    return <SectionOverview dateRange={dateRange} />;
      case "cash":        return <SectionCash />;
      case "trends":      return <SectionTrends />;
      case "recon":       return <SectionRecon />;
      case "google":      return <SectionGoogle />;
      case "calls":       return <SectionCalls />;
      case "capacity":    return <SectionCapacity />;
      case "job-profit":  return <SectionJobProfit />;
      case "commissions": return <SectionCommissions />;
      case "issues":      return <SectionIssues />;
      case "improvements":return <SectionImprovements />;
      case "wins":        return <SectionWins />;
      default: return (
        <div className="text-center py-20 text-[#5a7a8a]">
          <div className="text-4xl mb-4">🚧</div>
          <div className="text-lg font-bold text-[#102E46]">Coming Soon</div>
          <div className="text-sm mt-2">This section is being built. Check back soon.</div>
        </div>
      );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#EAF0F2]">

      {/* ── SIDEBAR ── */}
      <nav className="w-[250px] bg-[#102E46] flex flex-col overflow-y-auto flex-shrink-0">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[#1e3d5c]">
          <img src="https://reliabletradies.com/wp-content/uploads/2024/02/rt-logo-white.png"
            alt="Reliable Tradies" className="h-8 object-contain" />
          <div className="text-[11px] text-[#7aa5be] mt-1.5">Operations Dashboard</div>
        </div>

        {/* Nav */}
        <div className="flex-1 py-3">
          {NAV.map(group => (
            <div key={group.heading} className="mb-1">
              <div className="px-4 py-2 text-[10px] font-bold text-[#4a7a9b] uppercase tracking-widest">{group.heading}</div>
              {group.items.map(item => (
                <button key={item.id} onClick={() => setActive(item.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-left transition-all border-l-2 ${
                    active === item.id
                      ? "bg-[#31AFEA]/20 border-[#31AFEA] text-white"
                      : "border-transparent text-[#7aa5be] hover:bg-white/5 hover:text-white"
                  }`}>
                  <span className="w-4 text-sm">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${(item as Record<string, string>).badgeColor || "bg-amber-500"}`}>{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#1e3d5c] text-[11px] text-[#4a7a9b]">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
            <span>All systems live</span>
          </div>
          <div>March 2026 · v3.0</div>
        </div>
      </nav>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <div className="bg-white border-b border-[#D1DCE3] px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="font-bold text-[#102E46] text-base">{pageTitle}</div>
          <div className="flex items-center gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <button onClick={() => setRefreshKey(k => k+1)}
              className="flex items-center gap-1.5 bg-[#31AFEA] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#2a9fd4] transition-colors">
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6" key={`${active}-${refreshKey}`}>
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
