"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
import { useCurrencyCtx } from "@/components/currency-context";
import { CurrencySelect } from "@/components/currency-select";
import { convertWith } from "@/lib/fx-convert";
import { ValueEstimator } from "@/components/value-estimator";
import { uploadAttachment } from "@/components/attachment-uploader";
import { useDocumentScan } from "@/components/use-document-scan";
import { DocumentScanField } from "@/components/document-scan-field";
import { RowAttachments } from "@/components/row-attachments";
import { cleanAmount, cleanDate } from "@/lib/extract-fields";
import { ASSET_TYPES } from "@/lib/categories";

type Asset = {
  id: string;
  name: string;
  type: string;
  currency: string;
  value: string;
  purchaseDate: string | null;
  notes: string | null;
};

const EMPTY_FORM = {
  name: "",
  type: ASSET_TYPES[0],
  value: "",
  purchaseDate: "",
  notes: "",
  currency: "INR",
};

// Asset types where an AI value estimate is worthwhile.
const ESTIMABLE = new Set(["Real Estate", "Vehicle", "Gold / Jewellery"]);

export default function AssetsPage() {
  const { displayCurrency: viewerCurrency, defaultCurrency } = useCurrencyCtx();
  const [displayCurrency, setDisplayCurrency] = useState(viewerCurrency);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [items, setItems] = useState<Asset[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, currency: defaultCurrency });
  const matchType = (t: string | null | undefined) =>
    (t && ASSET_TYPES.find((x) => x.toLowerCase() === t.toLowerCase())) || undefined;
  const { file, scanning, scanNote, onFilePicked, reset } = useDocumentScan("asset", (f) =>
    setForm((prev) => ({
      ...prev,
      name: f.name || prev.name,
      type: matchType(f.type) || prev.type,
      value: cleanAmount(f.value) || prev.value,
      purchaseDate: cleanDate(f.purchaseDate) || prev.purchaseDate,
    }))
  );

  async function load() {
    const res = await fetch("/api/assets").then((r) => r.json());
    setItems(res.assets ?? []);
    if (res.displayCurrency) setDisplayCurrency(res.displayCurrency);
    if (res.rates) setRates(res.rates);
  }
  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm({ ...EMPTY_FORM, currency: defaultCurrency });
    reset();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to save");
      if (file) await uploadAttachment("asset", data.asset.id, file);
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
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
    load();
  }

  const total = items.reduce((s, i) => s + convertWith(Number(i.value), i.currency, rates), 0);

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader title="Assets" sub={`${items.length} tracked`} action={<Button onClick={() => setOpen(true)}>+ Add</Button>} />

      <StatCard label="Total Asset Value" value={fmtCurrency(total, displayCurrency)} tone="accent" icon="▣" />

      <Card>
        {items.length === 0 ? (
          <EmptyState icon="▣" title="No assets recorded" sub="Track property, vehicles, gold and more" />
        ) : (
          <div className="flex flex-col divide-y divide-border-soft">
            {items.map((i) => (
              <div key={i.id} className="flex justify-between items-start py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{i.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {i.type}
                    {i.purchaseDate ? ` · Bought ${i.purchaseDate}` : ""}
                  </div>
                  <div className="mt-1.5">
                    <RowAttachments module="asset" recordId={i.id} label={i.name} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 pl-3">
                  <div className="font-mono text-sm font-semibold text-accent">{fmtCurrency(Number(i.value), i.currency)}</div>
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
        title="Add Asset"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div>
            <label>Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Current Value</label>
            <div className="flex gap-2">
              <input
                type="number"
                required
                min="0"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="flex-1"
              />
              <CurrencySelect value={form.currency} onChange={(c) => setForm({ ...form, currency: c })} />
            </div>
          </div>

          {ESTIMABLE.has(form.type) && (
            <ValueEstimator
              assetType={form.type}
              name={form.name}
              currency={form.currency}
              purchasePrice={form.value}
              purchaseDate={form.purchaseDate}
              onApply={(v) => setForm((prev) => ({ ...prev, value: String(v) }))}
            />
          )}

          <div>
            <label>Purchase Date (optional)</label>
            <input
              type="date"
              value={form.purchaseDate}
              onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
            />
          </div>
          <div>
            <label>Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DocumentScanField
            label="Ownership Proof / Valuation — auto-fills the form (optional)"
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
