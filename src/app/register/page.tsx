"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, PasswordInput } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    householdName: "",
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Registration failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 min-h-screen">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-9">
          <div className="font-display text-3xl font-semibold text-accent italic">FamilyWealth</div>
          <div className="text-muted text-sm mt-2">
            Create your household as the main account holder
          </div>
        </div>
        <Card className="shadow-2xl shadow-black/30">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label>Household Name</label>
              <input
                required
                value={form.householdName}
                onChange={(e) => setForm({ ...form, householdName: e.target.value })}
                placeholder="e.g. The Sharma Family"
              />
            </div>
            <div>
              <label>Your Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <label>Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label>Password</label>
              <PasswordInput
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 8 characters"
              />
            </div>
            {error && (
              <div className="text-red text-sm bg-red/10 border border-red/20 rounded-lg px-3 py-2">{error}</div>
            )}
            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading ? "Creating..." : "Create Household"}
            </Button>
          </form>
        </Card>
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
