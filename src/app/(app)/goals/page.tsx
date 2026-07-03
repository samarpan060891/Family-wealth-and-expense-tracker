"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader, fmtCurrency } from "@/components/ui";

type Goal = {
  id: string;
  name: string;
  category: string | null;
  targetAmount: string;
  currentAmount: string;
  targetDate: string | null;
};

const GOAL_CATEGORIES = ["Vacation", "Emergency Fund", "Home", "Vehicle", "Education", "Retirement", "Wedding", "Other"];

function monthsLeft(date: string | null): number | null {
  if (!date) return null;
  return Math.max(0, Math.round((new Date(date).getTime() - Date.now()) / (30.44 * 864e5)));
}

export default function GoalsPage() {
  const [items, setItems] = useState<Goal[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [contributeFor, setContributeFor] = useState<Goal | null>(null);
  const [contribution, setContribution] = useState("");
  const EMPTY = { name: "", category: GOAL_CATEGORIES[0], targetAmount: "", currentAmount: "", targetDate: "" };
  const [form, setForm] = useState(EMPTY);

  async function load() {
    const res = await fetch("/api/goals").then((r) => r.json());
    setItems(res.goals ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to save");
      setOpen(false);
      setForm(EMPTY);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function onContribute(e: React.FormEvent) {
    e.preventDefault();
    if (!contributeFor) return;
    const add = Number(contribution);
    if (Number.isNaN(add)) return;
    const next = Number(contributeFor.currentAmount) + add;
    await fetch(`/api/goals/${contributeFor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentAmount: Math.max(0, next) }),
    });
    setContributeFor(null);
    setContribution("");
    load();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    load();
  }

  const totalTarget = items.reduce((s, g) => s + Number(g.targetAmount), 0);
  const totalSaved = items.reduce((s, g) => s + Number(g.currentAmount), 0);

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader
        title="Financial"
        accent="Goals"
        sub={`${items.length} goal${items.length === 1 ? "" : "s"}`}
        action={<Button onClick={() => setOpen(true)}>+ Add Goal</Button>}
      />

      {items.length > 0 && (
        <Card>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted">Total saved across goals</span>
            <span className="font-mono font-semibold">
              {fmtCurrency(totalSaved)} <span className="text-muted-soft">/ {fmtCurrency(totalTarget)}</span>
            </span>
          </div>
          <div className="h-2 bg-surface2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent2 to-accent rounded-full transition-all duration-700"
              style={{ width: `${totalTarget ? Math.min(100, (totalSaved / totalTarget) * 100) : 0}%` }}
            />
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState icon="◎" title="No goals yet" sub="Set a target like ₹5,00,000 for a vacation and track your progress" />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((g) => {
            const target = Number(g.targetAmount);
            const cur = Number(g.currentAmount);
            const progress = target ? Math.min(100, (cur / target) * 100) : 0;
            const done = progress >= 100;
            const ml = monthsLeft(g.targetDate);
            const perMonth = ml && ml > 0 && cur < target ? (target - cur) / ml : null;
            return (
              <Card key={g.id} hover>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold">{g.name}</div>
                    {g.category && <div className="text-xs text-muted-soft">{g.category}</div>}
                  </div>
                  <button onClick={() => onDelete(g.id)} className="text-xs text-muted-soft hover:text-red">
                    Delete
                  </button>
                </div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-mono font-semibold text-accent">{fmtCurrency(cur)}</span>
                  <span className="font-mono text-muted-soft">{fmtCurrency(target)}</span>
                </div>
                <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      done ? "bg-green" : "bg-gradient-to-r from-accent2 to-accent"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2 text-xs">
                  <span className={done ? "text-green font-semibold" : "text-muted"}>
                    {done ? "🎉 Goal reached!" : `${Math.round(progress)}% funded`}
                  </span>
                  {g.targetDate && (
                    <span className="text-muted-soft">
                      by {g.targetDate}
                      {perMonth ? ` · ${fmtCurrency(perMonth)}/mo` : ""}
                    </span>
                  )}
                </div>
                {!done && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => {
                      setContributeFor(g);
                      setContribution("");
                    }}
                  >
                    + Add contribution
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add Goal">
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div>
            <label>Goal Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Europe vacation"
            />
          </div>
          <div>
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {GOAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>Target Amount</label>
              <input
                type="number"
                required
                min="1"
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
              />
            </div>
            <div>
              <label>Already Saved</label>
              <input
                type="number"
                min="0"
                value={form.currentAmount}
                onChange={(e) => setForm({ ...form, currentAmount: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label>Target Date (optional)</label>
            <input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
          </div>
          {error && <div className="text-red text-sm">{error}</div>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save Goal"}
          </Button>
        </form>
      </Modal>

      <Modal open={!!contributeFor} onClose={() => setContributeFor(null)} title={`Add to ${contributeFor?.name ?? ""}`}>
        <form onSubmit={onContribute} className="flex flex-col gap-3">
          <div>
            <label>Contribution Amount</label>
            <input
              type="number"
              required
              autoFocus
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              placeholder="e.g. 10000"
            />
            <div className="text-xs text-muted-soft mt-1">
              Use a negative number to correct a mistake.
            </div>
          </div>
          <Button type="submit" className="w-full">
            Add
          </Button>
        </form>
      </Modal>
    </div>
  );
}
