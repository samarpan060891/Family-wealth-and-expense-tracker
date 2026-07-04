import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/db";
import { users, households, webauthnCredentials } from "@/db/schema";
import { NavShell } from "@/components/nav-shell";
import { AppLockGate } from "@/components/app-lock-gate";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  if (!user) redirect("/login");
  const [household] = await db.select().from(households).where(eq(households.id, session.householdId));

  const creds = user.appLockEnabled
    ? await db
        .select({ id: webauthnCredentials.id })
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.userId, session.userId))
    : [];

  return (
    <AppLockGate enabled={user.appLockEnabled} hasBiometric={creds.length > 0}>
      <NavShell userName={user.name} householdName={household?.name} isAdmin={user.role === "admin"}>
        {children}
      </NavShell>
    </AppLockGate>
  );
}
