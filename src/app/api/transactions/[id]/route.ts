import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { transactions, categories } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED, FORBIDDEN } from "@/lib/api";

const patchSchema = z.object({
  cardId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  isTransfer: z.boolean().optional(),
});

// Update an existing entry — currently to (re)assign it to a credit card and/or
// mark it as a card bill payment / transfer.
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/transactions/[id]">) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    const db = await getDb();
    const [row] = await db
      .select({ id: transactions.id, type: transactions.type, categoryName: categories.name })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(eq(transactions.id, id), eq(transactions.householdId, session.householdId)));
    if (!row) return apiError("Entry not found.", 404);
    if (!(await canEdit(session, row.type, row.categoryName))) return FORBIDDEN();

    const [updated] = await db
      .update(transactions)
      .set({
        ...(parsed.data.cardId !== undefined ? { cardId: parsed.data.cardId } : {}),
        ...(parsed.data.accountId !== undefined ? { accountId: parsed.data.accountId } : {}),
        ...(parsed.data.isTransfer !== undefined ? { isTransfer: parsed.data.isTransfer } : {}),
      })
      .where(and(eq(transactions.id, id), eq(transactions.householdId, session.householdId)))
      .returning();

    return Response.json({ transaction: updated });
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/transactions/[id]">
) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const { id } = await ctx.params;
    const db = await getDb();

    // Load the row (scoped to the household) so we know which category it belongs to.
    const [row] = await db
      .select({ id: transactions.id, type: transactions.type, categoryName: categories.name })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(eq(transactions.id, id), eq(transactions.householdId, session.householdId)));

    if (!row) return apiError("Entry not found.", 404);

    // A member may only delete entries in categories they have edit access to.
    if (!(await canEdit(session, row.type, row.categoryName))) return FORBIDDEN();

    await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.householdId, session.householdId)));

    return Response.json({ ok: true });
  });
}
