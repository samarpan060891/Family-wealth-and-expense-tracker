"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
import { uploadAttachment } from "@/components/attachment-uploader";
import { useDocumentScan } from "@/components/use-document-scan";
import { RowAttachments } from "@/components/row-attachments";
import { cleanAmount, cleanDate } from "@/lib/extract-fields";
import { ASSET_TYPES } from "@/lib/categories";

type Asset = {
  id: string;
  name: string;
  type: string;
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
};

export default function AssetsPage() {
  const [items, setItems] = useState<Asset[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const matchType = (t: string | null | undefined) =>
    (t && ASSET_TYPES.find((x) => x.toLowerCase() === t.toLowerCase())) || undefined;
  const { file, scanning, scanNote, fileInputRef, onFilePicked, reset } = useDocumentScan("asset", (f) =>
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

  const total = items.reduce((s, i) => s + Number(i.value), 0);

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader title="Assets" sub={`${items.length} tracked`} action={<Button onClick={() => setOpen(true)}>+ Add</Button>} />

      <StatCard label="Total Asset Value" value={fmtCurrency(total)} tone="accent" icon="▣" />

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
                  <div className="font-mono text-sm font-semibold text-accent">{fmtCurrency(Number(i.value))}</div>
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
            <input
              type="number"
              required
              min="0"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
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
          <div>
            <label>Ownership Proof / Valuation — auto-fills the form (optional)</label>
            <label className="!mb-0 !normal-case !tracking-normal !text-sm !font-medium flex items-center gap-2 border-2 border-dashed border-border hover:border-accent/50 hover:bg-accent-glow rounded-xl px-3 py-2.5 cursor-pointer transition-colors text-muted">
              <span>{scanning ? "⏳" : "📎"}</span>
              <span className="truncate">
                {scanning ? "Reading document…" : file ? file.name : "Upload a document (photo or PDF)"}
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
