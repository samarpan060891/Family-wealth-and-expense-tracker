"use client";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader } from "@/components/ui";
import {
  DEFAULT_CATEGORIES,
  INVESTMENT_TYPES,
  DEBT_TYPES,
  ASSET_TYPES,
  INSURANCE_TYPES,
} from "@/lib/categories";

const MODULES: { key: string; label: string; options: string[] }[] = [
  { key: "expense", label: "Expenses", options: DEFAULT_CATEGORIES.expense },
  { key: "income", label: "Income", options: DEFAULT_CATEGORIES.income },
  { key: "investment", label: "Investments", options: INVESTMENT_TYPES },
  { key: "debt", label: "Debts", options: DEBT_TYPES },
  { key: "asset", label: "Assets", options: ASSET_TYPES },
  { key: "insurance", label: "Insurance", options: INSURANCE_TYPES },
];

type Grant = { module: string; category: string | null; accessLevel: "view" | "edit" };
type Member = { id: string; name: string; email: string; role: string; permissions: Grant[] };

type ModuleSetting = { mode: "none" | "all-view" | "all-edit" | "custom"; categories: string[]; level: "view" | "edit" };

export default function FamilyPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [permOpen, setPermOpen] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState({ name: "", email: "", password: "" });
  const [settings, setSettings] = useState<Record<string, ModuleSetting>>({});

  async function load() {
    const res = await fetch("/api/family").then((r) => r.json());
    setMembers(res.members ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...invite, grants: [] }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Failed to add member");
    setInviteOpen(false);
    setInvite({ name: "", email: "", password: "" });
    load();
  }

  async function onRemove(id: string) {
    if (!confirm("Remove this family member's access?")) return;
    await fetch(`/api/family/${id}`, { method: "DELETE" });
    load();
  }

  function openPermissions(member: Member) {
    const next: Record<string, ModuleSetting> = {};
    for (const m of MODULES) {
      const grants = member.permissions.filter((p) => p.module === m.key);
      if (grants.length === 0) {
        next[m.key] = { mode: "none", categories: [], level: "view" };
      } else if (grants.some((g) => g.category === null)) {
        const level = grants.find((g) => g.category === null)!.accessLevel;
        next[m.key] = { mode: level === "edit" ? "all-edit" : "all-view", categories: [], level };
      } else {
        next[m.key] = { mode: "custom", categories: grants.map((g) => g.category!), level: grants[0].accessLevel };
      }
    }
    setSettings(next);
    setPermOpen(member);
  }

  async function savePermissions() {
    if (!permOpen) return;
    const grants: Grant[] = [];
    for (const [module, s] of Object.entries(settings)) {
      if (s.mode === "none") continue;
      if (s.mode === "all-view") grants.push({ module, category: null, accessLevel: "view" });
      if (s.mode === "all-edit") grants.push({ module, category: null, accessLevel: "edit" });
      if (s.mode === "custom") {
        for (const c of s.categories) grants.push({ module, category: c, accessLevel: s.level });
      }
    }
    await fetch(`/api/family/${permOpen.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grants }),
    });
    setPermOpen(null);
    load();
  }

  const nonAdminMembers = members.filter((m) => m.role !== "admin");

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader
        title="Family"
        accent="Sharing"
        sub={`${nonAdminMembers.length} member${nonAdminMembers.length === 1 ? "" : "s"}`}
        action={<Button onClick={() => setInviteOpen(true)}>+ Add Member</Button>}
      />

      <Card>
        {nonAdminMembers.length === 0 ? (
          <EmptyState icon="◐" title="No family members yet" sub="Add a member and choose what they can see" />
        ) : (
          <div className="flex flex-col divide-y divide-border-soft">
            {nonAdminMembers.map((m) => (
              <div key={m.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-surface3 border border-border flex items-center justify-center text-xs font-bold text-accent shrink-0">
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{m.name}</div>
                    <div className="text-xs text-muted truncate">{m.email}</div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 pl-3">
                  <button
                    onClick={() => openPermissions(m)}
                    className="text-xs font-semibold text-accent border border-accent/50 hover:bg-accent-glow rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    Permissions
                  </button>
                  <button onClick={() => onRemove(m.id)} className="text-xs text-muted-soft hover:text-red px-1 transition-colors">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Add Family Member">
        <form onSubmit={onInvite} className="flex flex-col gap-3">
          <div>
            <label>Name</label>
            <input required value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
          </div>
          <div>
            <label>Email</label>
            <input
              type="email"
              required
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            />
          </div>
          <div>
            <label>Temporary Password</label>
            <input
              required
              minLength={8}
              value={invite.password}
              onChange={(e) => setInvite({ ...invite, password: e.target.value })}
              placeholder="Share this with the family member"
            />
          </div>
          {error && <div className="text-red text-sm">{error}</div>}
          <Button type="submit" className="w-full">
            Add Member
          </Button>
        </form>
      </Modal>

      <Modal open={!!permOpen} onClose={() => setPermOpen(null)} title={`Permissions · ${permOpen?.name ?? ""}`}>
        <div className="flex flex-col gap-4">
          {MODULES.map((m) => {
            const s = settings[m.key] ?? { mode: "none", categories: [], level: "view" };
            return (
              <div key={m.key} className="border border-border rounded-lg p-3">
                <div className="font-semibold text-sm mb-2">{m.label}</div>
                <select
                  value={s.mode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      [m.key]: { ...s, mode: e.target.value as ModuleSetting["mode"] },
                    })
                  }
                  className="mb-2"
                >
                  <option value="none">No access</option>
                  <option value="all-view">View all</option>
                  <option value="all-edit">View &amp; edit all</option>
                  <option value="custom">Specific categories only</option>
                </select>
                {s.mode === "custom" && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                      {m.options.map((opt) => {
                        const checked = s.categories.includes(opt);
                        return (
                          <label
                            key={opt}
                            className={`!mb-0 !normal-case text-xs px-2 py-1 rounded-full border cursor-pointer ${
                              checked ? "bg-accent text-black border-accent" : "border-border text-muted"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={checked}
                              onChange={() =>
                                setSettings({
                                  ...settings,
                                  [m.key]: {
                                    ...s,
                                    categories: checked
                                      ? s.categories.filter((c) => c !== opt)
                                      : [...s.categories, opt],
                                  },
                                })
                              }
                            />
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                    <select
                      value={s.level}
                      onChange={(e) =>
                        setSettings({ ...settings, [m.key]: { ...s, level: e.target.value as "view" | "edit" } })
                      }
                    >
                      <option value="view">View only</option>
                      <option value="edit">View &amp; edit</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })}
          <Button onClick={savePermissions} className="w-full">
            Save Permissions
          </Button>
        </div>
      </Modal>
    </div>
  );
}
