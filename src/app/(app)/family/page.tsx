"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader } from "@/components/ui";
import { useToast } from "@/components/toast";
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

const MODULE_LABEL: Record<string, string> = Object.fromEntries(MODULES.map((m) => [m.key, m.label]));

type Grant = { module: string; category: string | null; accessLevel: "view" | "edit" };
type Member = { id: string; name: string; email: string; role: string; permissions: Grant[] };
type PendingInvite = {
  id: string;
  token: string;
  email: string | null;
  suggestedName: string | null;
  grantCount: number;
  expiresAt: string;
};

type ModuleSetting = { mode: "none" | "all-view" | "all-edit" | "custom"; categories: string[]; level: "view" | "edit" };

const EMPTY_SETTINGS = (): Record<string, ModuleSetting> =>
  Object.fromEntries(MODULES.map((m) => [m.key, { mode: "none" as const, categories: [], level: "view" as const }]));

// Collapse a member's grant rows into one readable badge per module.
function permissionSummary(perms: Grant[]) {
  const byModule = new Map<string, { canEdit: boolean; all: boolean; categories: string[] }>();
  for (const g of perms) {
    const cur = byModule.get(g.module) ?? { canEdit: false, all: false, categories: [] };
    if (g.accessLevel === "edit") cur.canEdit = true;
    if (g.category === null) cur.all = true;
    else cur.categories.push(g.category);
    byModule.set(g.module, cur);
  }
  return MODULES.filter((m) => byModule.has(m.key)).map((m) => {
    const v = byModule.get(m.key)!;
    const scope = v.all ? "All" : `${v.categories.length}`;
    return { key: m.key, label: MODULE_LABEL[m.key], scope, canEdit: v.canEdit };
  });
}

export default function FamilyPage() {
  const { success, error: toastError } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const [permOpen, setPermOpen] = useState<Member | null>(null);
  const [settings, setSettings] = useState<Record<string, ModuleSetting>>({});
  const [savingPerms, setSavingPerms] = useState(false);

  // Invite-link modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ name: string; email: string; settings: Record<string, ModuleSetting> }>({
    name: "",
    email: "",
    settings: EMPTY_SETTINGS(),
  });
  const [inviteError, setInviteError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");

  async function load() {
    try {
      const [famRes, invRes] = await Promise.all([
        fetch("/api/family").then((r) => r.json()),
        fetch("/api/family/invite").then((r) => (r.ok ? r.json() : { invites: [] })),
      ]);
      setMembers(famRes.members ?? []);
      setPending(invRes.invites ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function settingsToGrants(s: Record<string, ModuleSetting>): Grant[] {
    const grants: Grant[] = [];
    for (const [module, cfg] of Object.entries(s)) {
      if (cfg.mode === "none") continue;
      if (cfg.mode === "all-view") grants.push({ module, category: null, accessLevel: "view" });
      if (cfg.mode === "all-edit") grants.push({ module, category: null, accessLevel: "edit" });
      if (cfg.mode === "custom") for (const c of cfg.categories) grants.push({ module, category: c, accessLevel: cfg.level });
    }
    return grants;
  }

  function openInvite() {
    setInviteForm({ name: "", email: "", settings: EMPTY_SETTINGS() });
    setInviteError("");
    setGeneratedLink("");
    setInviteOpen(true);
  }

  async function onGenerateInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setGenerating(true);
    try {
      const res = await fetch("/api/family/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestedName: inviteForm.name || undefined,
          email: inviteForm.email || undefined,
          grants: settingsToGrants(inviteForm.settings),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? "Could not create the invite.");
        return;
      }
      const link = `${window.location.origin}${data.invitePath}`;
      setGeneratedLink(link);
      success("Invite link ready — copy and share it.");
      load();
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      success("Link copied to clipboard.");
    } catch {
      toastError("Couldn't copy — select and copy the link manually.");
    }
  }

  async function revokeInvite(id: string) {
    if (!confirm("Revoke this pending invite? The link will stop working.")) return;
    const res = await fetch(`/api/family/invite?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      success("Invite revoked.");
      load();
    } else {
      toastError("Could not revoke the invite.");
    }
  }

  async function onRemove(id: string) {
    if (!confirm("Remove this family member's access?")) return;
    const res = await fetch(`/api/family/${id}`, { method: "DELETE" });
    if (res.ok) {
      success("Family member removed.");
      load();
    } else {
      toastError("Could not remove this member.");
    }
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
    setSavingPerms(true);
    try {
      const res = await fetch(`/api/family/${permOpen.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grants: settingsToGrants(settings) }),
      });
      if (!res.ok) {
        toastError("Could not save permissions.");
        return;
      }
      success("Permissions updated.");
      setPermOpen(null);
      load();
    } finally {
      setSavingPerms(false);
    }
  }

  const nonAdminMembers = members.filter((m) => m.role !== "admin");

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader
        title="Family"
        accent="Sharing"
        sub={`${nonAdminMembers.length} member${nonAdminMembers.length === 1 ? "" : "s"}`}
        action={<Button onClick={openInvite}>+ Invite Member</Button>}
      />

      {/* MEMBERS */}
      <Card>
        {loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-9 h-9 rounded-full bg-surface3" />
                <div className="flex-1">
                  <div className="h-3 w-28 bg-surface3 rounded mb-2" />
                  <div className="h-2.5 w-40 bg-surface3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : nonAdminMembers.length === 0 ? (
          <EmptyState icon="◐" title="No family members yet" sub="Invite someone and choose exactly what they can see" />
        ) : (
          <div className="flex flex-col divide-y divide-border-soft">
            {nonAdminMembers.map((m) => {
              const summary = permissionSummary(m.permissions);
              return (
                <div key={m.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-surface3 border border-border flex items-center justify-center text-xs font-bold text-accent shrink-0">
                        {m.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{m.name}</div>
                        <div className="text-xs text-muted truncate">{m.email}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openPermissions(m)}
                        className="text-xs font-semibold text-accent border border-accent/50 hover:bg-accent-glow rounded-lg px-2.5 py-1.5 transition-colors"
                      >
                        Edit access
                      </button>
                      <button
                        onClick={() => onRemove(m.id)}
                        className="text-xs text-muted-soft hover:text-red px-1 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2.5 pl-12">
                    {summary.length === 0 ? (
                      <span className="text-xs text-muted-soft">No access granted yet</span>
                    ) : (
                      summary.map((s) => (
                        <Badge key={s.key} tone={s.canEdit ? "green" : "blue"}>
                          {s.label}: {s.scope} {s.canEdit ? "✎" : "👁"}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* PENDING INVITES */}
      {pending.length > 0 && (
        <Card>
          <div className="text-xs font-mono uppercase tracking-wide text-muted mb-3">Pending invites</div>
          <div className="flex flex-col divide-y divide-border-soft">
            {pending.map((inv) => {
              const link = `${typeof window !== "undefined" ? window.location.origin : ""}/accept-invite?token=${inv.token}`;
              return (
                <div key={inv.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {inv.suggestedName || inv.email || "Open invite"}
                    </div>
                    <div className="text-xs text-muted">
                      {inv.grantCount} area{inv.grantCount === 1 ? "" : "s"} shared · expires{" "}
                      {new Date(inv.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => copyLink(link)}
                      className="text-xs font-semibold text-accent border border-accent/50 hover:bg-accent-glow rounded-lg px-2.5 py-1.5 transition-colors"
                    >
                      Copy link
                    </button>
                    <button
                      onClick={() => revokeInvite(inv.id)}
                      className="text-xs text-muted-soft hover:text-red px-1 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* INVITE MODAL */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a Family Member">
        {generatedLink ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted leading-relaxed">
              Share this secure link. When they open it they&apos;ll set their own password and instantly get exactly the
              access you chose. The link expires in 14 days.
            </p>
            <div className="flex flex-col gap-2">
              <div className="text-xs break-all bg-surface2 border border-border rounded-lg px-3 py-2.5 font-mono">
                {generatedLink}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => copyLink(generatedLink)} className="flex-1">
                  Copy link
                </Button>
                <Button variant="outline" onClick={() => setInviteOpen(false)} className="flex-1">
                  Done
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={onGenerateInvite} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label>Their name (optional)</label>
                <input
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="e.g. Priya"
                />
              </div>
              <div>
                <label>Their email (optional)</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="Lock the invite to one email"
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-wide text-muted mb-2">What can they access?</div>
              <div className="flex flex-col gap-2.5">
                {MODULES.map((m) => {
                  const s = inviteForm.settings[m.key];
                  return (
                    <PermissionRow
                      key={m.key}
                      module={m}
                      setting={s}
                      onChange={(next) =>
                        setInviteForm({ ...inviteForm, settings: { ...inviteForm.settings, [m.key]: next } })
                      }
                    />
                  );
                })}
              </div>
            </div>

            {inviteError && (
              <div className="text-red text-sm bg-red/10 border border-red/20 rounded-lg px-3 py-2">{inviteError}</div>
            )}
            <Button type="submit" disabled={generating} className="w-full">
              {generating ? "Generating link…" : "Generate invite link"}
            </Button>
          </form>
        )}
      </Modal>

      {/* PERMISSIONS MODAL */}
      <Modal open={!!permOpen} onClose={() => setPermOpen(null)} title={`Access · ${permOpen?.name ?? ""}`}>
        <div className="flex flex-col gap-2.5">
          {MODULES.map((m) => (
            <PermissionRow
              key={m.key}
              module={m}
              setting={settings[m.key] ?? { mode: "none", categories: [], level: "view" }}
              onChange={(next) => setSettings({ ...settings, [m.key]: next })}
            />
          ))}
          <Button onClick={savePermissions} disabled={savingPerms} className="w-full mt-2">
            {savingPerms ? "Saving…" : "Save access"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// One module's access controls, reused by both the invite and edit-permissions modals.
function PermissionRow({
  module,
  setting,
  onChange,
}: {
  module: { key: string; label: string; options: string[] };
  setting: ModuleSetting;
  onChange: (next: ModuleSetting) => void;
}) {
  return (
    <div className="border border-border rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="font-semibold text-sm">{module.label}</div>
        <select
          value={setting.mode}
          onChange={(e) => onChange({ ...setting, mode: e.target.value as ModuleSetting["mode"] })}
          className="!mb-0 !w-auto text-xs"
        >
          <option value="none">No access</option>
          <option value="all-view">View all</option>
          <option value="all-edit">View &amp; edit all</option>
          <option value="custom">Specific categories</option>
        </select>
      </div>
      {setting.mode === "custom" && (
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex flex-wrap gap-1.5">
            {module.options.map((opt) => {
              const checked = setting.categories.includes(opt);
              return (
                <label
                  key={opt}
                  className={`!mb-0 !normal-case text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                    checked ? "bg-accent text-black border-accent" : "border-border text-muted hover:border-accent/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    onChange={() =>
                      onChange({
                        ...setting,
                        categories: checked
                          ? setting.categories.filter((c) => c !== opt)
                          : [...setting.categories, opt],
                      })
                    }
                  />
                  {opt}
                </label>
              );
            })}
          </div>
          <select
            value={setting.level}
            onChange={(e) => onChange({ ...setting, level: e.target.value as "view" | "edit" })}
            className="!mb-0 text-xs"
          >
            <option value="view">View only</option>
            <option value="edit">View &amp; edit</option>
          </select>
        </div>
      )}
    </div>
  );
}
