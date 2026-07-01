import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users, sharePermissions } from "@/db/schema";
import { getSession, hashPassword } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const members = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.householdId, session.householdId));

  const permissions = await db
    .select()
    .from(sharePermissions)
    .where(eq(sharePermissions.householdId, session.householdId));

  return NextResponse.json({
    members: members.map((m) => ({
      ...m,
      permissions: permissions.filter((p) => p.memberId === m.id),
    })),
  });
}

const grantSchema = z.object({
  module: z.enum(["expense", "income", "investment", "debt", "asset", "insurance"]),
  category: z.string().nullable().optional(),
  accessLevel: z.enum(["view", "edit"]).default("view"),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  grants: z.array(grantSchema).default([]),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Only the main account holder can add family members" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const { name, email, password, grants } = parsed.data;
  const db = await getDb();

  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (existing.length > 0)
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const [member] = await db
    .insert(users)
    .values({
      householdId: session.householdId,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "member",
    })
    .returning();

  if (grants.length) {
    await db.insert(sharePermissions).values(
      grants.map((g) => ({
        householdId: session.householdId,
        memberId: member.id,
        module: g.module,
        category: g.category ?? null,
        accessLevel: g.accessLevel,
      }))
    );
  }

  return NextResponse.json({ member: { id: member.id, name: member.name, email: member.email } });
}
