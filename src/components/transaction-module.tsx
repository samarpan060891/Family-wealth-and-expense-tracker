"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader, fmtCurrency } from "@/components/ui";
import { PAYMENT_METHODS, FREQUENCIES } from "@/lib/categories";
import { uploadAttachment } from "@/components/attachment-uploader";
import { RowAttachments } from "@/components/row-attachments";

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
  const [saving, setSaving] = useState(false);
  const [monthFilter, setMonthFilter] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  function resetForm() {
    setForm({
      categoryId: "",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: "cash",
      note: "",
      isRecurring: false,
      recurrenceFrequency: "one_time",
    });
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
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
      if (file) {
        await uploadAttachment(type, data.transaction.id, file);
      }
      setOpen(false);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    load();
  }

  const months = Array.from(new Set(items.map((i) => i.date.slice(0, 7)))).sort().reverse();
  const filtered = monthFilter ? items.filter((i) => i.date.startsWith(monthFilter)) : items;
  const total = filtered.reduce((s, i) => s + Number(i.amount), 0);

  const label = type === "expense" ? "Expense" : "Income";
  const tone = type === "expense" ? "text-red" : "text-green";

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader
        title={label}
        sub={`${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}`}
        action={<Button onClick={() => setOpen(true)}>+ Add {label}</Button>}
      />

      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted">
            Total {monthFilter ? "· selected month" : "· all time"}
          </div>
          <select
            className="!w-auto text-xs py-1.5"
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
        <div className={`text-3xl font-bold font-mono ${tone}`}>{fmtCurrency(total)}</div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={type === "expense" ? "▾" : "▴"}
            title={`No ${label.toLowerCase()} entries`}
            sub="Add your first entry above"
          />
        ) : (
          <div className="flex flex-col divide-y divide-border-soft">
            {filtered.map((tx) => (
              <div key={tx.id} className="flex justify-between items-start py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{tx.categoryName ?? "Uncategorized"}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {tx.date} · {PAYMENT_METHODS.find((p) => p.value === tx.paymentMethod)?.label}
                    {tx.isRecurring ? ` · Recurring (${tx.recurrenceFrequency})` : ""}
                  </div>
                  {tx.note && <div className="text-xs text-muted-soft mt-0.5 truncate">{tx.note}</div>}
                  <div className="mt-1.5">
                    <RowAttachments module={type} recordId={tx.id} label={tx.categoryName ?? label} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 pl-3">
                  <div className={`font-mono text-sm font-semibold ${tone}`}>{fmtCurrency(Number(tx.amount))}</div>
                  <button onClick={() => onDelete(tx.id)} className="text-xs text-muted-soft hover:text-red transition-colors">
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
          resetForm();
        }}
        title={`Add ${label}`}
      >
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
          <div>
            <label>Bill / Receipt (optional)</label>
            <label className="!mb-0 !normal-case !tracking-normal !text-sm !font-medium flex items-center gap-2 border-2 border-dashed border-border hover:border-accent/50 hover:bg-accent-glow rounded-xl px-3 py-2.5 cursor-pointer transition-colors text-muted">
              <span>📎</span>
              <span className="truncate">{file ? file.name : "Capture a photo or upload PDF / Excel"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.xls,.xlsx,.csv"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </div>
          {error && <div className="text-red text-sm">{error}</div>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
