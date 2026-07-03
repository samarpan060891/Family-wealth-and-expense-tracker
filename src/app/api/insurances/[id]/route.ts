import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { insurances } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { apiError, safeRoute, UNAUTHORIZED, FORBIDDEN } from "@/lib/api";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/insurances/[id]">
) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    const { id } = await ctx.params;
    const db = await getDb();

    const [row] = await db
      .select({ id: insurances.id, type: insurances.type })
      .from(insurances)
      .where(and(eq(insurances.id, id), eq(insurances.householdId, session.householdId)));
    if (!row) return apiError("Policy not found.", 404);
    if (!(await canEdit(session, "insurance", row.type))) return FORBIDDEN();

    await db
      .delete(insurances)
      .where(and(eq(insurances.id, id), eq(insurances.householdId, session.householdId)));
    return Response.json({ ok: true });
  });
}
