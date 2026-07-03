import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { debts } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { apiError, safeRoute, UNAUTHORIZED, FORBIDDEN } from "@/lib/api";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/debts/[id]">
) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    const { id } = await ctx.params;
    const db = await getDb();

    const [row] = await db
      .select({ id: debts.id, type: debts.type })
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.householdId, session.householdId)));
    if (!row) return apiError("Debt not found.", 404);
    if (!(await canEdit(session, "debt", row.type))) return FORBIDDEN();

    await db.delete(debts).where(and(eq(debts.id, id), eq(debts.householdId, session.householdId)));
    return Response.json({ ok: true });
  });
}
