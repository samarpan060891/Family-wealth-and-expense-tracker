import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { insurances } from "@/db/schema";
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
    .from(insurances)
    .where(eq(insurances.householdId, session.householdId))
    .orderBy(desc(insurances.expiryDate));

  let visible = rows;
  if (session.role !== "admin") {
    const filter = await getCategoryFilter(session, "insurance");
    visible = rows.filter((r) => {
      if (filter === "none") return false;
      if (filter === "all") return true;
      return filter.categories.includes(r.type);
    });
  }
  const { displayCurrency, rates } = await displayWithRates(session, visible.map((r) => r.currency));
  return NextResponse.json({ insurances: visible, displayCurrency, rates });
}

const schema = z.object({
  name: z.string().min(1).max(150),
  type: z.string().min(1).max(80),
  provider: z.string().optional(),
  policyNumber: z.string().optional(),
  premiumAmount: z.coerce.number().nonnegative(),
  currency: z.string().length(3).optional(),
  premiumFrequency: z.enum(["one_time", "monthly", "quarterly", "half_yearly", "yearly"]),
  startDate: z.string(),
  expiryDate: z.string(),
  sumAssured: z.coerce.number().optional(),
  nominee: z.string().optional(),
  claimHelpline: z.string().optional(),
  insurerHelpline: z.string().optional(),
  agentName: z.string().optional(),
  agentPhone: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const allowed = session.role === "admin" || (await canEdit(session, "insurance", parsed.data.type));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { base } = await getDisplayCurrency(session);
  const currency =
    parsed.data.currency && isSupportedCurrency(parsed.data.currency) ? parsed.data.currency : base;

  const db = await getDb();
  const [row] = await db
    .insert(insurances)
    .values({
      householdId: session.householdId,
      createdById: session.userId,
      name: parsed.data.name,
      type: parsed.data.type,
      provider: parsed.data.provider,
      policyNumber: parsed.data.policyNumber,
      currency,
      premiumAmount: parsed.data.premiumAmount.toString(),
      premiumFrequency: parsed.data.premiumFrequency,
      startDate: parsed.data.startDate,
      expiryDate: parsed.data.expiryDate,
      sumAssured: parsed.data.sumAssured?.toString(),
      nominee: parsed.data.nominee,
      claimHelpline: parsed.data.claimHelpline,
      insurerHelpline: parsed.data.insurerHelpline,
      agentName: parsed.data.agentName,
      agentPhone: parsed.data.agentPhone,
      notes: parsed.data.notes,
    })
    .returning();

  return NextResponse.json({ insurance: row });
}
