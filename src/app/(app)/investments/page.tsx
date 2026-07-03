"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
import { uploadAttachment } from "@/components/attachment-uploader";
import { useDocumentScan } from "@/components/use-document-scan";
import { RowAttachments } from "@/components/row-attachments";
import { cleanAmount, cleanDate } from "@/lib/extract-fields";
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

const EMPTY_FORM = {
  name: "",
  type: INVESTMENT_TYPES[0],
  investedAmount: "",
  currentValue: "",
  purchaseDate: new Date().toISOString().slice(0, 10),
  maturityDate: "",
  expectedReturnRate: "",
  notes: "",
};

export default function InvestmentsPage() {
  const [items, setItems] = useState<Investment[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const matchType = (t: string | null | undefined) =>
    (t && INVESTMENT_TYPES.find((x) => x.toLowerCase() === t.toLowerCase())) || undefined;
  const { file, scanning, scanNote, fileInputRef, onFilePicked, reset } = useDocumentScan("investment", (f) =>
    setForm((prev) => ({
      ...prev,
      name: f.name || prev.name,
      type: matchType(f.type) || prev.type,
      investedAmount: cleanAmount(f.investedAmount) || prev.investedAmount,
      currentValue: cleanAmount(f.currentValue) || prev.currentValue,
      purchaseDate: cleanDate(f.purchaseDate) || prev.purchaseDate,
      maturityDate: cleanDate(f.maturityDate) || prev.maturityDate,
    }))
  );

  async function load() {
    const res = await fetch("/api/investments").then((r) => r.json());
    setItems(res.investments ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    reset();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to save");
      if (file) await uploadAttachment("investment", data.investment.id, file);
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
                  <div className="mt-1.5">
                    <RowAttachments module="investment" recordId={i.id} label={i.name} />
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
          resetForm();
        }}
        title="Add Investment"
      >
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
          <div>
            <label>Statement / Document — auto-fills the form (optional)</label>
            <label className="!mb-0 !normal-case !tracking-normal !text-sm !font-medium flex items-center gap-2 border-2 border-dashed border-border hover:border-accent/50 hover:bg-accent-glow rounded-xl px-3 py-2.5 cursor-pointer transition-colors text-muted">
              <span>{scanning ? "⏳" : "📎"}</span>
              <span className="truncate">
                {scanning ? "Reading document…" : file ? file.name : "Upload a statement (photo or PDF)"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.xls,.xlsx,.csv"
                capture="environment"
                onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            {scanNote && <div className="text-xs text-accent mt-1.5">{scanNote}</div>}
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
