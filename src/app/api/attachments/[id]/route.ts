import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/attachments/[id]">
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.householdId, session.householdId)));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = Buffer.from(row.fileData, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": row.fileType,
      "Content-Disposition": `inline; filename="${row.fileName}"`,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/attachments/[id]">
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  await db
    .delete(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.householdId, session.householdId)));
  return NextResponse.json({ ok: true });
}
