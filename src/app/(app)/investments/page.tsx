"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
import { AttachmentUploader } from "@/components/attachment-uploader";
import { INVESTMENT_TYPES } from "@/lib/categories";

type Investment = {
  id: string;
  name: string;
  type: string;
  investedAmount: string;
  currentValue: string | null;
  purchaseDate: string;
  maturityDate: string | null;
  expectedReturnRate: string | null;
  notes: string | null;
};

export default function InvestmentsPage() {
  const [items, setItems] = useState<Investment[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: INVESTMENT_TYPES[0],
    investedAmount: "",
    currentValue: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    maturityDate: "",
    expectedReturnRate: "",
    notes: "",
  });

  async function load() {
    const res = await fetch("/api/investments").then((r) => r.json());
    setItems(res.investments ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed to save");
    setCreatedId(data.investment.id);
    load();
  }

  async function onDelete(id: string) {
    await fetch(`/api/investments/${id}`, { method: "DELETE" });
    load();
  }

  const totalInvested = items.reduce((s, i) => s + Number(i.investedAmount), 0);
  const totalCurrent = items.reduce((s, i) => s + Number(i.currentValue ?? i.investedAmount), 0);

  const gain = totalCurrent - totalInvested;

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader title="Investments" sub={`${items.length} holdings`} action={<Button onClick={() => setOpen(true)}>+ Add</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <StatCard label="Total Invested" value={fmtCurrency(totalInvested)} tone="accent" icon="◈" />
        <StatCard label="Current Value" value={fmtCurrency(totalCurrent)} tone="green" icon="◆" />
        <StatCard
          label="Unrealized Gain"
          value={`${gain >= 0 ? "+" : ""}${fmtCurrency(gain)}`}
          tone={gain >= 0 ? "green" : "red"}
          icon={gain >= 0 ? "▴" : "▾"}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <Card>
        {items.length === 0 ? (
          <EmptyState icon="◈" title="No investments yet" sub="Add mutual funds, stocks, FDs, PPF, gold and more" />
        ) : (
          <div className="flex flex-col divide-y divide-border-soft">
            {items.map((i) => (
              <div key={i.id} className="flex justify-between items-start py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{i.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {i.type} · Since {i.purchaseDate}
                    {i.maturityDate ? ` · Matures ${i.maturityDate}` : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 pl-3">
                  <div className="font-mono text-sm font-semibold text-green">
                    {fmtCurrency(Number(i.currentValue ?? i.investedAmount))}
                  </div>
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
        title={createdId ? "Add attachment" : "Add Investment"}
      >
        {createdId ? (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-green">Saved. Optionally attach a statement.</div>
            <AttachmentUploader module="investment" recordId={createdId} />
            <Button
              onClick={() => {
                setOpen(false);
                setCreatedId(null);
              }}
              className="w-full"
            >
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
                {INVESTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Invested Amount</label>
              <input
                type="number"
                required
                min="0"
                value={form.investedAmount}
                onChange={(e) => setForm({ ...form, investedAmount: e.target.value })}
              />
            </div>
            <div>
              <label>Current Value (optional)</label>
              <input
                type="number"
                min="0"
                value={form.currentValue}
                onChange={(e) => setForm({ ...form, currentValue: e.target.value })}
              />
            </div>
            <div>
              <label>Purchase Date</label>
              <input
                type="date"
                required
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
              />
            </div>
            <div>
              <label>Maturity Date (optional)</label>
              <input
                type="date"
                value={form.maturityDate}
                onChange={(e) => setForm({ ...form, maturityDate: e.target.value })}
              />
            </div>
            <div>
              <label>Expected Return Rate % (optional)</label>
              <input
                type="number"
                step="0.1"
                value={form.expectedReturnRate}
                onChange={(e) => setForm({ ...form, expectedReturnRate: e.target.value })}
              />
            </div>
            <div>
              <label>Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
