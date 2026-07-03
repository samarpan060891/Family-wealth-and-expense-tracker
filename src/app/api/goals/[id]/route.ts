import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { goals } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";

const patchSchema = z.object({
  currentAmount: z.coerce.number().nonnegative().optional(),
  targetAmount: z.coerce.number().positive().optional(),
  targetDate: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(150).optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/goals/[id]">) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    const { id } = await ctx.params;

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    const update: Record<string, string | null> = {};
    if (parsed.data.currentAmount !== undefined) update.currentAmount = parsed.data.currentAmount.toString();
    if (parsed.data.targetAmount !== undefined) update.targetAmount = parsed.data.targetAmount.toString();
    if (parsed.data.targetDate !== undefined) update.targetDate = parsed.data.targetDate || null;
    if (parsed.data.name !== undefined) update.name = parsed.data.name;

    const db = await getDb();
    const [row] = await db
      .update(goals)
      .set(update)
      .where(and(eq(goals.id, id), eq(goals.householdId, session.householdId)))
      .returning();
    if (!row) return apiError("Goal not found.", 404);
    return Response.json({ goal: row });
  });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/goals/[id]">) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    const { id } = await ctx.params;
    const db = await getDb();
    await db.delete(goals).where(and(eq(goals.id, id), eq(goals.householdId, session.householdId)));
    return Response.json({ ok: true });
  });
}
