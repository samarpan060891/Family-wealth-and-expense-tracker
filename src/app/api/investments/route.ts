import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { investments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getCategoryFilter, canEdit } from "@/lib/permissions";
import { displayWithRates, getDisplayCurrency } from "@/lib/display";
import { isSupportedCurrency } from "@/lib/currency";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const rows = await db
    .select()
    .from(investments)
    .where(eq(investments.householdId, session.householdId))
    .orderBy(desc(investments.purchaseDate));

  let visible = rows;
  if (session.role !== "admin") {
    const filter = await getCategoryFilter(session, "investment");
    visible = rows.filter((r) => {
      if (filter === "none") return false;
      if (filter === "all") return true;
      return filter.categories.includes(r.type);
    });
  }
  const { displayCurrency, rates } = await displayWithRates(session, visible.map((r) => r.currency));
  return NextResponse.json({ investments: visible, displayCurrency, rates });
}

const schema = z.object({
  name: z.string().min(1).max(150),
  type: z.string().min(1).max(80),
  investedAmount: z.coerce.number().nonnegative(),
  currentValue: z.coerce.number().nonnegative().optional(),
  purchaseDate: z.string(),
  maturityDate: z.string().optional(),
  expectedReturnRate: z.coerce.number().optional(),
  notes: z.string().optional(),
  currency: z.string().length(3).optional(),
  location: z.string().trim().max(200).optional(),
  sizeValue: z.coerce.number().positive().optional(),
  sizeUnit: z.string().trim().max(20).optional(),
  valuationNote: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const allowed = session.role === "admin" || (await canEdit(session, "investment", parsed.data.type));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { base } = await getDisplayCurrency(session);
  const currency =
    parsed.data.currency && isSupportedCurrency(parsed.data.currency) ? parsed.data.currency : base;

  const db = await getDb();
  const [row] = await db
    .insert(investments)
    .values({
      householdId: session.householdId,
      createdById: session.userId,
      name: parsed.data.name,
      type: parsed.data.type,
      currency,
      investedAmount: parsed.data.investedAmount.toString(),
      currentValue: parsed.data.currentValue?.toString(),
      purchaseDate: parsed.data.purchaseDate,
      maturityDate: parsed.data.maturityDate || null,
      expectedReturnRate: parsed.data.expectedReturnRate?.toString(),
      notes: parsed.data.notes,
      location: parsed.data.location || null,
      sizeValue: parsed.data.sizeValue?.toString() ?? null,
      sizeUnit: parsed.data.sizeUnit || null,
      valuationNote: parsed.data.valuationNote || null,
    })
    .returning();

  return NextResponse.json({ investment: row });
}
