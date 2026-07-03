import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { assets } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { apiError, safeRoute, UNAUTHORIZED, FORBIDDEN } from "@/lib/api";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/assets/[id]">
) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    const { id } = await ctx.params;
    const db = await getDb();

    const [row] = await db
      .select({ id: assets.id, type: assets.type })
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.householdId, session.householdId)));
    if (!row) return apiError("Asset not found.", 404);
    if (!(await canEdit(session, "asset", row.type))) return FORBIDDEN();

    await db.delete(assets).where(and(eq(assets.id, id), eq(assets.householdId, session.householdId)));
    return Response.json({ ok: true });
  });
}
