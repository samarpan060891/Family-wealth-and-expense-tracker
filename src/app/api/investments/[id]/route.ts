import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { investments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED, FORBIDDEN } from "@/lib/api";

const patchSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  type: z.string().min(1).max(80).optional(),
  investedAmount: z.coerce.number().nonnegative().optional(),
  currentValue: z.coerce.number().nonnegative().nullable().optional(),
  purchaseDate: z.string().optional(),
  maturityDate: z.string().nullable().optional(),
  expectedReturnRate: z.coerce.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  autoUpdate: z.boolean().optional(),
  symbol: z.string().trim().max(40).nullable().optional(),
  quantity: z.coerce.number().nonnegative().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/investments/[id]">) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    const { id } = await ctx.params;

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    const db = await getDb();
    const [row] = await db
      .select()
      .from(investments)
      .where(and(eq(investments.id, id), eq(investments.householdId, session.householdId)));
    if (!row) return apiError("Investment not found.", 404);
    // Permission is checked against the current type and, if changing, the new type too.
    if (!(await canEdit(session, "investment", row.type))) return FORBIDDEN();
    if (parsed.data.type && !(await canEdit(session, "investment", parsed.data.type))) return FORBIDDEN();

    const d = parsed.data;
    const [updated] = await db
      .update(investments)
      .set({
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.type !== undefined ? { type: d.type } : {}),
        ...(d.investedAmount !== undefined ? { investedAmount: d.investedAmount.toString() } : {}),
        ...(d.currentValue !== undefined ? { currentValue: d.currentValue?.toString() ?? null } : {}),
        ...(d.purchaseDate !== undefined ? { purchaseDate: d.purchaseDate } : {}),
        ...(d.maturityDate !== undefined ? { maturityDate: d.maturityDate || null } : {}),
        ...(d.expectedReturnRate !== undefined
          ? { expectedReturnRate: d.expectedReturnRate?.toString() ?? null }
          : {}),
        ...(d.notes !== undefined ? { notes: d.notes ?? null } : {}),
        ...(d.autoUpdate !== undefined ? { autoUpdate: d.autoUpdate } : {}),
        ...(d.symbol !== undefined ? { symbol: d.symbol || null } : {}),
        ...(d.quantity !== undefined ? { quantity: d.quantity?.toString() ?? null } : {}),
      })
      .where(and(eq(investments.id, id), eq(investments.householdId, session.householdId)))
      .returning();

    return Response.json({ investment: updated });
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/investments/[id]">
) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    const { id } = await ctx.params;
    const db = await getDb();

    const [row] = await db
      .select({ id: investments.id, type: investments.type })
      .from(investments)
      .where(and(eq(investments.id, id), eq(investments.householdId, session.householdId)));
    if (!row) return apiError("Investment not found.", 404);
    if (!(await canEdit(session, "investment", row.type))) return FORBIDDEN();

    await db
      .delete(investments)
      .where(and(eq(investments.id, id), eq(investments.householdId, session.householdId)));
    return Response.json({ ok: true });
  });
}
