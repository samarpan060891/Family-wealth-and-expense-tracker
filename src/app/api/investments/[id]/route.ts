import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { investments } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/investments/[id]">
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  await db
    .delete(investments)
    .where(and(eq(investments.id, id), eq(investments.householdId, session.householdId)));
  return NextResponse.json({ ok: true });
}
