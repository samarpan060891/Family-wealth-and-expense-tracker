"use client";
import { useEffect, useState } from "react";
import { Modal, fmtCurrency } from "@/components/ui";

type Row = { month: number; date: string; emi: number; principal: number; interest: number; balance: number };
type Result = {
  debt: { name: string; outstandingAmount: string };
  schedule: Row[];
  totalInterest: number;
  totalPaid: number;
  monthsToPayoff: number;
  payoffDate: string | null;
  warning: string | null;
};

export function AmortizationModal({ debtId, onClose }: { debtId: string | null; onClose: () => void }) {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!debtId) {
      setData(null);
      setError("");
      return;
    }
    fetch(`/api/debts/${debtId}/amortization`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed to load schedule");
        return json;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [debtId]);

  return (
    <Modal open={!!debtId} onClose={onClose} title={data ? `Amortization · ${data.debt.name}` : "Amortization Schedule"}>
      {error && <div className="text-red text-sm">{error}</div>}
      {!error && !data && <div className="text-muted text-sm font-mono">Loading…</div>}
      {data && (
        <div className="flex flex-col gap-4">
          {data.warning && (
            <div className="text-red text-sm bg-red/10 border border-red/20 rounded-lg px-3 py-2">{data.warning}</div>
          )}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-surface2 rounded-xl p-3">
              <div className="text-[10px] text-muted font-mono uppercase">Months Left</div>
              <div className="text-lg font-bold font-mono">{data.monthsToPayoff}</div>
            </div>
            <div className="bg-surface2 rounded-xl p-3">
              <div className="text-[10px] text-muted font-mono uppercase">Payoff Date</div>
              <div className="text-sm font-bold font-mono mt-1">{data.payoffDate ?? "—"}</div>
            </div>
            <div className="bg-surface2 rounded-xl p-3">
              <div className="text-[10px] text-muted font-mono uppercase">Total Interest</div>
              <div className="text-sm font-bold font-mono mt-1 text-red">{fmtCurrency(data.totalInterest)}</div>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-muted font-mono uppercase text-[10px] tracking-wide border-b border-border-soft">
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Date</th>
                  <th className="text-right py-2">EMI</th>
                  <th className="text-right py-2">Principal</th>
                  <th className="text-right py-2">Interest</th>
                  <th className="text-right py-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.schedule.map((r) => (
                  <tr key={r.month} className="border-b border-border-soft/50">
                    <td className="py-1.5 text-muted-soft">{r.month}</td>
                    <td className="py-1.5">{r.date}</td>
                    <td className="py-1.5 text-right font-mono">{fmtCurrency(r.emi)}</td>
                    <td className="py-1.5 text-right font-mono text-green">{fmtCurrency(r.principal)}</td>
                    <td className="py-1.5 text-right font-mono text-red">{fmtCurrency(r.interest)}</td>
                    <td className="py-1.5 text-right font-mono text-muted">{fmtCurrency(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
