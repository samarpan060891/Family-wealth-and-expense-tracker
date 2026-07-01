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
import { Card, EmptyState, fmtCurrency } from "@/components/ui";

type Dashboard = {
  monthlyTrend: { month: string; income: number; expense: number }[];
  categoryBreakdown: { name: string; amount: number }[];
  netWorth: number;
  totals: { investments: number; assets: number; debts: number; thisMonthExpense: number };
  cashflowProjection: { month: string; projectedIncome: number; projectedExpense: number; net: number; cumulative: number }[];
  upcomingExpiries: { id: string; name: string; type: string; expiryDate: string; kind: string }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className="text-muted text-sm">Loading...</div>;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Overview</h1>
        <div className="text-muted text-xs">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-xs text-muted mb-1">Net Worth</div>
          <div className="text-lg font-bold text-accent">{fmtCurrency(data.netWorth)}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted mb-1">This Month Spend</div>
          <div className="text-lg font-bold text-red">{fmtCurrency(data.totals.thisMonthExpense)}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted mb-1">Investments</div>
          <div className="text-lg font-bold text-green">{fmtCurrency(data.totals.investments)}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted mb-1">Outstanding Debt</div>
          <div className="text-lg font-bold text-blue">{fmtCurrency(data.totals.debts)}</div>
        </Card>
      </div>

      {data.upcomingExpiries.length > 0 && (
        <Card>
          <div className="text-sm font-bold mb-3">⚠️ Upcoming Renewals / Expiries</div>
          <div className="flex flex-col gap-2">
            {data.upcomingExpiries.map((e) => (
              <div key={e.id} className="flex justify-between items-center bg-surface2 rounded-lg px-3 py-2 text-sm">
                <div>
                  <div className="font-semibold">{e.name}</div>
                  <div className="text-xs text-muted capitalize">{e.kind} · {e.type}</div>
                </div>
                <div className="text-xs text-accent font-mono">{e.expiryDate}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="text-sm font-bold mb-3">Spending by Category (This Month)</div>
        {data.categoryBreakdown.length === 0 ? (
          <EmptyState title="No expenses yet" sub="Add your first expense to see a breakdown" />
        ) : (
          <div className="flex flex-col gap-2">
            {data.categoryBreakdown
              .sort((a, b) => b.amount - a.amount)
              .map((c) => (
                <div key={c.name} className="flex justify-between text-sm border-b border-border/50 pb-2">
                  <span>{c.name}</span>
                  <span className="font-mono text-muted">{fmtCurrency(c.amount)}</span>
                </div>
              ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="text-sm font-bold mb-3">Monthly Trend (Income vs Expense)</div>
        {data.monthlyTrend.length === 0 ? (
          <EmptyState title="No data yet" />
        ) : (
          <div className="h-56 -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
                <XAxis dataKey="month" tick={{ fill: "#7a7d94", fontSize: 10 }} />
                <YAxis tick={{ fill: "#7a7d94", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1a1c25", border: "1px solid #2a2d3e" }} />
                <Bar dataKey="income" fill="#4ecb71" radius={4} />
                <Bar dataKey="expense" fill="#e05555" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <div className="text-sm font-bold mb-1">Cashflow Projection (Next 12 Months)</div>
        <div className="text-xs text-muted mb-3">
          Based on recurring income/expenses, EMIs, insurance premiums &amp; recent discretionary average
        </div>
        <div className="h-56 -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.cashflowProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
              <XAxis dataKey="month" tick={{ fill: "#7a7d94", fontSize: 9 }} />
              <YAxis tick={{ fill: "#7a7d94", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#1a1c25", border: "1px solid #2a2d3e" }} />
              <Line type="monotone" dataKey="cumulative" stroke="#f0a500" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="net" stroke="#5b8dee" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
