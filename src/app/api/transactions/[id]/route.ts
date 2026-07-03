import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { transactions, categories } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { apiError, safeRoute, UNAUTHORIZED, FORBIDDEN } from "@/lib/api";

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
