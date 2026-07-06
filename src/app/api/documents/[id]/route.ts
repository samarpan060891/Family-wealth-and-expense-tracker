import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.householdId, session.householdId)));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = Buffer.from(row.fileData, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": row.fileType,
      "Content-Disposition": `inline; filename="${row.fileName}"`,
    },
  });
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(40).optional(),
  note: z.string().max(2000).nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const db = await getDb();
  await db
    .update(documents)
    .set(parsed.data)
    .where(and(eq(documents.id, id), eq(documents.householdId, session.householdId)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.householdId, session.householdId)));
  return NextResponse.json({ ok: true });
}
