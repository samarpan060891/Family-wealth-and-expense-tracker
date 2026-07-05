"use client";
import { useCallback, useEffect, useState } from "react";
import { Badge, Card, fmtCurrency } from "@/components/ui";
import { useToast } from "@/components/toast";

type DueItem = {
  id: string;
  kind: string;
  sourceId: string;
  title: string;
  subtitle: string;
  amount: number | null;
  dueDate: string;
  status: "overdue" | "due_soon" | "upcoming";
  actionLabel: string;
};

const STATUS: Record<DueItem["status"], { tone: "red" | "accent" | "blue"; label: string; border: string }> = {
  overdue: { tone: "red", label: "Overdue", border: "border-l-red" },
  due_soon: { tone: "accent", label: "Due now", border: "border-l-accent" },
  upcoming: { tone: "blue", label: "Upcoming", border: "border-l-blue" },
};

function dueLabel(dateIso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateIso + "T00:00:00");
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const nice = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  if (days === 0) return `Today · ${nice}`;
  if (days < 0) return `${Math.abs(days)}d overdue · ${nice}`;
  if (days === 1) return `Tomorrow · ${nice}`;
  return `in ${days}d · ${nice}`;
}

export function RemindersPanel({
  compact = false,
  onCount,
}: {
  compact?: boolean;
  onCount?: (n: number) => void;
}) {
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<DueItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders");
      const data = await res.json();
      const list: DueItem[] = data.items ?? [];
      setItems(list);
      onCount?.(list.length);
    } catch {
      setItems([]);
    }
  }, [onCount]);

  useEffect(() => {
    load();
  }, [load]);

  async function markDone(it: DueItem) {
    setBusy(it.id);
    // Optimistic removal.
    setItems((prev) => {
      const next = (prev ?? []).filter((x) => x.id !== it.id);
      onCount?.(next.length);
      return next;
    });
    try {
      const res = await fetch("/api/reminders/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: it.kind, sourceId: it.sourceId, dueDate: it.dueDate }),
      });
      if (!res.ok) {
        toastError("Couldn't update. Restoring the reminder.");
        load();
      } else {
        success(`${it.title} — done.`);
      }
    } finally {
      setBusy(null);
    }
  }

  if (items === null) {
    return compact ? null : (
      <Card>
        <div className="text-sm text-muted-soft py-2">Checking what needs your attention…</div>
      </Card>
    );
  }

  if (items.length === 0) {
    return compact ? null : (
      <Card>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-green text-lg">✓</span>
          <span className="text-muted">You&apos;re all caught up — nothing due right now.</span>
        </div>
      </Card>
    );
  }

  const shown = compact ? items.slice(0, 4) : items;

  return (
    <Card className="border-accent/25 bg-gradient-to-br from-accent/[0.05] to-transparent">
      <div className="flex items-center gap-2 text-sm font-bold mb-3">
        <span>🔔</span> Action Needed
        <span className="ml-1 text-[11px] font-mono text-muted-soft">{items.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {shown.map((it) => {
          const s = STATUS[it.status];
          return (
            <div
              key={it.id}
              className={`border-l-2 ${s.border} bg-surface2/60 border border-border-soft rounded-r-xl rounded-l-sm px-3 py-2.5 flex items-center justify-between gap-3`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{it.title}</span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {it.subtitle} · {dueLabel(it.dueDate)}
                  {it.amount != null ? ` · ${fmtCurrency(it.amount)}` : ""}
                </div>
              </div>
              <button
                onClick={() => markDone(it)}
                disabled={busy === it.id}
                className="shrink-0 text-xs font-semibold bg-accent text-black rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {it.actionLabel}
              </button>
            </div>
          );
        })}
      </div>
      {compact && items.length > shown.length && (
        <div className="text-xs text-muted-soft mt-2">+{items.length - shown.length} more on the Reminders page</div>
      )}
    </Card>
  );
}
