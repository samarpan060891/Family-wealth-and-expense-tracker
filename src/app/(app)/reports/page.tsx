"use client";
import { useEffect, useMemo, useState } from "react";
import { fmtCurrency } from "@/components/ui";

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
  netWorth: number;
  savingsRate: number | null;
  thisMonthIncome: number;
  totals: { investments: number; assets: number; debts: number; thisMonthExpense: number };
  categoryBreakdown: { name: string; amount: number }[];
  recentTransactions: Tx[];
};

function monthLabel(iso: string) {
  return new Date(iso + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function ReportsPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const monthTx = useMemo(
    () => (data?.recentTransactions ?? []).filter((t) => t.date.startsWith(currentMonth)),
    [data, currentMonth]
  );

  if (!data) {
    return <div className="text-muted text-sm font-mono py-10 text-center">Preparing your report…</div>;
  }

  const income = data.thisMonthIncome;
  const expense = data.totals.thisMonthExpense;
  const net = income - expense;
  const sortedCats = [...data.categoryBreakdown].sort((a, b) => b.amount - a.amount);

  return (
    <div className="report-root max-w-3xl mx-auto">
      {/* Screen-only toolbar (hidden when printing) */}
      <div className="print:hidden flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <div className="font-display text-2xl font-semibold">Monthly Report</div>
          <div className="text-sm text-muted">{monthLabel(currentMonth)}</div>
        </div>
        <button
          onClick={() => window.print()}
          className="text-sm font-semibold bg-accent text-black rounded-xl px-4 py-2.5 hover:opacity-90 transition-opacity"
        >
          ⬇ Download / Print PDF
        </button>
      </div>

      {/* The report itself */}
      <div className="report-sheet bg-surface rounded-2xl border border-border-soft p-6 sm:p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-border-soft pb-4 mb-5">
          <div>
            <div className="font-display text-xl font-semibold text-accent italic">FamilyWealth</div>
            <div className="text-xs text-muted mt-0.5">Monthly Financial Summary</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">{monthLabel(currentMonth)}</div>
            <div className="text-xs text-muted">
              Generated {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <ReportStat label="Net Worth" value={fmtCurrency(data.netWorth)} />
          <ReportStat label="Total Assets" value={fmtCurrency(data.totals.assets)} />
          <ReportStat label="Total Debts" value={fmtCurrency(data.totals.debts)} />
          <ReportStat
            label="Savings Rate"
            value={data.savingsRate === null ? "—" : `${Math.round(data.savingsRate * 100)}%`}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <ReportStat label="Income" value={fmtCurrency(income)} tone="green" />
          <ReportStat label="Expenses" value={fmtCurrency(expense)} tone="red" />
          <ReportStat label="Net Saved" value={fmtCurrency(net)} tone={net >= 0 ? "green" : "red"} />
        </div>

        <div className="mb-6">
          <div className="text-xs font-mono uppercase tracking-wide text-muted mb-2">Spending by Category</div>
          {sortedCats.length === 0 ? (
            <div className="text-sm text-muted-soft">No expenses recorded this month.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {sortedCats.map((c) => (
                  <tr key={c.name} className="border-b border-border-soft last:border-0">
                    <td className="py-1.5">{c.name}</td>
                    <td className="py-1.5 text-right font-mono">{fmtCurrency(c.amount)}</td>
                    <td className="py-1.5 text-right text-muted w-14">
                      {expense > 0 ? Math.round((c.amount / expense) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div className="text-xs font-mono uppercase tracking-wide text-muted mb-2">
            Transactions ({monthTx.length})
          </div>
          {monthTx.length === 0 ? (
            <div className="text-sm text-muted-soft">No transactions this month.</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[22rem]">
              <thead>
                <tr className="text-muted text-left">
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 font-medium">Category</th>
                  <th className="py-1 font-medium">Type</th>
                  <th className="py-1 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {monthTx.map((t) => (
                  <tr key={t.id} className="border-t border-border-soft">
                    <td className="py-1.5">{t.date}</td>
                    <td className="py-1.5">{t.category}</td>
                    <td className="py-1.5 capitalize">{t.type}</td>
                    <td className={`py-1.5 text-right font-mono ${t.type === "income" ? "text-green" : "text-red"}`}>
                      {fmtCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportStat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  const toneClass = tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-text";
  return (
    <div className="bg-surface2 border border-border-soft rounded-xl px-3 py-2.5 print:bg-transparent">
      <div className="text-[10px] font-mono uppercase tracking-wide text-muted mb-1">{label}</div>
      <div className={`text-base font-bold font-mono ${toneClass}`}>{value}</div>
    </div>
  );
}
