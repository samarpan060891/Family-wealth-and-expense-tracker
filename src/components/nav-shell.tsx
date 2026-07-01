"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/expenses", label: "Expenses", icon: "💳" },
  { href: "/income", label: "Income", icon: "💰" },
  { href: "/investments", label: "Invest", icon: "📈" },
  { href: "/debts", label: "Debts", icon: "🏦" },
  { href: "/assets", label: "Assets", icon: "🏡" },
  { href: "/insurance", label: "Cover", icon: "🛡️" },
];

export function NavShell({
  children,
  userName,
  isAdmin,
}: {
  children: React.ReactNode;
  userName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <header className="sticky top-0 z-40 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-bold text-accent text-lg">FamilyWealth</div>
          <div className="text-xs text-muted">
            {userName}
            {isAdmin ? " · Main account" : " · Member"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/family"
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border border-border ${
                pathname === "/family" ? "text-accent border-accent" : "text-muted"
              }`}
            >
              Family
            </Link>
          )}
          <button
            onClick={logout}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface2 border border-border text-muted"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-2xl w-full mx-auto">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40">
        <div className="flex justify-around max-w-2xl mx-auto">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2 px-2 text-[10px] font-semibold ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
