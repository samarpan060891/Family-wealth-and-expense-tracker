import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { debts } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getCategoryFilter, canEdit } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const rows = await db
    .select()
    .from(debts)
    .where(eq(debts.householdId, session.householdId))
    .orderBy(desc(debts.startDate));

  if (session.role === "admin") return NextResponse.json({ debts: rows });

  const filter = await getCategoryFilter(session, "debt");
  const visible = rows.filter((r) => {
    if (filter === "none") return false;
    if (filter === "all") return true;
    return filter.categories.includes(r.type);
  });
  return NextResponse.json({ debts: visible });
}

const schema = z.object({
  name: z.string().min(1).max(150),
  lender: z.string().optional(),
  type: z.string().min(1).max(80),
  principal: z.coerce.number().nonnegative(),
  outstandingAmount: z.coerce.number().nonnegative(),
  interestRate: z.coerce.number().optional(),
  emiAmount: z.coerce.number().optional(),
  emiDay: z.coerce.number().min(1).max(31).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const allowed = session.role === "admin" || (await canEdit(session, "debt", parsed.data.type));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const [row] = await db
    .insert(debts)
    .values({
      householdId: session.householdId,
      createdById: session.userId,
      name: parsed.data.name,
      lender: parsed.data.lender,
      type: parsed.data.type,
      principal: parsed.data.principal.toString(),
      outstandingAmount: parsed.data.outstandingAmount.toString(),
      interestRate: parsed.data.interestRate?.toString(),
      emiAmount: parsed.data.emiAmount?.toString(),
      emiDay: parsed.data.emiDay?.toString(),
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate || null,
      notes: parsed.data.notes,
    })
    .returning();

  return NextResponse.json({ debt: row });
}
