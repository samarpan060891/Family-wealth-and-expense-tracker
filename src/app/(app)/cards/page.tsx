"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useCurrencyCtx } from "@/components/currency-context";
import { CurrencySelect } from "@/components/currency-select";

type CardT = {
  id: string;
  nickname: string;
  bank: string | null;
  network: string | null;
  last4: string | null;
  creditLimit: string | null;
  currency: string;
  billingDay: number | null;
  dueDay: number | null;
  outstanding: number;
};

const NETWORKS = ["Visa", "Mastercard", "Amex", "RuPay", "Diners", "Discover", "Other"];

const EMPTY = {
  nickname: "",
  bank: "",
  network: "Visa",
  last4: "",
  creditLimit: "",
  currency: "INR",
  billingDay: "",
  dueDay: "",
};

export default function CardsPage() {
  const { success, error: toastError } = useToast();
  const { defaultCurrency } = useCurrencyCtx();
  const [cards, setCards] = useState<CardT[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY, currency: defaultCurrency });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/cards").then((r) => r.json());
      setCards(res.cards ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY, currency: defaultCurrency });
    setOpen(true);
  }
  function openEdit(c: CardT) {
    setEditId(c.id);
    setForm({
      nickname: c.nickname,
      bank: c.bank ?? "",
      network: c.network ?? "Visa",
      last4: c.last4 ?? "",
      creditLimit: c.creditLimit ?? "",
      currency: c.currency,
      billingDay: c.billingDay?.toString() ?? "",
      dueDay: c.dueDay?.toString() ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        nickname: form.nickname,
        bank: form.bank || undefined,
        network: form.network || undefined,
        last4: form.last4 || undefined,
        creditLimit: form.creditLimit || undefined,
        currency: form.currency,
        billingDay: form.billingDay || undefined,
        dueDay: form.dueDay || undefined,
      };
      const res = await fetch(editId ? `/api/cards/${editId}` : "/api/cards", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toastError(data.error ?? "Couldn't save the card.");
      success(editId ? "Card updated." : "Card saved.");
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: CardT) {
    if (!confirm(`Remove ${c.nickname}? Linked transactions are kept but un-linked.`)) return;
    const res = await fetch(`/api/cards/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      success("Card removed.");
      load();
    } else toastError("Couldn't remove the card.");
  }

  // Only total when every card shares a currency (avoids summing across currencies).
  const currencies = new Set(cards.map((c) => c.currency));
  const sameCurrency = currencies.size === 1 ? [...currencies][0] : null;
  const totalOutstanding = cards.reduce((s, c) => s + c.outstanding, 0);

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader
        title="Credit Cards"
        sub={`${cards.length} card${cards.length === 1 ? "" : "s"}`}
        action={<Button onClick={openAdd}>+ Add Card</Button>}
      />

      {cards.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Cards Saved" value={String(cards.length)} tone="accent" icon="▦" />
          {sameCurrency && (
            <StatCard
              label="Total Outstanding"
              value={fmtCurrency(totalOutstanding, sameCurrency)}
              tone="red"
              icon="◇"
            />
          )}
        </div>
      )}

      <Card>
        {loading ? (
          <div className="text-sm text-muted-soft py-4">Loading…</div>
        ) : cards.length === 0 ? (
          <EmptyState icon="▦" title="No cards saved yet" sub="Add each credit card to track its balance and due date" />
        ) : (
          <div className="flex flex-col gap-3">
            {cards.map((c) => {
              const limit = c.creditLimit ? Number(c.creditLimit) : null;
              const util = limit && limit > 0 ? Math.min(100, Math.round((c.outstanding / limit) * 100)) : null;
              return (
                <div key={c.id} className="border border-border rounded-2xl p-4 bg-gradient-to-br from-surface2/60 to-transparent">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{c.nickname}</span>
                        {c.network && <Badge tone="blue">{c.network}</Badge>}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {c.bank ? `${c.bank} · ` : ""}
                        {c.last4 ? `•••• ${c.last4}` : "card"}
                        {c.dueDay ? ` · due day ${c.dueDay}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEdit(c)} className="text-xs text-accent hover:text-accent-soft">
                        Edit
                      </button>
                      <button onClick={() => remove(c)} className="text-xs text-muted-soft hover:text-red">
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="flex items-end justify-between mt-3">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wide text-muted">Outstanding</div>
                      <div className="text-xl font-bold font-mono text-red">{fmtCurrency(c.outstanding, c.currency)}</div>
                    </div>
                    {limit && (
                      <div className="text-right">
                        <div className="text-[10px] font-mono uppercase tracking-wide text-muted">Limit</div>
                        <div className="text-sm font-mono text-muted">{fmtCurrency(limit, c.currency)}</div>
                      </div>
                    )}
                  </div>

                  {util != null && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${util > 80 ? "bg-red" : util > 50 ? "bg-accent" : "bg-green"}`}
                          style={{ width: `${util}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-muted-soft mt-1">{util}% of limit used</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-soft">
        Tip: when adding an expense paid by a card, pick the card. When you pay the bill, record it as a{" "}
        <b>credit-card bill payment</b> and choose the same card — its outstanding updates automatically.
      </p>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit Card" : "Add Card"}>
        <form onSubmit={save} className="flex flex-col gap-3">
          <div>
            <label>Nickname</label>
            <input
              required
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              placeholder="e.g. HDFC Regalia"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label>Bank (optional)</label>
              <input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="HDFC" />
            </div>
            <div>
              <label>Network</label>
              <select value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })}>
                {NETWORKS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label>Last 4 digits</label>
              <input
                inputMode="numeric"
                maxLength={4}
                value={form.last4}
                onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="1234"
              />
            </div>
            <div>
              <label>Credit limit</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                  className="flex-1"
                />
                <CurrencySelect value={form.currency} onChange={(c) => setForm({ ...form, currency: c })} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label>Statement day (1–31)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={form.billingDay}
                onChange={(e) => setForm({ ...form, billingDay: e.target.value })}
                placeholder="e.g. 20"
              />
            </div>
            <div>
              <label>Payment due day (1–31)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={form.dueDay}
                onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                placeholder="e.g. 8"
              />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : editId ? "Save changes" : "Add card"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
