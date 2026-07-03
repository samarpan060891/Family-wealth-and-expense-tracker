"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
import { uploadAttachment } from "@/components/attachment-uploader";
import { useDocumentScan } from "@/components/use-document-scan";
import { DocumentScanField } from "@/components/document-scan-field";
import { RowAttachments } from "@/components/row-attachments";
import { AmortizationModal } from "@/components/amortization-modal";
import { cleanAmount } from "@/lib/extract-fields";
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

const EMPTY_FORM = {
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
};

export default function DebtsPage() {
  const [items, setItems] = useState<Debt[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [amortizationDebtId, setAmortizationDebtId] = useState<string | null>(null);
  const matchType = (t: string | null | undefined) =>
    (t && DEBT_TYPES.find((x) => x.toLowerCase() === t.toLowerCase())) || undefined;
  const { file, scanning, scanNote, onFilePicked, reset } = useDocumentScan("debt", (f) =>
    setForm((prev) => ({
      ...prev,
      name: f.name || prev.name,
      lender: f.lender || prev.lender,
      type: matchType(f.type) || prev.type,
      principal: cleanAmount(f.principal) || prev.principal,
      outstandingAmount: cleanAmount(f.outstandingAmount) || prev.outstandingAmount,
      interestRate: cleanAmount(f.interestRate) || prev.interestRate,
      emiAmount: cleanAmount(f.emiAmount) || prev.emiAmount,
    }))
  );

  async function load() {
    const res = await fetch("/api/debts").then((r) => r.json());
    setItems(res.debts ?? []);
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
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to save");
      if (file) await uploadAttachment("debt", data.debt.id, file);
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
                  <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                    <RowAttachments module="debt" recordId={i.id} label={i.name} />
                    {i.emiAmount && i.interestRate && (
                      <button
                        onClick={() => setAmortizationDebtId(i.id)}
                        className="text-xs text-blue hover:text-blue/80 transition-colors"
                      >
                        📊 Amortization
                      </button>
                    )}
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
          resetForm();
        }}
        title="Add Debt"
      >
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
          <DocumentScanField
            label="Loan Statement — auto-fills the form (optional)"
            scanning={scanning}
            scanNote={scanNote}
            file={file}
            onFilePicked={onFilePicked}
          />
          {error && <div className="text-red text-sm">{error}</div>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </Modal>

      <AmortizationModal debtId={amortizationDebtId} onClose={() => setAmortizationDebtId(null)} />
    </div>
  );
}
