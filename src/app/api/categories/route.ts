import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getEditableCategoryFilter } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const moduleParam = req.nextUrl.searchParams.get("module");
  const db = await getDb();
  const where = moduleParam
    ? and(eq(categories.householdId, session.householdId), eq(categories.module, moduleParam as "expense" | "income"))
    : eq(categories.householdId, session.householdId);

  const rows = await db.select().from(categories).where(where);

  // Non-admins adding an expense/income entry should only be offered categories they can
  // actually save into - otherwise they can pick one, submit, and get a confusing 403.
  if (session.role === "admin" || !moduleParam || (moduleParam !== "expense" && moduleParam !== "income")) {
    return NextResponse.json({ categories: rows });
  }

  const filter = await getEditableCategoryFilter(session, moduleParam);
  const visible =
    filter === "none" ? [] : filter === "all" ? rows : rows.filter((r) => filter.categories.includes(r.name));

  return NextResponse.json({ categories: visible });
}

const schema = z.object({
  module: z.enum(["expense", "income"]),
  name: z.string().min(1).max(80),
  color: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const db = await getDb();
  const [row] = await db
    .insert(categories)
    .values({
      householdId: session.householdId,
      module: parsed.data.module,
      name: parsed.data.name,
      color: parsed.data.color ?? "#f0a500",
    })
    .returning();

  return NextResponse.json({ category: row });
}
