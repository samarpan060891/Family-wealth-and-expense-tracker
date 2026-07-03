"use client";
import { useState } from "react";
import { Button, Card, PageHeader, PasswordInput } from "@/components/ui";

export default function AccountPage() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk(false);
    if (form.newPassword !== form.confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't change your password.");
        return;
      }
      setOk(true);
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 stagger max-w-md">
      <PageHeader title="Account" accent="Security" sub="Change your password" />
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label>Current Password</label>
            <PasswordInput
              required
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            />
          </div>
          <div>
            <label>New Password</label>
            <PasswordInput
              required
              minLength={8}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              placeholder="At least 8 chars, with a letter and a number"
            />
          </div>
          <div>
            <label>Confirm New Password</label>
            <PasswordInput
              required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          </div>
          {error && (
            <div className="text-red text-sm bg-red/10 border border-red/20 rounded-lg px-3 py-2">{error}</div>
          )}
          {ok && (
            <div className="text-green text-sm bg-green/10 border border-green/20 rounded-lg px-3 py-2">
              Password updated.
            </div>
          )}
          <Button type="submit" disabled={saving} className="w-fit">
            {saving ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
