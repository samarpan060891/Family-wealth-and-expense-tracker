"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { Badge, Card, EmptyState, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
import { RemindersPanel } from "@/components/reminders-panel";

type Tx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  category: string;
  paymentMethod: string;
  note: string | null;
};

type Dashboard = {
  monthlyTrend: { month: string; income: number; expense: number }[];
  categoryBreakdown: { name: string; amount: number }[];
  netWorth: number;
  netWorthTrend: { date: string; netWorth: number }[];
  savingsRate: number | null;
  thisMonthIncome: number;
  recentTransactions: Tx[];
  displayCurrency: string;
  totals: { investments: number; assets: number; debts: number; thisMonthExpense: number };
  cashflowProjection: { month: string; projectedIncome: number; projectedExpense: number; net: number; cumulative: number }[];
  upcomingExpiries: { id: string; name: string; type: string; expiryDate: string; kind: string }[];
};

type Insight = { tone: "positive" | "warning" | "info" | "danger"; title: string; detail: string };
type Anomaly = { category: string; amount: number; date: string; note: string };
type Insights = {
  summary: string;
  aiGenerated: boolean;
  aiAvailable: boolean;
  insights: Insight[];
  anomalies: Anomaly[];
};

const TONE_STYLES: Record<Insight["tone"], { border: string; badge: "green" | "accent" | "blue" | "red"; label: string }> = {
  positive: { border: "border-l-green", badge: "green", label: "Good" },
  warning: { border: "border-l-accent", badge: "accent", label: "Watch" },
  info: { border: "border-l-blue", badge: "blue", label: "Tip" },
  danger: { border: "border-l-red", badge: "red", label: "Risk" },
};

// Distinct, theme-friendly palette for the pie slices.
const PIE_COLORS = ["#e8a33d", "#6fa1f5", "#4fd189", "#ef6a63", "#b58cf0", "#4ec9c9", "#f0a868", "#8ea0b8"];

const chartTooltip = {
  contentStyle: {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 12,
    fontFamily: "var(--font-mono)",
  },
  labelStyle: { color: "var(--muted)" },
};
const axisTick = { fill: "var(--muted)", fontSize: 10 };

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [drill, setDrill] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
    fetch("/api/insights")
      .then((r) => r.json())
      .then(setInsights)
      .catch(() => {});
  }, []);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const sortedCategories = useMemo(
    () => (data ? [...data.categoryBreakdown].sort((a, b) => b.amount - a.amount) : []),
    [data]
  );

  // Transactions behind the selected pie slice (this month, that category).
  const drillTx = useMemo(() => {
    if (!data || !drill) return [];
    return data.recentTransactions
      .filter((t) => t.type === "expense" && t.category === drill && t.date.startsWith(currentMonth))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [data, drill, currentMonth]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm font-mono animate-fade-in">
        Loading your dashboard…
      </div>
    );
  }

  const totalExpense = data.totals.thisMonthExpense;
  const cur = data.displayCurrency ?? "INR";

  return (
    <div className="flex flex-col gap-6 stagger">
      <PageHeader
        title="Good to see you,"
        accent="here's your overview"
        sub={new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
        action={
          <Link
            href="/reports"
            className="text-sm font-semibold text-accent border border-accent/50 hover:bg-accent-glow rounded-xl px-3.5 py-2 transition-colors whitespace-nowrap"
          >
            ⬇ Report
          </Link>
        }
      />

      {/* ACTION NEEDED — persistent reminders until marked done */}
      <RemindersPanel compact />

      {/* AI / SMART SUMMARY */}
      {insights?.summary && (
        <Card className="border-accent/25 bg-gradient-to-br from-accent/[0.07] to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">✨</span>
            <span className="text-sm font-bold">Your Money, Summarized</span>
            <span className="text-[10px] font-mono uppercase tracking-wide text-muted-soft ml-auto">
              {insights.aiGenerated ? "AI" : "Auto"}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-text">{insights.summary}</p>
        </Card>
      )}

      {/* QUICK OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label="Net Worth" value={fmtCurrency(data.netWorth, cur)} tone="accent" icon="◆" />
        <StatCard label="Total Assets" value={fmtCurrency(data.totals.assets, cur)} tone="green" icon="▣" />
        <StatCard label="Total Debts" value={fmtCurrency(data.totals.debts, cur)} tone="red" icon="◇" />
        <StatCard
          label="Savings Rate"
          value={data.savingsRate === null ? "—" : `${Math.round(data.savingsRate * 100)}%`}
          sub={data.savingsRate === null ? "Add income this month" : "of income this month"}
          tone="blue"
          icon="◈"
        />
      </div>

      {/* NET WORTH TREND */}
      <Card>
        <div className="text-sm font-bold mb-1 font-mono uppercase tracking-wide text-muted">
          Net Worth <span className="text-text normal-case font-sans">— over time</span>
        </div>
        <div className="text-xs text-muted-soft mb-4">Assets &amp; investments minus outstanding debt</div>
        {data.netWorthTrend.length < 2 ? (
          <EmptyState
            icon="◆"
            title="Building your history"
            sub="We snapshot your net worth daily — check back tomorrow to see the trend grow."
          />
        ) : (
          <div className="h-60 -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.netWorthTrend}>
                <defs>
                  <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e8a33d" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#e8a33d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ ...axisTick, fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(d: string) =>
                    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                  }
                />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickFormatter={(v: number) => fmtCurrency(v, cur).replace(/\.00$/, "")}
                />
                <Tooltip
                  {...chartTooltip}
                  formatter={(v) => [fmtCurrency(Number(v), cur), "Net Worth"]}
                  labelFormatter={(d) => new Date(String(d)).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                />
                <Area type="monotone" dataKey="netWorth" stroke="#e8a33d" strokeWidth={2.5} fill="url(#nwFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* ANOMALY ALERTS */}
      {insights?.anomalies && insights.anomalies.length > 0 && (
        <Card className="border-red/25 bg-gradient-to-br from-red/[0.05] to-transparent">
          <div className="flex items-center gap-2 text-sm font-bold mb-3 text-red">
            <span>◎</span> Unusual Spending Detected
          </div>
          <div className="flex flex-col gap-2">
            {insights.anomalies.map((a, idx) => (
              <div key={idx} className="flex justify-between items-center bg-surface2/60 border border-border-soft rounded-xl px-3.5 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold">{a.category}</div>
                  <div className="text-xs text-muted mt-0.5">{a.note}</div>
                </div>
                <div className="text-xs font-mono font-semibold text-red shrink-0 pl-3">{fmtCurrency(a.amount, cur)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* SMART INSIGHTS */}
      {insights?.insights && insights.insights.length > 0 && (
        <Card>
          <div className="text-sm font-bold mb-3 font-mono uppercase tracking-wide text-muted">
            Smart Insights &amp; Recommendations
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {insights.insights.map((ins, idx) => {
              const t = TONE_STYLES[ins.tone];
              return (
                <div key={idx} className={`border-l-2 ${t.border} bg-surface2/40 rounded-r-xl pl-3 pr-3 py-2.5`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone={t.badge}>{t.label}</Badge>
                    <span className="text-sm font-semibold">{ins.title}</span>
                  </div>
                  <div className="text-xs text-muted leading-relaxed">{ins.detail}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {data.upcomingExpiries.length > 0 && (
        <Card className="border-accent/25 bg-gradient-to-br from-accent/[0.06] to-transparent">
          <div className="flex items-center gap-2 text-sm font-bold mb-3 text-accent">
            <span>⚠</span> Upcoming Renewals &amp; Expiries
          </div>
          <div className="flex flex-col gap-2">
            {data.upcomingExpiries.map((e) => (
              <div
                key={e.id}
                className="flex justify-between items-center bg-surface2/60 border border-border-soft rounded-xl px-3.5 py-2.5 text-sm"
              >
                <div>
                  <div className="font-semibold">{e.name}</div>
                  <div className="text-xs text-muted capitalize">
                    {e.kind} · {e.type}
                  </div>
                </div>
                <div className="text-xs text-accent font-mono font-semibold">{e.expiryDate}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* CATEGORY PIE (with drill-down) + MONTHLY TREND */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold font-mono uppercase tracking-wide text-muted">
              Spending <span className="text-text normal-case font-sans">— this month</span>
            </div>
            {drill && (
              <button onClick={() => setDrill(null)} className="text-xs text-accent font-semibold">
                ← All categories
              </button>
            )}
          </div>

          {sortedCategories.length === 0 ? (
            <EmptyState icon="◾" title="No expenses yet" sub="Add your first expense to see a breakdown" />
          ) : drill ? (
            // DRILL-DOWN: transactions inside the selected category
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <span className="font-semibold">{drill}</span>
                <span className="font-mono text-sm text-red">
                  {fmtCurrency(sortedCategories.find((c) => c.name === drill)?.amount ?? 0, cur)}
                </span>
              </div>
              <div className="flex flex-col divide-y divide-border-soft max-h-72 overflow-y-auto">
                {drillTx.length === 0 ? (
                  <div className="text-sm text-muted-soft py-2">No individual transactions this month.</div>
                ) : (
                  drillTx.map((t) => (
                    <div key={t.id} className="flex justify-between items-center py-2 text-sm">
                      <div className="min-w-0">
                        <div className="text-xs text-muted">{t.date}</div>
                        {t.note && <div className="text-xs text-muted-soft truncate">{t.note}</div>}
                      </div>
                      <div className="font-mono text-red shrink-0 pl-3">{fmtCurrency(t.amount, cur)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-52 w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sortedCategories}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="85%"
                      paddingAngle={2}
                      onClick={(slice: { name?: string }) => slice?.name && setDrill(slice.name)}
                      className="cursor-pointer focus:outline-none"
                    >
                      {sortedCategories.map((c, i) => (
                        <Cell key={c.name} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="var(--surface)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip {...chartTooltip} formatter={(v) => fmtCurrency(Number(v), cur)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full sm:w-1/2 flex flex-col gap-1.5">
                {sortedCategories.map((c, i) => (
                  <button
                    key={c.name}
                    onClick={() => setDrill(c.name)}
                    className="flex items-center gap-2 text-left hover:bg-surface2 rounded-lg px-2 py-1 transition-colors"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-sm flex-1 truncate">{c.name}</span>
                    <span className="text-xs font-mono text-muted">
                      {totalExpense > 0 ? Math.round((c.amount / totalExpense) * 100) : 0}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="text-sm font-bold mb-4 font-mono uppercase tracking-wide text-muted">
            Monthly Trend <span className="text-text normal-case font-sans">— income vs expense</span>
          </div>
          {data.monthlyTrend.length === 0 ? (
            <EmptyState icon="◾" title="No data yet" />
          ) : (
            <div className="h-60 -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip {...chartTooltip} cursor={{ fill: "var(--surface3)", opacity: 0.4 }} />
                  <Bar dataKey="income" fill="#4fd189" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill="#ef6a63" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* RECENT TRANSACTIONS with search/filter */}
      <RecentTransactions transactions={data.recentTransactions} currency={cur} />

      {/* CASHFLOW PROJECTION */}
      <Card>
        <div className="text-sm font-bold mb-1 font-mono uppercase tracking-wide text-muted">
          Cashflow Projection <span className="text-text normal-case font-sans">— next 12 months</span>
        </div>
        <div className="text-xs text-muted-soft mb-4">
          Based on recurring income/expenses, active EMIs, insurance premiums &amp; recent discretionary average
        </div>
        <div className="h-64 -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.cashflowProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ ...axisTick, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip {...chartTooltip} cursor={{ stroke: "var(--border)" }} />
              <Line type="monotone" dataKey="cumulative" stroke="#e8a33d" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="net" stroke="#6fa1f5" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function RecentTransactions({ transactions, currency }: { transactions: Tx[]; currency: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (!q) return true;
      return (
        t.category.toLowerCase().includes(q) ||
        (t.note ?? "").toLowerCase().includes(q) ||
        t.amount.toString().includes(q)
      );
    });
  }, [transactions, query, filter]);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="text-sm font-bold font-mono uppercase tracking-wide text-muted">Recent Transactions</div>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(["all", "income", "expense"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 capitalize font-semibold transition-colors ${
                filter === f ? "bg-accent text-black" : "text-muted hover:bg-surface2"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search category, note or amount…"
        className="mb-3"
      />

      {transactions.length === 0 ? (
        <EmptyState icon="◾" title="No transactions yet" sub="Add income or expenses to see them here" />
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-soft py-4 text-center">No transactions match your search.</div>
      ) : (
        <div className="flex flex-col divide-y divide-border-soft max-h-96 overflow-y-auto">
          {filtered.map((t) => (
            <div key={t.id} className="flex justify-between items-center py-2.5">
              <div className="min-w-0 flex items-center gap-3">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    t.type === "income" ? "bg-green/10 text-green" : "bg-red/10 text-red"
                  }`}
                >
                  {t.type === "income" ? "▴" : "▾"}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{t.category}</div>
                  <div className="text-xs text-muted">
                    {t.date}
                    {t.note ? ` · ${t.note}` : ""}
                  </div>
                </div>
              </div>
              <div className={`font-mono text-sm font-semibold shrink-0 pl-3 ${t.type === "income" ? "text-green" : "text-red"}`}>
                {t.type === "income" ? "+" : "−"}
                {fmtCurrency(t.amount, currency)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
