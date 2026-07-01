"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, fmtCurrency } from "@/components/ui";
import { AttachmentUploader } from "@/components/attachment-uploader";
import { INSURANCE_TYPES, FREQUENCIES } from "@/lib/categories";

type Insurance = {
  id: string;
  name: string;
  type: string;
  provider: string | null;
  policyNumber: string | null;
  premiumAmount: string;
  premiumFrequency: string;
  startDate: string;
  expiryDate: string;
  sumAssured: string | null;
  nominee: string | null;
};

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function InsurancePage() {
  const [items, setItems] = useState<Insurance[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({
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
    notes: "",
  });

  async function load() {
    const res = await fetch("/api/insurances").then((r) => r.json());
    setItems(res.insurances ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/insurances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed to save");
    setCreatedId(data.insurance.id);
    load();
  }

  async function onDelete(id: string) {
    await fetch(`/api/insurances/${id}`, { method: "DELETE" });
    load();
  }

  const totalPremium = items.reduce((s, i) => s + Number(i.premiumAmount), 0);
  const totalCover = items.reduce((s, i) => s + Number(i.sumAssured ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Insurance</h1>
        <Button onClick={() => setOpen(true)}>+ Add</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-xs text-muted mb-1">Total Sum Assured</div>
          <div className="text-lg font-bold text-accent">{fmtCurrency(totalCover)}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted mb-1">Total Premiums</div>
          <div className="text-lg font-bold">{fmtCurrency(totalPremium)}</div>
        </Card>
      </div>

      <Card>
        {items.length === 0 ? (
          <EmptyState title="No policies recorded" sub="Track life, health, vehicle and home insurance with expiry alerts" />
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((i) => {
              const days = daysUntil(i.expiryDate);
              const urgent = days <= 30;
              return (
                <div key={i.id} className="flex justify-between items-start border-b border-border/50 pb-2">
                  <div>
                    <div className="font-semibold text-sm">{i.name}</div>
                    <div className="text-xs text-muted">
                      {i.type} {i.provider ? `· ${i.provider}` : ""}
                    </div>
                    <div className={`text-xs mt-0.5 ${urgent ? "text-red font-semibold" : "text-muted"}`}>
                      Expires {i.expiryDate} ({days >= 0 ? `${days} days left` : "expired"})
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="font-mono text-sm">{fmtCurrency(Number(i.premiumAmount))}</div>
                    <button onClick={() => onDelete(i.id)} className="text-xs text-muted hover:text-red">
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
          setCreatedId(null);
        }}
        title={createdId ? "Add attachment" : "Add Insurance Policy"}
      >
        {createdId ? (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-green">Saved. Optionally attach the policy copy.</div>
            <AttachmentUploader module="insurance" recordId={createdId} />
            <Button onClick={() => { setOpen(false); setCreatedId(null); }} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
              <input
                type="number"
                required
                min="0"
                value={form.premiumAmount}
                onChange={(e) => setForm({ ...form, premiumAmount: e.target.value })}
              />
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
