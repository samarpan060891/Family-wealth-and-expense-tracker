import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, households } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId));
  if (!user) return NextResponse.json({ user: null });

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, session.householdId));

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      householdName: household?.name,
    },
  });
}
