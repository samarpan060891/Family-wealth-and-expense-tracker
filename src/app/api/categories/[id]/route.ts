import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { getSession } from "@/lib/auth";

// Renaming or deleting a shared household category affects everyone, so these are
// restricted to the admin. Deleting a category leaves its transactions in place —
// they simply become "Uncategorized" (categoryId is set to null by the FK rule).

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z.string().max(20).optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/categories/[id]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin")
    return NextResponse.json({ error: "Only the main account holder can edit categories." }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const db = await getDb();
  const [cat] = await db.select().from(categories).where(eq(categories.id, id));
  if (!cat || cat.householdId !== session.householdId)
    return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const name = parsed.data.name?.trim();
  if (name) {
    const siblings = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.householdId, session.householdId), eq(categories.module, cat.module)));
    if (siblings.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase()))
      return NextResponse.json({ error: "That category already exists." }, { status: 409 });
  }

  const [row] = await db
    .update(categories)
    .set({
      ...(name ? { name } : {}),
      ...(parsed.data.color ? { color: parsed.data.color } : {}),
    })
    .where(eq(categories.id, id))
    .returning();

  return NextResponse.json({ category: row });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/categories/[id]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin")
    return NextResponse.json({ error: "Only the main account holder can delete categories." }, { status: 403 });

  const { id } = await ctx.params;
  const db = await getDb();
  const [cat] = await db.select().from(categories).where(eq(categories.id, id));
  if (!cat || cat.householdId !== session.householdId)
    return NextResponse.json({ error: "Category not found" }, { status: 404 });

  await db.delete(categories).where(eq(categories.id, id));
  return NextResponse.json({ ok: true });
}
