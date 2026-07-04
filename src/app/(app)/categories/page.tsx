"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { useToast } from "@/components/toast";

type Module = "expense" | "income";
type Category = { id: string; name: string; color: string; module: Module };

const COLORS = ["#f0a500", "#4fd189", "#ef6a63", "#6fa1f5", "#b58cf0", "#4ec9c9", "#f0a868", "#8ea0b8"];

export default function CategoriesPage() {
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<Module>("expense");
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [adding, setAdding] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [exp, inc] = await Promise.all([
        fetch("/api/categories?module=expense").then((r) => r.json()),
        fetch("/api/categories?module=income").then((r) => r.json()),
      ]);
      setCats([...(exp.categories ?? []), ...(inc.categories ?? [])]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const shown = cats.filter((c) => c.module === tab).sort((a, b) => a.name.localeCompare(b.name));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: tab, name: newName.trim(), color: newColor }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toastError(data.error ?? "Couldn't add category.");
      setNewName("");
      success("Category added.");
      load();
    } finally {
      setAdding(false);
    }
  }

  async function rename(id: string) {
    if (!editName.trim()) return setEditId(null);
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setEditId(null);
    if (!res.ok) return toastError(data.error ?? "Couldn't rename.");
    success("Category renamed.");
    load();
  }

  async function recolor(id: string, color: string) {
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    if (res.ok) load();
    else toastError("Couldn't update color.");
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Existing entries in this category become Uncategorized.`)) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toastError(data.error ?? "Couldn't delete.");
    success("Category deleted.");
    load();
  }

  return (
    <div className="flex flex-col gap-5 stagger max-w-xl">
      <PageHeader title="Categories" accent="Manage" sub="Add and organize expense & income categories" />

      <div className="flex rounded-xl border border-border overflow-hidden text-sm w-fit">
        {(["expense", "income"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setTab(m)}
            className={`px-4 py-2 capitalize font-semibold transition-colors ${
              tab === m ? "bg-accent text-black" : "text-muted hover:bg-surface2"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <Card>
        <form onSubmit={add} className="flex flex-col gap-3">
          <div className="text-sm font-bold">Add a {tab} category</div>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={tab === "expense" ? "e.g. Pet Care" : "e.g. Side Hustle"}
              maxLength={80}
              className="flex-1"
            />
            <Button type="submit" disabled={adding}>
              {adding ? "Adding…" : "Add"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-soft">Color:</span>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                aria-label={`Color ${c}`}
                className={`w-5 h-5 rounded-full transition-transform ${newColor === c ? "ring-2 ring-offset-2 ring-offset-surface ring-accent scale-110" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </form>
      </Card>

      <Card>
        {loading ? (
          <div className="text-sm text-muted-soft py-4">Loading…</div>
        ) : shown.length === 0 ? (
          <EmptyState icon="◧" title={`No ${tab} categories`} sub="Add your first one above" />
        ) : (
          <div className="flex flex-col divide-y divide-border-soft">
            {shown.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
                {editId === c.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => rename(c.id)}
                    onKeyDown={(e) => e.key === "Enter" && rename(c.id)}
                    className="flex-1 !py-1.5"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditId(c.id);
                      setEditName(c.name);
                    }}
                    className="flex-1 text-left text-sm font-medium hover:text-accent transition-colors"
                  >
                    {c.name}
                  </button>
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  {COLORS.slice(0, 4).map((col) => (
                    <button
                      key={col}
                      onClick={() => recolor(c.id, col)}
                      aria-label={`Set color ${col}`}
                      className="w-3.5 h-3.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
                      style={{ background: col }}
                    />
                  ))}
                  <button
                    onClick={() => remove(c.id, c.name)}
                    className="text-xs text-muted-soft hover:text-red ml-1 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-soft">
        Investments, debts, assets and insurance use fixed type lists rather than categories.
      </p>
    </div>
  );
}
