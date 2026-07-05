"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader, fmtCurrency } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useCurrencyCtx } from "@/components/currency-context";
import { CurrencySelect } from "@/components/currency-select";
import { convertWith } from "@/lib/fx-convert";
import { PAYMENT_METHODS, FREQUENCIES } from "@/lib/categories";
import { uploadAttachment, scanDocument } from "@/components/attachment-uploader";
import { DocumentScanField } from "@/components/document-scan-field";
import { RowAttachments } from "@/components/row-attachments";
import { cleanAmount } from "@/lib/extract-fields";

type Category = { id: string; name: string };
type Tx = {
  id: string;
  amount: string;
  currency: string;
  isTransfer: boolean;
  date: string;
  paymentMethod: string;
  note: string | null;
  isRecurring: boolean;
  recurrenceFrequency: string;
  categoryId: string | null;
  categoryName: string | null;
};

export function TransactionModule({ type }: { type: "expense" | "income" }) {
  const { success, error: toastError } = useToast();
  const { displayCurrency: viewerCurrency, defaultCurrency } = useCurrencyCtx();
  const [items, setItems] = useState<Tx[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [monthFilter, setMonthFilter] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState(viewerCurrency);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [form, setForm] = useState({
    categoryId: "",
    amount: "",
    currency: defaultCurrency,
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: "cash",
    note: "",
    isTransfer: false,
    isRecurring: false,
    recurrenceFrequency: "one_time",
  });

  async function load() {
    try {
      const [txRes, catRes] = await Promise.all([
        fetch(`/api/transactions?type=${type}`).then((r) => r.json()),
        fetch(`/api/categories?module=${type}`).then((r) => r.json()),
      ]);
      setItems(txRes.transactions ?? []);
      setCategories(catRes.categories ?? []);
      if (txRes.displayCurrency) setDisplayCurrency(txRes.displayCurrency);
      if (txRes.rates) setRates(txRes.rates);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [type]);

  // Create a category on the fly from the Add form and select it.
  async function createCategory() {
    const name = newCat.trim();
    if (!name) return;
    setSavingCat(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: type, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(data.error ?? "Couldn't add category.");
        return;
      }
      const catRes = await fetch(`/api/categories?module=${type}`).then((r) => r.json());
      const list: Category[] = catRes.categories ?? [];
      setCategories(list);
      const created = list.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (created) setForm((prev) => ({ ...prev, categoryId: created.id }));
      setNewCat("");
      setAddingCat(false);
      success("Category added.");
    } finally {
      setSavingCat(false);
    }
  }

  function resetForm() {
    setForm({
      categoryId: "",
      amount: "",
      currency: defaultCurrency,
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: "cash",
      note: "",
      isTransfer: false,
      isRecurring: false,
      recurrenceFrequency: "one_time",
    });
    setFile(null);
    setScanNote("");
  }

  async function onFilePicked(picked: File | null) {
    setFile(picked);
    setScanNote("");
    if (!picked) return;
    setScanning(true);
    try {
      const res = await scanDocument(type, picked);
      if (res.configured === false) {
        setScanNote("Attached. (Auto-detect is off — set ANTHROPIC_API_KEY to read documents.)");
        return;
      }
      const f = res.fields ?? {};
      const matchedCat = f.categoryName
        ? categories.find((c) => c.name.toLowerCase() === String(f.categoryName).toLowerCase())
        : undefined;
      setForm((prev) => ({
        ...prev,
        amount: cleanAmount(f.amount) || prev.amount,
        date: f.date || prev.date,
        categoryId: matchedCat?.id || prev.categoryId,
        paymentMethod: f.paymentMethod || prev.paymentMethod,
        note: f.note || prev.note,
      }));
      const got = Object.values(f).filter(Boolean).length;
      setScanNote(got ? "Scanned the document and pre-filled what we could — please review." : "Couldn't read details from this file — please fill them in.");
    } catch {
      setScanNote("Couldn't scan this file — you can still fill it in manually.");
    } finally {
      setScanning(false);
    }
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
      success(`${label} saved.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(`Delete this ${label.toLowerCase()} entry?`)) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) {
      success(`${label} deleted.`);
      load();
    } else {
      toastError("Could not delete this entry.");
    }
  }

  const months = Array.from(new Set(items.map((i) => i.date.slice(0, 7)))).sort().reverse();
  const filtered = monthFilter ? items.filter((i) => i.date.startsWith(monthFilter)) : items;
  // Total is in the viewer's display currency, converting each entry from its own.
  // Credit-card bill payments / transfers are excluded so card purchases (already
  // recorded individually) aren't double-counted.
  const spending = filtered.filter((i) => !i.isTransfer);
  const total = spending.reduce((s, i) => s + convertWith(Number(i.amount), i.currency, rates), 0);
  const transferCount = filtered.length - spending.length;
  const mixedCurrencies = new Set(spending.map((i) => i.currency)).size > 1;

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
        <div className={`text-3xl font-bold font-mono ${tone}`}>{fmtCurrency(total, displayCurrency)}</div>
        {mixedCurrencies && (
          <div className="text-[11px] text-muted-soft mt-1">Converted to {displayCurrency} at current rates</div>
        )}
        {transferCount > 0 && (
          <div className="text-[11px] text-muted-soft mt-1">
            {transferCount} card-bill/transfer {transferCount === 1 ? "entry" : "entries"} excluded from this total
          </div>
        )}
      </Card>

      <Card>
        {loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex justify-between items-center py-1">
                <div className="flex-1">
                  <div className="h-3 w-32 bg-surface3 rounded mb-2" />
                  <div className="h-2.5 w-24 bg-surface3 rounded" />
                </div>
                <div className="h-3 w-16 bg-surface3 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
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
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{tx.categoryName ?? "Uncategorized"}</span>
                    {tx.isTransfer && (
                      <span className="text-[10px] font-semibold text-muted bg-surface3 rounded-full px-2 py-0.5">
                        Transfer
                      </span>
                    )}
                  </div>
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
                  <div className={`font-mono text-sm font-semibold ${tx.isTransfer ? "text-muted-soft" : tone}`}>
                    {fmtCurrency(Number(tx.amount), tx.currency)}
                  </div>
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
        {categories.length === 0 ? (
          <div className="text-sm text-muted-soft">
            You don&apos;t have permission to add {label.toLowerCase()} entries in any category. Ask the main
            account holder to grant you edit access under Family Sharing.
          </div>
        ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div>
            <div className="flex items-center justify-between">
              <label>Category</label>
              {!addingCat && (
                <button
                  type="button"
                  onClick={() => setAddingCat(true)}
                  className="text-xs font-semibold text-accent hover:text-accent-soft mb-1.5"
                >
                  ＋ New
                </button>
              )}
            </div>
            {addingCat ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      createCategory();
                    }
                    if (e.key === "Escape") {
                      setAddingCat(false);
                      setNewCat("");
                    }
                  }}
                  placeholder={`New ${label.toLowerCase()} category`}
                  maxLength={80}
                  className="flex-1"
                />
                <Button type="button" onClick={createCategory} disabled={savingCat}>
                  {savingCat ? "…" : "Add"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setAddingCat(false);
                    setNewCat("");
                  }}
                >
                  ✕
                </Button>
              </div>
            ) : (
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
            )}
          </div>
          <div>
            <label>Amount</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="flex-1"
              />
              <CurrencySelect value={form.currency} onChange={(c) => setForm({ ...form, currency: c })} />
            </div>
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
          {type === "expense" && (
            <div className="border border-border rounded-xl p-3 bg-surface2/40">
              <label className="!mb-0 !normal-case flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  className="!w-auto"
                  checked={form.isTransfer}
                  onChange={(e) => setForm({ ...form, isTransfer: e.target.checked })}
                />
                Credit-card bill payment / transfer
              </label>
              <p className="text-[11px] text-muted-soft mt-1.5 leading-relaxed">
                Tick this when you&apos;re recording a credit-card bill payment or moving money between accounts. It&apos;s
                kept for your records but <b>excluded from spending totals</b>, so purchases you already logged on the card
                aren&apos;t counted twice.
              </p>
            </div>
          )}
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
          <DocumentScanField
            label="Bill / Receipt — auto-fills the form (optional)"
            scanning={scanning}
            scanNote={scanNote}
            file={file}
            onFilePicked={(f) => onFilePicked(f)}
          />
          {error && <div className="text-red text-sm">{error}</div>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
        )}
      </Modal>
    </div>
  );
}
