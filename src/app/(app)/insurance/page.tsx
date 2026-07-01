"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
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
    <div className="flex flex-col gap-5 stagger">
      <PageHeader title="Insurance" sub={`${items.length} policies`} action={<Button onClick={() => setOpen(true)}>+ Add</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:gap-4">
        <StatCard label="Total Sum Assured" value={fmtCurrency(totalCover)} tone="accent" icon="◉" />
        <StatCard label="Total Premiums / yr-equiv" value={fmtCurrency(totalPremium)} tone="purple" icon="◐" />
      </div>

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
                    <div className="mt-1.5">
                      {urgent ? (
                        <Badge tone="red">Expires {i.expiryDate} · {days >= 0 ? `${days}d left` : "expired"}</Badge>
                      ) : (
                        <span className="text-xs text-muted-soft">
                          Expires {i.expiryDate} ({days}d left)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 pl-3">
                    <div className="font-mono text-sm font-semibold">{fmtCurrency(Number(i.premiumAmount))}</div>
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
