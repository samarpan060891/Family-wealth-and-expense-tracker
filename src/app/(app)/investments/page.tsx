"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
import { useToast } from "@/components/toast";
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
  autoUpdate: boolean;
  symbol: string | null;
  quantity: string | null;
  lastPricedAt: string | null;
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
  autoUpdate: false,
  symbol: "",
  quantity: "",
};

// Investment types whose value tracks a live market price.
const MARKET_TYPES = new Set(["Mutual Fund", "Stocks", "ETF", "Gold", "Bonds", "Cryptocurrency"]);

export default function InvestmentsPage() {
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Investment[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
  }
  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditId(null);
    reset();
  }

  function openAdd() {
    resetForm();
    setError("");
    setOpen(true);
  }

  function openEdit(i: Investment) {
    setEditId(i.id);
    setError("");
    setForm({
      name: i.name,
      type: i.type,
      investedAmount: i.investedAmount,
      currentValue: i.currentValue ?? "",
      purchaseDate: i.purchaseDate,
      maturityDate: i.maturityDate ?? "",
      expectedReturnRate: i.expectedReturnRate ?? "",
      notes: i.notes ?? "",
      autoUpdate: i.autoUpdate,
      symbol: i.symbol ?? "",
      quantity: i.quantity ?? "",
    });
    setOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(editId ? `/api/investments/${editId}` : "/api/investments", {
        method: editId ? "PATCH" : "POST",
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

  async function refreshPrices() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/investments/refresh-prices", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(data.error ?? "Couldn't refresh prices.");
        return;
      }
      if (data.updated === 0 && data.failed === 0) {
        toastError("No auto-updating holdings yet. Add a symbol & quantity to a holding.");
      } else {
        success(`Updated ${data.updated} holding${data.updated === 1 ? "" : "s"}${data.failed ? `, ${data.failed} failed` : ""}.`);
      }
      load();
    } finally {
      setRefreshing(false);
    }
  }

  const hasAuto = items.some((i) => i.autoUpdate);

  const totalInvested = items.reduce((s, i) => s + Number(i.investedAmount), 0);
  const totalCurrent = items.reduce((s, i) => s + Number(i.currentValue ?? i.investedAmount), 0);
  const gain = totalCurrent - totalInvested;

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader
        title="Investments"
        sub={`${items.length} holdings`}
        action={
          <div className="flex gap-2">
            {hasAuto && (
              <Button variant="outline" onClick={refreshPrices} disabled={refreshing}>
                {refreshing ? "Refreshing…" : "↻ Prices"}
              </Button>
            )}
            <InvestmentImport onDone={load} />
            <Button onClick={openAdd}>+ Add</Button>
          </div>
        }
      />

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
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{i.name}</span>
                    {i.autoUpdate && <Badge tone="green">Auto</Badge>}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {i.type} · Since {i.purchaseDate}
                    {i.maturityDate ? ` · Matures ${i.maturityDate}` : ""}
                  </div>
                  {i.autoUpdate && (
                    <div className="text-[11px] text-muted-soft mt-0.5">
                      {i.symbol} · {i.quantity} units
                      {i.lastPricedAt
                        ? ` · priced ${new Date(i.lastPricedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
                        : " · not priced yet"}
                    </div>
                  )}
                  <div className="mt-1.5">
                    <RowAttachments module="investment" recordId={i.id} label={i.name} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 pl-3">
                  <div className="font-mono text-sm font-semibold text-green">
                    {fmtCurrency(Number(i.currentValue ?? i.investedAmount))}
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
          {MARKET_TYPES.has(form.type) && (
            <div className="border border-border rounded-xl p-3 bg-surface2/40">
              <label className="!mb-0 !normal-case flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  className="!w-auto"
                  checked={form.autoUpdate}
                  onChange={(e) => setForm({ ...form, autoUpdate: e.target.checked })}
                />
                Auto-update value from market price (weekly)
              </label>
              {form.autoUpdate && (
                <div className="mt-3 flex flex-col gap-2">
                  <div>
                    <label>Symbol / Scheme code</label>
                    <input
                      value={form.symbol}
                      onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                      placeholder={form.type === "Mutual Fund" ? "AMFI code e.g. 120503" : "Ticker e.g. AAPL, RELIANCE.NS, GOLDBEES.NS"}
                    />
                  </div>
                  <div>
                    <label>Quantity / Units held</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      placeholder="e.g. 25 shares / 340.5 units"
                    />
                  </div>
                  <p className="text-[11px] text-muted-soft leading-relaxed">
                    Value = quantity × latest price. Mutual funds use the AMFI scheme code (NAV in ₹); stocks/ETFs/metals use a
                    Yahoo Finance ticker (use <code>.NS</code>/<code>.BO</code> for NSE/BSE, e.g. GOLDBEES.NS for gold). Foreign
                    prices are converted to ₹ automatically.
                  </p>
                </div>
              )}
            </div>
          )}
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
