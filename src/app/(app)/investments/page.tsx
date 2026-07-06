"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useCurrencyCtx } from "@/components/currency-context";
import { CurrencySelect } from "@/components/currency-select";
import { convertWith } from "@/lib/fx-convert";
import { InvestmentImport } from "@/components/investment-import";
import { uploadAttachment } from "@/components/attachment-uploader";
import { useDocumentScan } from "@/components/use-document-scan";
import { DocumentScanField } from "@/components/document-scan-field";
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
  currency: string;
  location: string | null;
  sizeValue: string | null;
  sizeUnit: string | null;
  valuationNote: string | null;
};

const SIZE_UNITS = ["sqft", "sqm", "sqyd", "acre", "cent", "bigha", "marla"];

const EMPTY_FORM = {
  name: "",
  type: INVESTMENT_TYPES[0],
  investedAmount: "",
  currentValue: "",
  purchaseDate: new Date().toISOString().slice(0, 10),
  maturityDate: "",
  expectedReturnRate: "",
  notes: "",
  currency: "INR",
  location: "",
  sizeValue: "",
  sizeUnit: "sqft",
  valuationNote: "",
};

export default function InvestmentsPage() {
  const { success, error: toastError } = useToast();
  const { displayCurrency: viewerCurrency, defaultCurrency } = useCurrencyCtx();
  const [displayCurrency, setDisplayCurrency] = useState(viewerCurrency);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [items, setItems] = useState<Investment[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState<{
    estimatedValue: number | null;
    currency: string;
    confidence: string | null;
    summary: string;
    sources: { title: string; url: string }[];
    configured: boolean;
  } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const matchType = (t: string | null | undefined) =>
    (t && INVESTMENT_TYPES.find((x) => x.toLowerCase() === t.toLowerCase())) || undefined;
  const { file, scanning, scanNote, onFilePicked, reset } = useDocumentScan("investment", (f) =>
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
    if (res.displayCurrency) setDisplayCurrency(res.displayCurrency);
    if (res.rates) setRates(res.rates);
  }
  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm({ ...EMPTY_FORM, currency: defaultCurrency });
    setEditId(null);
    reset();
  }

  function openAdd() {
    resetForm();
    setError("");
    setEstimate(null);
    setOpen(true);
  }

  function openEdit(i: Investment) {
    setEditId(i.id);
    setError("");
    setEstimate(null);
    setForm({
      name: i.name,
      type: i.type,
      investedAmount: i.investedAmount,
      currentValue: i.currentValue ?? "",
      purchaseDate: i.purchaseDate,
      maturityDate: i.maturityDate ?? "",
      expectedReturnRate: i.expectedReturnRate ?? "",
      notes: i.notes ?? "",
      currency: i.currency ?? defaultCurrency,
      location: i.location ?? "",
      sizeValue: i.sizeValue ?? "",
      sizeUnit: i.sizeUnit ?? "sqft",
      valuationNote: i.valuationNote ?? "",
    });
    setOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // Drop empty optional fields so numeric coercion (e.g. sizeValue) doesn't reject "".
      const body = {
        ...form,
        sizeValue: form.sizeValue || undefined,
        location: form.location || undefined,
        sizeUnit: form.location ? form.sizeUnit : undefined,
        valuationNote: form.valuationNote || undefined,
      };
      const res = await fetch(editId ? `/api/investments/${editId}` : "/api/investments", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  async function runEstimate() {
    if (!form.location.trim()) return toastError("Enter the property area / location first.");
    setEstimating(true);
    setEstimate(null);
    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType: form.type,
          name: form.name || undefined,
          location: form.location,
          sizeValue: form.sizeValue || undefined,
          sizeUnit: form.sizeUnit || undefined,
          purchasePrice: form.investedAmount || undefined,
          purchaseDate: form.purchaseDate || undefined,
          currency: form.currency,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(data.error ?? "Couldn't estimate the value.");
        return;
      }
      setEstimate(data);
      if (data.configured === false) toastError("AI valuation needs ANTHROPIC_API_KEY set on the server.");
      else if (!data.estimatedValue) toastError("Couldn't find enough comparable data — try a more specific area.");
    } finally {
      setEstimating(false);
    }
  }

  function useEstimate() {
    if (!estimate?.estimatedValue) return;
    const src = estimate.sources.map((s) => s.url).join(" · ");
    const note = `AI estimate ${new Date().toISOString().slice(0, 10)} (${estimate.confidence ?? "?"} confidence): ${estimate.summary}${src ? ` Sources: ${src}` : ""}`;
    setForm((prev) => ({ ...prev, currentValue: String(estimate.estimatedValue), valuationNote: note }));
    success("Estimated value applied — review and save.");
  }

  // Totals convert each holding from its own currency to the viewer's display currency.
  const totalInvested = items.reduce((s, i) => s + convertWith(Number(i.investedAmount), i.currency, rates), 0);
  const totalCurrent = items.reduce((s, i) => s + convertWith(Number(i.currentValue ?? i.investedAmount), i.currency, rates), 0);
  const gain = totalCurrent - totalInvested;

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader
        title="Investments"
        sub={`${items.length} holdings`}
        action={
          <div className="flex gap-2">
            <InvestmentImport onDone={load} />
            <Button onClick={openAdd}>+ Add</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <StatCard label="Total Invested" value={fmtCurrency(totalInvested, displayCurrency)} tone="accent" icon="◈" />
        <StatCard label="Current Value" value={fmtCurrency(totalCurrent, displayCurrency)} tone="green" icon="◆" />
        <StatCard
          label="Unrealized Gain"
          value={`${gain >= 0 ? "+" : ""}${fmtCurrency(gain, displayCurrency)}`}
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
                    {i.location ? ` · ${i.location}` : ""}
                  </div>
                  <div className="mt-1.5">
                    <RowAttachments module="investment" recordId={i.id} label={i.name} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 pl-3">
                  <div className="font-mono text-sm font-semibold text-green">
                    {fmtCurrency(Number(i.currentValue ?? i.investedAmount), i.currency)}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(i)} className="text-xs text-accent hover:text-accent-soft transition-colors">
                      Edit
                    </button>
                    <button onClick={() => onDelete(i.id)} className="text-xs text-muted-soft hover:text-red transition-colors">
                      Delete
                    </button>
                  </div>
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
        title={editId ? "Edit Investment" : "Add Investment"}
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
            <div className="flex gap-2">
              <input
                type="number"
                required
                min="0"
                value={form.investedAmount}
                onChange={(e) => setForm({ ...form, investedAmount: e.target.value })}
                className="flex-1"
              />
              <CurrencySelect value={form.currency} onChange={(c) => setForm({ ...form, currency: c })} />
            </div>
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

          {form.type === "Real Estate" && (
            <div className="border border-border rounded-xl p-3 bg-surface2/40 flex flex-col gap-2.5">
              <div className="text-sm font-semibold">🏠 Property valuation</div>
              <div>
                <label>Area / location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Dubai Marina, Dubai / Whitefield, Bengaluru"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label>Size</label>
                  <input
                    type="number"
                    min="0"
                    value={form.sizeValue}
                    onChange={(e) => setForm({ ...form, sizeValue: e.target.value })}
                    placeholder="e.g. 1200"
                  />
                </div>
                <div>
                  <label>Unit</label>
                  <select value={form.sizeUnit} onChange={(e) => setForm({ ...form, sizeUnit: e.target.value })}>
                    {SIZE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={runEstimate} disabled={estimating} className="w-fit">
                {estimating ? "Searching recent listings…" : "🔍 Estimate current value"}
              </Button>
              {estimate && estimate.estimatedValue != null && (
                <div className="bg-surface2 border border-border-soft rounded-lg p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted">Estimated value</span>
                    <span className="text-[10px] font-mono uppercase text-muted-soft">
                      {estimate.confidence ?? "?"} confidence
                    </span>
                  </div>
                  <div className="text-xl font-bold font-mono text-green">
                    {fmtCurrency(estimate.estimatedValue, estimate.currency)}
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed">{estimate.summary}</p>
                  {estimate.sources.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {estimate.sources.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-accent underline truncate max-w-[10rem]"
                        >
                          {s.title}
                        </a>
                      ))}
                    </div>
                  )}
                  <Button type="button" onClick={useEstimate} className="mt-2" size="sm">
                    Use as current value
                  </Button>
                </div>
              )}
              <p className="text-[11px] text-muted-soft leading-relaxed">
                An AI estimate from recent comparable listings — a guide, not a formal appraisal. Always review before
                relying on it.
              </p>
            </div>
          )}

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
          <DocumentScanField
            label="Statement / Document — auto-fills the form (optional)"
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
    </div>
  );
}
