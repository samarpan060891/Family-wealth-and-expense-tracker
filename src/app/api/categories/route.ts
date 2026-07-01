import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const moduleParam = req.nextUrl.searchParams.get("module");
  const db = await getDb();
  const where = moduleParam
    ? and(eq(categories.householdId, session.householdId), eq(categories.module, moduleParam as "expense" | "income"))
    : eq(categories.householdId, session.householdId);

  const rows = await db.select().from(categories).where(where);
  return NextResponse.json({ categories: rows });
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
