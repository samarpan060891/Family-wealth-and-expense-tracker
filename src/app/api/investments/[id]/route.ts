import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { investments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { apiError, safeRoute, UNAUTHORIZED, FORBIDDEN } from "@/lib/api";

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
