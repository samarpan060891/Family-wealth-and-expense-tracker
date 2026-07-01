"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
import { AttachmentUploader } from "@/components/attachment-uploader";
import { DEBT_TYPES } from "@/lib/categories";

type Debt = {
  id: string;
  name: string;
  lender: string | null;
  type: string;
  principal: string;
  outstandingAmount: string;
  interestRate: string | null;
  emiAmount: string | null;
  startDate: string;
  endDate: string | null;
};

export default function DebtsPage() {
  const [items, setItems] = useState<Debt[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    lender: "",
    type: DEBT_TYPES[0],
    principal: "",
    outstandingAmount: "",
    interestRate: "",
    emiAmount: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    notes: "",
  });

  async function load() {
    const res = await fetch("/api/debts").then((r) => r.json());
    setItems(res.debts ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed to save");
    setCreatedId(data.debt.id);
    load();
  }

  async function onDelete(id: string) {
    await fetch(`/api/debts/${id}`, { method: "DELETE" });
    load();
  }

  const totalOutstanding = items.reduce((s, i) => s + Number(i.outstandingAmount), 0);
  const totalEmi = items.reduce((s, i) => s + Number(i.emiAmount ?? 0), 0);

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader title="Debts / Loans" sub={`${items.length} accounts`} action={<Button onClick={() => setOpen(true)}>+ Add</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:gap-4">
        <StatCard label="Total Outstanding" value={fmtCurrency(totalOutstanding)} tone="red" icon="◇" />
        <StatCard label="Monthly EMI" value={fmtCurrency(totalEmi)} tone="blue" icon="▾" />
      </div>

      <Card>
        {items.length === 0 ? (
          <EmptyState icon="◇" title="No debts recorded" sub="Track loans, credit cards, EMIs and payoff dates" />
        ) : (
          <div className="flex flex-col divide-y divide-border-soft">
            {items.map((i) => (
              <div key={i.id} className="flex justify-between items-start py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{i.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {i.type} {i.lender ? `· ${i.lender}` : ""}
                    {i.endDate ? ` · Closes ${i.endDate}` : ""}
                    {i.emiAmount ? ` · EMI ${fmtCurrency(Number(i.emiAmount))}` : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 pl-3">
                  <div className="font-mono text-sm font-semibold text-red">{fmtCurrency(Number(i.outstandingAmount))}</div>
                  <button onClick={() => onDelete(i.id)} className="text-xs text-muted-soft hover:text-red transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setCreatedId(null);
        }}
        title={createdId ? "Add attachment" : "Add Debt"}
      >
        {createdId ? (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-green">Saved. Optionally attach a loan statement.</div>
            <AttachmentUploader module="debt" recordId={createdId} />
            <Button onClick={() => { setOpen(false); setCreatedId(null); }} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div>
              <label>Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {DEBT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Lender</label>
              <input value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })} />
            </div>
            <div>
              <label>Principal Amount</label>
              <input
                type="number"
                required
                min="0"
                value={form.principal}
                onChange={(e) => setForm({ ...form, principal: e.target.value })}
              />
            </div>
            <div>
              <label>Outstanding Amount</label>
              <input
                type="number"
                required
                min="0"
                value={form.outstandingAmount}
                onChange={(e) => setForm({ ...form, outstandingAmount: e.target.value })}
              />
            </div>
            <div>
              <label>Interest Rate % (optional)</label>
              <input
                type="number"
                step="0.1"
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
              />
            </div>
            <div>
              <label>EMI Amount (optional)</label>
              <input
                type="number"
                min="0"
                value={form.emiAmount}
                onChange={(e) => setForm({ ...form, emiAmount: e.target.value })}
              />
            </div>
            <div>
              <label>Start Date</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label>Expected Payoff / End Date (optional)</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            {error && <div className="text-red text-sm">{error}</div>}
            <Button type="submit" className="w-full">
              Save
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
