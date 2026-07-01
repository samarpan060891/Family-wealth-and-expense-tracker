"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, fmtCurrency } from "@/components/ui";
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Investments</h1>
        <Button onClick={() => setOpen(true)}>+ Add</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-xs text-muted mb-1">Total Invested</div>
          <div className="text-lg font-bold">{fmtCurrency(totalInvested)}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted mb-1">Current Value</div>
          <div className="text-lg font-bold text-green">{fmtCurrency(totalCurrent)}</div>
        </Card>
      </div>

      <Card>
        {items.length === 0 ? (
          <EmptyState title="No investments yet" sub="Add mutual funds, stocks, FDs, PPF, gold and more" />
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((i) => (
              <div key={i.id} className="flex justify-between items-start border-b border-border/50 pb-2">
                <div>
                  <div className="font-semibold text-sm">{i.name}</div>
                  <div className="text-xs text-muted">
                    {i.type} · Since {i.purchaseDate}
                    {i.maturityDate ? ` · Matures ${i.maturityDate}` : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="font-mono text-sm">
                    {fmtCurrency(Number(i.currentValue ?? i.investedAmount))}
                  </div>
                  <button onClick={() => onDelete(i.id)} className="text-xs text-muted hover:text-red">
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
