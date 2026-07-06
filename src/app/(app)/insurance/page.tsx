"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
import { useCurrencyCtx } from "@/components/currency-context";
import { CurrencySelect } from "@/components/currency-select";
import { convertWith } from "@/lib/fx-convert";
import { uploadAttachment } from "@/components/attachment-uploader";
import { useDocumentScan } from "@/components/use-document-scan";
import { DocumentScanField } from "@/components/document-scan-field";
import { RowAttachments } from "@/components/row-attachments";
import { cleanAmount, cleanDate } from "@/lib/extract-fields";
import { INSURANCE_TYPES, FREQUENCIES } from "@/lib/categories";
import { helplinesForCountry } from "@/lib/helplines";

type Insurance = {
  id: string;
  name: string;
  type: string;
  currency: string;
  provider: string | null;
  policyNumber: string | null;
  premiumAmount: string;
  premiumFrequency: string;
  startDate: string;
  expiryDate: string;
  sumAssured: string | null;
  nominee: string | null;
  claimHelpline: string | null;
  insurerHelpline: string | null;
  agentName: string | null;
  agentPhone: string | null;
};

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function telHref(num: string) {
  return `tel:${num.replace(/[^0-9+]/g, "")}`;
}

const EMPTY_FORM = {
  name: "",
  type: INSURANCE_TYPES[0],
  provider: "",
  policyNumber: "",
  premiumAmount: "",
  premiumFrequency: "yearly",
  startDate: new Date().toISOString().slice(0, 10),
  expiryDate: "",
  sumAssured: "",
  nominee: "",
  claimHelpline: "",
  insurerHelpline: "",
  agentName: "",
  agentPhone: "",
  notes: "",
  currency: "INR",
};

export default function InsurancePage() {
  const { displayCurrency: viewerCurrency, defaultCurrency } = useCurrencyCtx();
  const [displayCurrency, setDisplayCurrency] = useState(viewerCurrency);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [items, setItems] = useState<Insurance[]>([]);
  const [country, setCountry] = useState("India");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, currency: defaultCurrency });
  const matchType = (t: string | null | undefined) =>
    (t && INSURANCE_TYPES.find((x) => x.toLowerCase() === t.toLowerCase())) || undefined;
  const { file, scanning, scanNote, onFilePicked, reset, saveToLibrary, setSaveToLibrary, saveToDocuments } = useDocumentScan("insurance", (f) =>
    setForm((prev) => ({
      ...prev,
      name: f.name || prev.name,
      type: matchType(f.type) || prev.type,
      provider: f.provider || prev.provider,
      policyNumber: f.policyNumber || prev.policyNumber,
      premiumAmount: cleanAmount(f.premiumAmount) || prev.premiumAmount,
      startDate: cleanDate(f.startDate) || prev.startDate,
      expiryDate: cleanDate(f.expiryDate) || prev.expiryDate,
      sumAssured: cleanAmount(f.sumAssured) || prev.sumAssured,
      nominee: f.nominee || prev.nominee,
      claimHelpline: f.claimHelpline || prev.claimHelpline,
      insurerHelpline: f.insurerHelpline || prev.insurerHelpline,
      agentName: f.agentName || prev.agentName,
      agentPhone: f.agentPhone || prev.agentPhone,
    }))
  );

  async function load() {
    const [insRes, setRes] = await Promise.all([
      fetch("/api/insurances").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setItems(insRes.insurances ?? []);
    if (insRes.displayCurrency) setDisplayCurrency(insRes.displayCurrency);
    if (insRes.rates) setRates(insRes.rates);
    if (setRes.settings?.country) setCountry(setRes.settings.country);
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
      const res = await fetch("/api/insurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to save");
      if (file) await uploadAttachment("insurance", data.insurance.id, file);
      await saveToDocuments(form.name || "Insurance policy", "insurance");
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
    await fetch(`/api/insurances/${id}`, { method: "DELETE" });
    load();
  }

  const totalPremium = items.reduce((s, i) => s + convertWith(Number(i.premiumAmount), i.currency, rates), 0);
  const totalCover = items.reduce((s, i) => s + convertWith(Number(i.sumAssured ?? 0), i.currency, rates), 0);
  const withContacts = items.filter(
    (i) => i.claimHelpline || i.insurerHelpline || i.agentPhone
  );
  const nationalHelplines = helplinesForCountry(country);

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader title="Insurance" sub={`${items.length} policies`} action={<Button onClick={() => setOpen(true)}>+ Add</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:gap-4">
        <StatCard label="Total Sum Assured" value={fmtCurrency(totalCover, displayCurrency)} tone="accent" icon="◉" />
        <StatCard label="Total Premiums / yr-equiv" value={fmtCurrency(totalPremium, displayCurrency)} tone="purple" icon="◐" />
      </div>

      {/* EMERGENCY CONTACTS & HELPLINES */}
      <Card className="border-red/25 bg-gradient-to-br from-red/[0.05] to-transparent">
        <div className="flex items-center gap-2 text-sm font-bold mb-1 text-red">
          <span>🆘</span> Emergency Contacts &amp; Helplines
        </div>
        <div className="text-xs text-muted-soft mb-3">
          Tap any number to call. Keep this handy so family can reach the insurer quickly during a claim.
        </div>

        {withContacts.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {withContacts.map((i) => (
              <div key={i.id} className="bg-surface2/60 border border-border-soft rounded-xl px-3.5 py-2.5">
                <div className="font-semibold text-sm">
                  {i.name} <span className="text-muted-soft font-normal">· {i.provider ?? i.type}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs">
                  {i.claimHelpline && (
                    <a href={telHref(i.claimHelpline)} className="text-accent font-semibold">
                      📞 Claims: {i.claimHelpline}
                    </a>
                  )}
                  {i.insurerHelpline && (
                    <a href={telHref(i.insurerHelpline)} className="text-accent font-semibold">
                      ☎ Care: {i.insurerHelpline}
                    </a>
                  )}
                  {i.agentPhone && (
                    <a href={telHref(i.agentPhone)} className="text-accent font-semibold">
                      👤 {i.agentName || "Agent"}: {i.agentPhone}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-[11px] font-mono uppercase tracking-wide text-muted mb-2">
          National Helplines · {country}
        </div>
        <div className="flex flex-wrap gap-2">
          {nationalHelplines.map((h) => (
            <a
              key={h.label}
              href={telHref(h.number)}
              className="text-xs bg-surface2 border border-border-soft rounded-lg px-2.5 py-1.5 hover:border-accent/50 transition-colors"
            >
              <span className="text-muted">{h.label}</span>{" "}
              <span className="text-accent font-semibold">{h.number}</span>
            </a>
          ))}
        </div>
        <div className="text-[11px] text-muted-soft mt-2">
          National numbers are a general reference — verify them and always use each policy&apos;s own claim number first.
        </div>
      </Card>

      <Card>
        {items.length === 0 ? (
          <EmptyState icon="◉" title="No policies recorded" sub="Track life, health, vehicle and home insurance with expiry alerts" />
        ) : (
          <div className="flex flex-col divide-y divide-border-soft">
            {items.map((i) => {
              const days = daysUntil(i.expiryDate);
              const urgent = days <= 30;
              return (
                <div key={i.id} className="flex justify-between items-start py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{i.name}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {i.type} {i.provider ? `· ${i.provider}` : ""}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      {urgent ? (
                        <Badge tone="red">Expires {i.expiryDate} · {days >= 0 ? `${days}d left` : "expired"}</Badge>
                      ) : (
                        <span className="text-xs text-muted-soft">
                          Expires {i.expiryDate} ({days}d left)
                        </span>
                      )}
                      {i.claimHelpline && (
                        <a href={telHref(i.claimHelpline)} className="text-xs text-accent hover:text-accent-soft">
                          📞 {i.claimHelpline}
                        </a>
                      )}
                      <RowAttachments module="insurance" recordId={i.id} label={i.name} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 pl-3">
                    <div className="font-mono text-sm font-semibold">{fmtCurrency(Number(i.premiumAmount), i.currency)}</div>
                    <button onClick={() => onDelete(i.id)} className="text-xs text-muted-soft hover:text-red transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="Add Insurance Policy"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <DocumentScanField
            label="Policy Copy — auto-fills the form (optional)"
            scanning={scanning}
            scanNote={scanNote}
            file={file}
            onFilePicked={onFilePicked}
            saveToLibrary={saveToLibrary}
            onSaveToLibraryChange={setSaveToLibrary}
          />
          <div>
            <label>Policy Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {INSURANCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Provider</label>
            <input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
          </div>
          <div>
            <label>Policy Number</label>
            <input value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />
          </div>
          <div>
            <label>Premium Amount</label>
            <div className="flex gap-2">
              <input
                type="number"
                required
                min="0"
                value={form.premiumAmount}
                onChange={(e) => setForm({ ...form, premiumAmount: e.target.value })}
                className="flex-1"
              />
              <CurrencySelect value={form.currency} onChange={(c) => setForm({ ...form, currency: c })} />
            </div>
          </div>
          <div>
            <label>Premium Frequency</label>
            <select
              value={form.premiumFrequency}
              onChange={(e) => setForm({ ...form, premiumFrequency: e.target.value })}
            >
              {FREQUENCIES.filter((f) => f.value !== "one_time").map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
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
            <label>Expiry / Renewal Date</label>
            <input
              type="date"
              required
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            />
          </div>
          <div>
            <label>Sum Assured (optional)</label>
            <input
              type="number"
              min="0"
              value={form.sumAssured}
              onChange={(e) => setForm({ ...form, sumAssured: e.target.value })}
            />
          </div>
          <div>
            <label>Nominee</label>
            <input value={form.nominee} onChange={(e) => setForm({ ...form, nominee: e.target.value })} />
          </div>

          <div className="border-t border-border-soft pt-3 mt-1">
            <div className="text-[11px] font-mono uppercase tracking-wide text-muted mb-2">
              Emergency Contacts (so family can reach the insurer)
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label>Claims / Emergency Helpline</label>
                <input
                  type="tel"
                  value={form.claimHelpline}
                  onChange={(e) => setForm({ ...form, claimHelpline: e.target.value })}
                  placeholder="e.g. 1800-xxx-xxxx"
                />
              </div>
              <div>
                <label>Customer Care Number</label>
                <input
                  type="tel"
                  value={form.insurerHelpline}
                  onChange={(e) => setForm({ ...form, insurerHelpline: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label>Agent Name</label>
                  <input value={form.agentName} onChange={(e) => setForm({ ...form, agentName: e.target.value })} />
                </div>
                <div>
                  <label>Agent Phone</label>
                  <input
                    type="tel"
                    value={form.agentPhone}
                    onChange={(e) => setForm({ ...form, agentPhone: e.target.value })}
                  />
                </div>
              </div>
            </div>
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
