import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { educationPlans } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/education-plans/[id]">
) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const db = await getDb();
  await db
    .delete(educationPlans)
    .where(and(eq(educationPlans.id, id), eq(educationPlans.householdId, session.householdId)));

  return NextResponse.json({ ok: true });
}
