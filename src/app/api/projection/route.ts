import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { addMonths, parseISO } from "date-fns";
import { getDb } from "@/db";
import { transactions, familyMembers, educationPlans, marriageBudgets, financialSettings } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { monthlyEquivalent } from "@/lib/cashflow";
import { buildTenYearProjection } from "@/lib/projection";
import { getCountryPreset } from "@/lib/country-presets";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const [txRows, members, plans, budgets, settingsRow] = await Promise.all([
    db.select().from(transactions).where(eq(transactions.householdId, session.householdId)),
    db.select().from(familyMembers).where(eq(familyMembers.householdId, session.householdId)),
    db.select().from(educationPlans).where(eq(educationPlans.householdId, session.householdId)),
    db.select().from(marriageBudgets).where(eq(marriageBudgets.householdId, session.householdId)),
    db.select().from(financialSettings).where(eq(financialSettings.householdId, session.householdId)),
  ]);

  const preset = getCountryPreset("India");
  const settings = settingsRow[0] ?? {
    country: preset.country,
    generalInflationRate: preset.generalInflation.toString(),
    lifestyleUpgradeRate: preset.lifestyleUpgrade.toString(),
    educationInflationRate: preset.educationInflation.toString(),
  };

  const expenseTx = txRows.filter((t) => t.type === "expense");
  const recurringMonthly = expenseTx
    .filter((t) => t.isRecurring)
    .reduce((s, t) => s + monthlyEquivalent(Number(t.amount), t.recurrenceFrequency), 0);

  const now = new Date();
  const threeMonthsAgo = addMonths(now, -3);
  const discretionary = expenseTx.filter((t) => !t.isRecurring && parseISO(t.date) >= threeMonthsAgo);
  const discretionaryMonthlyAvg = discretionary.reduce((s, t) => s + Number(t.amount), 0) / 3;

  const baseAnnualExpense = (recurringMonthly + discretionaryMonthlyAvg) * 12;

  const projection = buildTenYearProjection({
    baseAnnualExpense,
    generalInflationRate: Number(settings.generalInflationRate),
    lifestyleUpgradeRate: Number(settings.lifestyleUpgradeRate),
    educationInflationRate: Number(settings.educationInflationRate),
    familyMembers: members,
    educationPlans: plans,
    marriageBudgets: budgets,
  });

  return NextResponse.json({
    baseAnnualExpense: Math.round(baseAnnualExpense),
    settings,
    projection,
  });
}
