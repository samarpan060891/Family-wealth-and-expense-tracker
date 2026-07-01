"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, fmtCurrency } from "@/components/ui";
import { PAYMENT_METHODS, FREQUENCIES } from "@/lib/categories";
import { AttachmentUploader } from "@/components/attachment-uploader";

type Category = { id: string; name: string };
type Tx = {
  id: string;
  amount: string;
  date: string;
  paymentMethod: string;
  note: string | null;
  isRecurring: boolean;
  recurrenceFrequency: string;
  categoryId: string | null;
  categoryName: string | null;
};

export function TransactionModule({ type }: { type: "expense" | "income" }) {
  const [items, setItems] = useState<Tx[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    categoryId: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: "cash",
    note: "",
    isRecurring: false,
    recurrenceFrequency: "one_time",
  });

  async function load() {
    const [txRes, catRes] = await Promise.all([
      fetch(`/api/transactions?type=${type}`).then((r) => r.json()),
      fetch(`/api/categories?module=${type}`).then((r) => r.json()),
    ]);
    setItems(txRes.transactions ?? []);
    setCategories(catRes.categories ?? []);
  }

  useEffect(() => {
    load();
  }, [type]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...form }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to save");
      return;
    }
    setLastCreatedId(data.transaction.id);
    setForm({ ...form, amount: "", note: "" });
    load();
  }

  async function onDelete(id: string) {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    load();
  }

  const months = Array.from(new Set(items.map((i) => i.date.slice(0, 7)))).sort().reverse();
  const filtered = monthFilter ? items.filter((i) => i.date.startsWith(monthFilter)) : items;
  const total = filtered.reduce((s, i) => s + Number(i.amount), 0);

  const label = type === "expense" ? "Expense" : "Income";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{label}</h1>
        <Button onClick={() => setOpen(true)}>+ Add {label}</Button>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-muted">Total {monthFilter ? "(selected month)" : "(all time)"}</div>
          <select
            className="!w-auto text-xs py-1"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className={`text-2xl font-bold ${type === "expense" ? "text-red" : "text-green"}`}>
          {fmtCurrency(total)}
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState title={`No ${label.toLowerCase()} entries`} sub="Add your first entry above" />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((tx) => (
              <div key={tx.id} className="flex justify-between items-start border-b border-border/50 pb-2">
                <div>
                  <div className="font-semibold text-sm">{tx.categoryName ?? "Uncategorized"}</div>
                  <div className="text-xs text-muted">
                    {tx.date} · {PAYMENT_METHODS.find((p) => p.value === tx.paymentMethod)?.label}
                    {tx.isRecurring ? ` · Recurring (${tx.recurrenceFrequency})` : ""}
                  </div>
                  {tx.note && <div className="text-xs text-muted mt-0.5">{tx.note}</div>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="font-mono text-sm">{fmtCurrency(Number(tx.amount))}</div>
                  <button onClick={() => onDelete(tx.id)} className="text-xs text-muted hover:text-red">
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
          setLastCreatedId(null);
        }}
        title={lastCreatedId ? "Add attachment" : `Add ${label}`}
      >
        {lastCreatedId ? (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-green">{label} saved. Optionally attach proof below.</div>
            <AttachmentUploader module={type} recordId={lastCreatedId} />
            <Button
              onClick={() => {
                setOpen(false);
                setLastCreatedId(null);
              }}
              className="w-full"
            >
              Done
            </Button>
          </div>
        ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div>
            <label>Category</label>
            <select
              required
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">-- Select --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <label>Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div>
            <label>Source / Payment Method</label>
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            >
              {PAYMENT_METHODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              className="!w-auto"
              id="recurring"
              checked={form.isRecurring}
              onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
            />
            <label htmlFor="recurring" className="!mb-0 normal-case text-sm text-text">
              This repeats regularly (e.g. auto-debit / salary)
            </label>
          </div>
          {form.isRecurring && (
            <div>
              <label>Frequency</label>
              <select
                value={form.recurrenceFrequency}
                onChange={(e) => setForm({ ...form, recurrenceFrequency: e.target.value })}
              >
                {FREQUENCIES.filter((f) => f.value !== "one_time").map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label>Note</label>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Optional description"
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
