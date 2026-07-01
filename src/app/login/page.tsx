"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, PasswordInput } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Login failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 min-h-screen">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-accent">FamilyWealth</div>
          <div className="text-muted text-sm mt-1">Sign in to your household</div>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label>Password</label>
              <PasswordInput
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
            </div>
            {error && <div className="text-red text-sm">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </Card>
        <div className="text-center text-sm text-muted mt-5">
          New family?{" "}
          <Link href="/register" className="text-accent font-semibold">
            Create a household
          </Link>
        </div>
      </div>
    </div>
  );
}
