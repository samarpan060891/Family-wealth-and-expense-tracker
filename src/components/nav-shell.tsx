"use client";
import { useEffect, useState } from "react";
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
  { href: "/goals", label: "Goals", icon: "◎" },
];

// Four most-used destinations get a permanent bottom-tab; everything else lives
// behind the "More" sheet so the bar stays thumb-friendly and never scrolls.
const MOBILE_PRIMARY = [
  { href: "/dashboard", label: "Home", icon: "◆" },
  { href: "/expenses", label: "Expenses", icon: "▾" },
  { href: "/investments", label: "Invest", icon: "◈" },
  { href: "/debts", label: "Debts", icon: "◇" },
];

const MOBILE_MORE = [
  { href: "/income", label: "Income", icon: "▴" },
  { href: "/assets", label: "Assets", icon: "▣" },
  { href: "/insurance", label: "Insurance", icon: "◉" },
  { href: "/goals", label: "Goals", icon: "◎" },
  { href: "/cash", label: "Cash & Bank", icon: "▢" },
  { href: "/cards", label: "Cards", icon: "▦" },
  { href: "/reminders", label: "Reminders", icon: "🔔" },
  { href: "/reports", label: "Reports", icon: "▤" },
];

const MOBILE_MORE_ADMIN = [
  { href: "/planning", label: "Life Planning", icon: "◎" },
  { href: "/categories", label: "Categories", icon: "◧" },
  { href: "/family", label: "Family Sharing", icon: "◐" },
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((d) => alive && setReminderCount(d?.counts?.total ?? 0))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // Refresh the badge when navigating between pages.
  }, [pathname]);

  const moreItems = isAdmin ? [...MOBILE_MORE, ...MOBILE_MORE_ADMIN] : MOBILE_MORE;
  const moreActive = moreItems.some((i) => i.href === pathname);

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
          <Link
            href="/cash"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              pathname === "/cash" ? "bg-accent-glow text-accent" : "text-muted hover:text-text hover:bg-surface2"
            }`}
          >
            <span className={`text-xs w-4 text-center ${pathname === "/cash" ? "text-accent" : "text-muted-soft"}`}>
              ▢
            </span>
            Cash &amp; Bank
          </Link>
          <Link
            href="/cards"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              pathname === "/cards" ? "bg-accent-glow text-accent" : "text-muted hover:text-text hover:bg-surface2"
            }`}
          >
            <span className={`text-xs w-4 text-center ${pathname === "/cards" ? "text-accent" : "text-muted-soft"}`}>
              ▦
            </span>
            Cards
          </Link>
          <Link
            href="/reminders"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              pathname === "/reminders" ? "bg-accent-glow text-accent" : "text-muted hover:text-text hover:bg-surface2"
            }`}
          >
            <span className={`text-xs w-4 text-center ${pathname === "/reminders" ? "text-accent" : "text-muted-soft"}`}>
              🔔
            </span>
            Reminders
            {reminderCount > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-red text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {reminderCount}
              </span>
            )}
          </Link>
          <Link
            href="/reports"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              pathname === "/reports" ? "bg-accent-glow text-accent" : "text-muted hover:text-text hover:bg-surface2"
            }`}
          >
            <span className={`text-xs w-4 text-center ${pathname === "/reports" ? "text-accent" : "text-muted-soft"}`}>
              ▤
            </span>
            Reports
          </Link>
          {isAdmin && (
            <>
              <div className="h-px bg-border-soft my-3 mx-3" />
              <Link
                href="/planning"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  pathname === "/planning" ? "bg-accent-glow text-accent" : "text-muted hover:text-text hover:bg-surface2"
                }`}
              >
                <span className="text-xs w-4 text-center text-muted-soft">◎</span>
                Life Planning
              </Link>
              <Link
                href="/categories"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  pathname === "/categories" ? "bg-accent-glow text-accent" : "text-muted hover:text-text hover:bg-surface2"
                }`}
              >
                <span className="text-xs w-4 text-center text-muted-soft">◧</span>
                Categories
              </Link>
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
            <Link href="/account" className="min-w-0 flex-1 group">
              <div className="text-sm font-semibold truncate group-hover:text-accent transition-colors">{userName}</div>
              <div className="text-[11px] text-muted-soft">{isAdmin ? "Main account" : "Member"} · Settings</div>
            </Link>
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
        <header className="lg:hidden sticky top-0 z-40 bg-bg-elevated/90 backdrop-blur-md border-b border-border-soft px-4 py-3 flex items-center justify-between pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div>
            <div className="font-display font-semibold text-accent italic text-lg leading-none">FamilyWealth</div>
            <Link href="/account" className="text-[11px] text-muted-soft mt-1 block">
              {userName} {isAdmin ? "· Main" : "· Member"} · Settings
            </Link>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-5 lg:py-8 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* MOBILE "MORE" SHEET */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-bg-elevated border-t border-border rounded-t-2xl p-4 pb-6 animate-fade-up">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-colors ${
                      active ? "bg-accent-glow text-accent" : "text-muted hover:bg-surface2"
                    }`}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href="/account"
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-colors ${
                  pathname === "/account" ? "bg-accent-glow text-accent" : "text-muted hover:bg-surface2"
                }`}
              >
                <span className="text-base leading-none">⚙</span>
                Settings
              </Link>
              <button
                onClick={logout}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold text-muted hover:bg-surface2 transition-colors"
              >
                <span className="text-base leading-none">⏻</span>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-elevated/95 backdrop-blur-md border-t border-border-soft z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 max-w-2xl mx-auto">
          {MOBILE_PRIMARY.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                  active ? "text-accent" : "text-muted-soft"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={`relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
              moreActive || moreOpen ? "text-accent" : "text-muted-soft"
            }`}
          >
            <span className="text-base leading-none">⋯</span>
            More
            {reminderCount > 0 && (
              <span className="absolute top-1.5 right-[22%] w-4 h-4 text-[9px] font-bold bg-red text-white rounded-full flex items-center justify-center">
                {reminderCount > 9 ? "9+" : reminderCount}
              </span>
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
