import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { assets } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getCategoryFilter, canEdit } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const rows = await db
    .select()
    .from(assets)
    .where(eq(assets.householdId, session.householdId))
    .orderBy(desc(assets.createdAt));

  if (session.role === "admin") return NextResponse.json({ assets: rows });

  const filter = await getCategoryFilter(session, "asset");
  const visible = rows.filter((r) => {
    if (filter === "none") return false;
    if (filter === "all") return true;
    return filter.categories.includes(r.type);
  });
  return NextResponse.json({ assets: visible });
}

const schema = z.object({
  name: z.string().min(1).max(150),
  type: z.string().min(1).max(80),
  value: z.coerce.number().nonnegative(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const allowed = session.role === "admin" || (await canEdit(session, "asset", parsed.data.type));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const [row] = await db
    .insert(assets)
    .values({
      householdId: session.householdId,
      createdById: session.userId,
      name: parsed.data.name,
      type: parsed.data.type,
      value: parsed.data.value.toString(),
      purchaseDate: parsed.data.purchaseDate || null,
      notes: parsed.data.notes,
    })
    .returning();

  return NextResponse.json({ asset: row });
}
