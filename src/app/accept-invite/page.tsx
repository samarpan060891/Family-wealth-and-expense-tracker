"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, PasswordInput } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

type InviteGrant = {
  module: "expense" | "income" | "investment" | "debt" | "asset" | "insurance";
  category: string | null;
  accessLevel: "view" | "edit";
};

type InviteInfo = {
  householdName: string;
  email: string | null;
  suggestedName: string | null;
  grants: InviteGrant[];
};

const MODULE_LABELS: Record<InviteGrant["module"], string> = {
  expense: "Expenses",
  income: "Income",
  investment: "Investments",
  debt: "Debts",
  asset: "Assets",
  insurance: "Insurance",
};

function grantSummary(grants: InviteGrant[]) {
  // Group by module → highest access + category count so the invitee sees exactly
  // what they're being granted before accepting.
  const byModule = new Map<InviteGrant["module"], { canEdit: boolean; all: boolean; categories: string[] }>();
  for (const g of grants) {
    const cur = byModule.get(g.module) ?? { canEdit: false, all: false, categories: [] };
    if (g.accessLevel === "edit") cur.canEdit = true;
    if (g.category === null) cur.all = true;
    else cur.categories.push(g.category);
    byModule.set(g.module, cur);
  }
  return [...byModule.entries()].map(([module, v]) => {
    const scope = v.all ? "All" : v.categories.join(", ") || "—";
    return { module, label: MODULE_LABELS[module], scope, canEdit: v.canEdit };
  });
}

function AcceptInviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadingInfo, setLoadingInfo] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("This invitation link is missing its token.");
      setLoadingInfo(false);
      return;
    }
    fetch(`/api/family/accept?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "This invitation is not valid.");
        return data as InviteInfo;
      })
      .then((data) => {
        setInfo(data);
        if (data.suggestedName) setName(data.suggestedName);
        if (data.email) setEmail(data.email);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoadingInfo(false));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/family/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password, email: info?.email ? undefined : email }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not accept the invitation.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const summary = info ? grantSummary(info.grants) : [];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 min-h-screen relative overflow-hidden">
      <ThemeToggle className="absolute top-5 right-5" />
      <div className="w-full max-w-sm animate-fade-up relative">
        <div className="text-center mb-8">
          <div className="font-display text-3xl font-semibold text-accent italic">FamilyWealth</div>
          <div className="text-muted text-sm mt-2">You&apos;ve been invited to join a household</div>
        </div>

        {loadingInfo ? (
          <Card className="text-center text-muted text-sm py-8">Checking your invitation…</Card>
        ) : loadError ? (
          <Card className="shadow-2xl shadow-black/30">
            <div className="text-red text-sm bg-red/10 border border-red/20 rounded-lg px-3 py-3 text-center">
              {loadError}
            </div>
            <div className="text-center text-sm text-muted mt-5">
              <Link href="/login" className="text-accent font-semibold hover:text-accent-soft transition-colors">
                Go to sign in
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="shadow-2xl shadow-black/30">
            <div className="mb-5">
              <div className="text-sm text-muted">Joining</div>
              <div className="text-lg font-bold">{info?.householdName}</div>
            </div>

            {summary.length > 0 && (
              <div className="mb-5">
                <div className="text-xs font-mono uppercase tracking-wide text-muted mb-2">
                  What you&apos;ll be able to see
                </div>
                <div className="flex flex-col gap-2">
                  {summary.map((s) => (
                    <div
                      key={s.module}
                      className="flex items-center justify-between bg-surface2/60 border border-border-soft rounded-xl px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold">{s.label}</div>
                        <div className="text-xs text-muted truncate">{s.scope}</div>
                      </div>
                      <Badge tone={s.canEdit ? "green" : "blue"}>{s.canEdit ? "View & edit" : "View only"}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div>
                <label>Your name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={Boolean(info?.email)}
                  placeholder="you@example.com"
                  className={info?.email ? "opacity-70" : ""}
                />
              </div>
              <div>
                <label>Create a password</label>
                <PasswordInput
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters, 1 letter & 1 number"
                />
              </div>
              {error && (
                <div className="text-red text-sm bg-red/10 border border-red/20 rounded-lg px-3 py-2">{error}</div>
              )}
              <Button type="submit" disabled={submitting} className="w-full mt-1">
                {submitting ? "Creating your account…" : "Accept & Join"}
              </Button>
            </form>
          </Card>
        )}

        <div className="text-center text-sm text-muted mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-accent font-semibold hover:text-accent-soft transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted text-sm">Loading…</div>}>
      <AcceptInviteInner />
    </Suspense>
  );
}
