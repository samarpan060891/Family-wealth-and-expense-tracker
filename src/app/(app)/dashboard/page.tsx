"use client";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { Badge, Card, EmptyState, PageHeader, StatCard, fmtCurrency } from "@/components/ui";

type Dashboard = {
  monthlyTrend: { month: string; income: number; expense: number }[];
  categoryBreakdown: { name: string; amount: number }[];
  netWorth: number;
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

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
    fetch("/api/insights")
      .then((r) => r.json())
      .then(setInsights)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm font-mono animate-fade-in">
        Loading your dashboard…
      </div>
    );
  }

  const sortedCategories = [...data.categoryBreakdown].sort((a, b) => b.amount - a.amount);
  const maxCategory = sortedCategories[0]?.amount ?? 1;

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
      />

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label="Net Worth" value={fmtCurrency(data.netWorth)} tone="accent" icon="◆" />
        <StatCard label="This Month Spend" value={fmtCurrency(data.totals.thisMonthExpense)} tone="red" icon="▾" />
        <StatCard label="Investments" value={fmtCurrency(data.totals.investments)} tone="green" icon="◈" />
        <StatCard label="Outstanding Debt" value={fmtCurrency(data.totals.debts)} tone="blue" icon="◇" />
      </div>

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
                <div className="text-xs font-mono font-semibold text-red shrink-0 pl-3">{fmtCurrency(a.amount)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* SMART INSIGHTS & RECOMMENDATIONS */}
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="text-sm font-bold mb-4 font-mono uppercase tracking-wide text-muted">
            Spending by Category <span className="text-text normal-case font-sans">— this month</span>
          </div>
          {sortedCategories.length === 0 ? (
            <EmptyState icon="◾" title="No expenses yet" sub="Add your first expense to see a breakdown" />
          ) : (
            <div className="flex flex-col gap-3">
              {sortedCategories.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium">{c.name}</span>
                    <span className="font-mono text-muted">{fmtCurrency(c.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent2 to-accent rounded-full transition-all duration-700"
                      style={{ width: `${(c.amount / maxCategory) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
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
