"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, StatCard, fmtCurrency } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useCurrencyCtx } from "@/components/currency-context";
import { CurrencySelect } from "@/components/currency-select";

type Account = {
  id: string;
  name: string;
  kind: string;
  currency: string;
  openingBalance: string;
  balance: number;
};

const KINDS = [
  { value: "bank", label: "Bank account" },
  { value: "cash", label: "Cash / wallet" },
  { value: "wallet", label: "Digital wallet" },
];

const EMPTY = { name: "", kind: "bank", currency: "INR", openingBalance: "" };

export default function CashPage() {
  const { success, error: toastError } = useToast();
  const { defaultCurrency } = useCurrencyCtx();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY, currency: defaultCurrency });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/cash-accounts").then((r) => r.json());
      setAccounts(res.accounts ?? []);
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
  function openEdit(a: Account) {
    setEditId(a.id);
    setForm({ name: a.name, kind: a.kind, currency: a.currency, openingBalance: a.openingBalance });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name,
        kind: form.kind,
        currency: form.currency,
        openingBalance: form.openingBalance || 0,
      };
      const res = await fetch(editId ? `/api/cash-accounts/${editId}` : "/api/cash-accounts", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toastError(data.error ?? "Couldn't save the account.");
      success(editId ? "Account updated." : "Account added.");
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: Account) {
    if (!confirm(`Remove ${a.name}? Linked transactions are kept but un-linked.`)) return;
    const res = await fetch(`/api/cash-accounts/${a.id}`, { method: "DELETE" });
    if (res.ok) {
      success("Account removed.");
      load();
    } else toastError("Couldn't remove the account.");
  }

  const currencies = new Set(accounts.map((a) => a.currency));
  const sameCurrency = currencies.size === 1 ? [...currencies][0] : null;
  const total = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader
        title="Cash & Bank"
        sub={`${accounts.length} account${accounts.length === 1 ? "" : "s"}`}
        action={<Button onClick={openAdd}>+ Add Account</Button>}
      />

      {accounts.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Accounts" value={String(accounts.length)} tone="accent" icon="▢" />
          {sameCurrency && (
            <StatCard label="Total Balance" value={fmtCurrency(total, sameCurrency)} tone="green" icon="◆" />
          )}
        </div>
      )}

      <Card>
        {loading ? (
          <div className="text-sm text-muted-soft py-4">Loading…</div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon="▢"
            title="No accounts yet"
            sub="Add your bank/cash accounts — income and spending update their balances and your net worth"
          />
        ) : (
          <div className="flex flex-col divide-y divide-border-soft">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{a.name}</span>
                    <Badge tone="blue">{KINDS.find((k) => k.value === a.kind)?.label ?? a.kind}</Badge>
                  </div>
                  <div className="text-xs text-muted mt-0.5">Opening {fmtCurrency(Number(a.openingBalance), a.currency)}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0 pl-3">
                  <div className={`font-mono text-sm font-semibold ${a.balance < 0 ? "text-red" : "text-green"}`}>
                    {fmtCurrency(a.balance, a.currency)}
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <button onClick={() => openEdit(a)} className="text-xs text-accent hover:text-accent-soft">
                      Edit
                    </button>
                    <button onClick={() => remove(a)} className="text-xs text-muted-soft hover:text-red">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-soft">
        Balance = opening balance + income into the account − expenses out of it. Credit-card purchases don&apos;t reduce
        cash (they raise the card balance); paying a card bill does. These balances are included in your net worth.
      </p>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit Account" : "Add Account"}>
        <form onSubmit={save} className="flex flex-col gap-3">
          <div>
            <label>Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. HDFC Savings"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label>Type</label>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Opening balance</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  value={form.openingBalance}
                  onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                  className="flex-1"
                  placeholder="0"
                />
                <CurrencySelect value={form.currency} onChange={(c) => setForm({ ...form, currency: c })} />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-soft">
            Opening balance is what&apos;s in the account today before you start logging transactions against it.
          </p>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : editId ? "Save changes" : "Add account"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
