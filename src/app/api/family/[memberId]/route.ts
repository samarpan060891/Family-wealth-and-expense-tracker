import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users, sharePermissions } from "@/db/schema";
import { getSession } from "@/lib/auth";

const grantSchema = z.object({
  module: z.enum(["expense", "income", "investment", "debt", "asset", "insurance"]),
  category: z.string().nullable().optional(),
  accessLevel: z.enum(["view", "edit"]).default("view"),
});

const updateSchema = z.object({
  grants: z.array(grantSchema),
});

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/family/[memberId]">
) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { memberId } = await ctx.params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const db = await getDb();
  const [member] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, memberId), eq(users.householdId, session.householdId)));
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await db.delete(sharePermissions).where(eq(sharePermissions.memberId, memberId));
  if (parsed.data.grants.length) {
    await db.insert(sharePermissions).values(
      parsed.data.grants.map((g) => ({
        householdId: session.householdId,
        memberId,
        module: g.module,
        category: g.category ?? null,
        accessLevel: g.accessLevel,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/family/[memberId]">
) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { memberId } = await ctx.params;
  const db = await getDb();
  await db
    .delete(users)
    .where(and(eq(users.id, memberId), eq(users.householdId, session.householdId)));

  return NextResponse.json({ ok: true });
}
