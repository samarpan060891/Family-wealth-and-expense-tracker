"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "◆" },
  { href: "/expenses", label: "Expenses", icon: "▾" },
  { href: "/income", label: "Income", icon: "▴" },
  { href: "/investments", label: "Investments", icon: "◈" },
  { href: "/debts", label: "Debts", icon: "◇" },
  { href: "/assets", label: "Assets", icon: "▣" },
  { href: "/insurance", label: "Insurance", icon: "◉" },
];

const MOBILE_NAV = [
  { href: "/dashboard", label: "Home", icon: "◆" },
  { href: "/expenses", label: "Expense", icon: "▾" },
  { href: "/income", label: "Income", icon: "▴" },
  { href: "/investments", label: "Invest", icon: "◈" },
  { href: "/debts", label: "Debts", icon: "◇" },
  { href: "/assets", label: "Assets", icon: "▣" },
  { href: "/insurance", label: "Cover", icon: "◉" },
];

export function NavShell({
  children,
  userName,
  householdName,
  isAdmin,
}: {
  children: React.ReactNode;
  userName: string;
  householdName?: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border-soft bg-bg-elevated sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-border-soft flex items-start justify-between gap-2">
          <div>
            <div className="font-display text-xl font-semibold text-accent italic">FamilyWealth</div>
            <div className="text-[11px] font-mono text-muted-soft tracking-wide mt-0.5">
              {householdName ?? "Household"}
            </div>
          </div>
          <ThemeToggle className="shrink-0" />
        </div>
        <nav className="flex-1 px-3 py-5 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-accent-glow text-accent"
                    : "text-muted hover:text-text hover:bg-surface2"
                }`}
              >
                <span className={`text-xs w-4 text-center ${active ? "text-accent" : "text-muted-soft"}`}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <>
              <div className="h-px bg-border-soft my-3 mx-3" />
              <Link
                href="/family"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  pathname === "/family" ? "bg-accent-glow text-accent" : "text-muted hover:text-text hover:bg-surface2"
                }`}
              >
                <span className="text-xs w-4 text-center text-muted-soft">◐</span>
                Family Sharing
              </Link>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-border-soft">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-surface3 border border-border flex items-center justify-center text-xs font-bold text-accent shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{userName}</div>
              <div className="text-[11px] text-muted-soft">{isAdmin ? "Main account" : "Member"}</div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="text-muted hover:text-red transition-colors text-xs shrink-0"
            >
              Exit
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* MOBILE HEADER */}
        <header className="lg:hidden sticky top-0 z-40 bg-bg-elevated/90 backdrop-blur-md border-b border-border-soft px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-display font-semibold text-accent italic text-lg leading-none">FamilyWealth</div>
            <div className="text-[11px] text-muted-soft mt-1">
              {userName} {isAdmin ? "· Main" : "· Member"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAdmin && (
              <Link
                href="/family"
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border border-border ${
                  pathname === "/family" ? "text-accent border-accent/50" : "text-muted"
                }`}
              >
                Family
              </Link>
            )}
            <button
              onClick={logout}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface2 border border-border text-muted"
            >
              Exit
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-5 lg:py-8 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-elevated/95 backdrop-blur-md border-t border-border-soft z-40">
        <div className="flex justify-around max-w-2xl mx-auto overflow-x-auto no-scrollbar">
          {MOBILE_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2.5 px-2.5 text-[10px] font-semibold transition-colors ${
                  active ? "text-accent" : "text-muted-soft"
                }`}
              >
                <span className="text-sm leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
