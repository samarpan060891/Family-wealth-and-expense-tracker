import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { assets } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/assets/[id]">
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  await db.delete(assets).where(and(eq(assets.id, id), eq(assets.householdId, session.householdId)));
  return NextResponse.json({ ok: true });
}
