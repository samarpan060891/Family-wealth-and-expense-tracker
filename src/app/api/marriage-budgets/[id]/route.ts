import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { marriageBudgets } from "@/db/schema";
import { getSession } from "@/lib/auth";

const patchSchema = z.object({ included: z.boolean() });

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/marriage-budgets/[id]">
) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { id } = await ctx.params;
  const db = await getDb();
  const [row] = await db
    .update(marriageBudgets)
    .set({ included: parsed.data.included })
    .where(and(eq(marriageBudgets.id, id), eq(marriageBudgets.householdId, session.householdId)))
    .returning();

  return NextResponse.json({ marriageBudget: row });
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/marriage-budgets/[id]">
) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const db = await getDb();
  await db
    .delete(marriageBudgets)
    .where(and(eq(marriageBudgets.id, id), eq(marriageBudgets.householdId, session.householdId)));

  return NextResponse.json({ ok: true });
}
