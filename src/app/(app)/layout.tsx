import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { NavShell } from "@/components/nav-shell";

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

  return (
    <NavShell userName={user.name} isAdmin={user.role === "admin"}>
      {children}
    </NavShell>
  );
}
