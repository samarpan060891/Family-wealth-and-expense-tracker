import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { debts } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { buildAmortizationSchedule } from "@/lib/amortization";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/debts/[id]/amortization">
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const db = await getDb();
  const [debt] = await db
    .select()
    .from(debts)
    .where(and(eq(debts.id, id), eq(debts.householdId, session.householdId)));

  if (!debt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!debt.emiAmount || !debt.interestRate) {
    return NextResponse.json(
      { error: "This loan needs both an EMI amount and an interest rate to compute a schedule." },
      { status: 400 }
    );
  }

  const result = buildAmortizationSchedule({
    outstandingAmount: Number(debt.outstandingAmount),
    annualInterestRate: Number(debt.interestRate),
    emiAmount: Number(debt.emiAmount),
  });

  return NextResponse.json({ debt: { name: debt.name, outstandingAmount: debt.outstandingAmount }, ...result });
}
