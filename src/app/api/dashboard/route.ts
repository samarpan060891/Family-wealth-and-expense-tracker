import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { transactions, categories, debts, insurances, investments, assets, netWorthSnapshots } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getCategoryFilter } from "@/lib/permissions";
import { buildCashflowProjection, upcomingExpiries } from "@/lib/cashflow";
import { getDisplayCurrency } from "@/lib/display";
import { ratesTo } from "@/lib/fx";
import { format, parseISO } from "date-fns";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();

  const [txRows, debtRows, insuranceRows, investmentRows, assetRows] = await Promise.all([
    db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        currency: transactions.currency,
        date: transactions.date,
        isRecurring: transactions.isRecurring,
        recurrenceFrequency: transactions.recurrenceFrequency,
        paymentMethod: transactions.paymentMethod,
        note: transactions.note,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.householdId, session.householdId)),
    db.select().from(debts).where(eq(debts.householdId, session.householdId)),
    db.select().from(insurances).where(eq(insurances.householdId, session.householdId)),
    db.select().from(investments).where(eq(investments.householdId, session.householdId)),
    db.select().from(assets).where(eq(assets.householdId, session.householdId)),
  ]);

  const snapRows = await db
    .select()
    .from(netWorthSnapshots)
    .where(eq(netWorthSnapshots.householdId, session.householdId));

  let visibleTx = txRows;
  let visibleDebts = debtRows;
  let visibleInsurances = insuranceRows;
  let visibleInvestments = investmentRows;
  let visibleAssets = assetRows;

  if (session.role !== "admin") {
    const [expenseFilter, incomeFilter, debtFilter, insuranceFilter, investmentFilter, assetFilter] =
      await Promise.all([
        getCategoryFilter(session, "expense"),
        getCategoryFilter(session, "income"),
        getCategoryFilter(session, "debt"),
        getCategoryFilter(session, "insurance"),
        getCategoryFilter(session, "investment"),
        getCategoryFilter(session, "asset"),
      ]);

    const matches = (filter: Awaited<ReturnType<typeof getCategoryFilter>>, value: string | null) => {
      if (filter === "none") return false;
      if (filter === "all") return true;
      return value ? filter.categories.includes(value) : false;
    };

    visibleTx = txRows.filter((t) =>
      matches(t.type === "expense" ? expenseFilter : incomeFilter, t.categoryName)
    );
    visibleDebts = debtRows.filter((d) => matches(debtFilter, d.type));
    visibleInsurances = insuranceRows.filter((i) => matches(insuranceFilter, i.type));
    visibleInvestments = investmentRows.filter((i) => matches(investmentFilter, i.type));
    visibleAssets = assetRows.filter((a) => matches(assetFilter, a.type));
  }

  // Everything on the dashboard is shown in the viewer's display currency; convert
  // each record from its own currency using current FX rates.
  const { display: displayCurrency, base } = await getDisplayCurrency(session);
  const currencies = new Set<string>([base, displayCurrency]);
  for (const t of visibleTx) currencies.add(t.currency);
  for (const i of visibleInvestments) currencies.add(i.currency);
  for (const a of visibleAssets) currencies.add(a.currency);
  for (const d of visibleDebts) currencies.add(d.currency);
  const rates = await ratesTo(displayCurrency, currencies);
  const cv = (amount: number, currency: string) => amount * (rates[currency] ?? 1);

  // Monthly trend: last 12 months income vs expense
  const monthlyTotals: Record<string, { income: number; expense: number }> = {};
  for (const t of visibleTx) {
    const key = format(parseISO(t.date), "MMM yyyy");
    monthlyTotals[key] ??= { income: 0, expense: 0 };
    monthlyTotals[key][t.type as "income" | "expense"] += cv(Number(t.amount), t.currency);
  }

  const currentMonthKey = format(new Date(), "yyyy-MM");
  const categoryBreakdown: Record<string, number> = {};
  for (const t of visibleTx) {
    if (t.type !== "expense") continue;
    if (!t.date.startsWith(currentMonthKey)) continue;
    const name = t.categoryName ?? "Uncategorized";
    categoryBreakdown[name] = (categoryBreakdown[name] ?? 0) + cv(Number(t.amount), t.currency);
  }

  const netWorth =
    visibleInvestments.reduce((s, i) => s + cv(Number(i.currentValue ?? i.investedAmount), i.currency), 0) +
    visibleAssets.reduce((s, a) => s + cv(Number(a.value), a.currency), 0) -
    visibleDebts.reduce((s, d) => s + cv(Number(d.outstandingAmount), d.currency), 0);

  // Net worth trend from recorded daily snapshots. Fall back to a single point at
  // today's value so a brand-new household still shows a sensible chart.
  // Snapshots are stored in the household base currency; convert to display.
  const netWorthTrend = snapRows
    .map((s) => ({ date: s.date, netWorth: cv(Number(s.netWorth), base) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const todayIso = format(new Date(), "yyyy-MM-dd");
  if (!netWorthTrend.some((p) => p.date === todayIso)) {
    netWorthTrend.push({ date: todayIso, netWorth });
  }

  // This month's savings rate = (income − expense) / income.
  const thisMonthIncome = visibleTx
    .filter((t) => t.type === "income" && t.date.startsWith(currentMonthKey))
    .reduce((s, t) => s + cv(Number(t.amount), t.currency), 0);
  const thisMonthExpense = Object.values(categoryBreakdown).reduce((s, v) => s + v, 0);
  const savingsRate = thisMonthIncome > 0 ? (thisMonthIncome - thisMonthExpense) / thisMonthIncome : null;

  // Recent transactions (most recent 100) for the searchable list and pie drill-down.
  const recentTransactions = [...visibleTx]
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
    .slice(0, 100)
    .map((t) => ({
      id: t.id,
      type: t.type as "income" | "expense",
      amount: cv(Number(t.amount), t.currency),
      date: t.date,
      category: t.categoryName ?? "Uncategorized",
      paymentMethod: t.paymentMethod,
      note: t.note,
    }));

  // Cashflow projection also in display currency: convert amounts before projecting.
  const cashflowProjection = buildCashflowProjection(
    visibleTx.map((t) => ({
      type: t.type as "income" | "expense",
      amount: cv(Number(t.amount), t.currency).toString(),
      date: t.date,
      isRecurring: t.isRecurring,
      recurrenceFrequency: t.recurrenceFrequency,
    })),
    visibleDebts.map((d) => ({ ...d, emiAmount: d.emiAmount != null ? cv(Number(d.emiAmount), d.currency).toString() : d.emiAmount })),
    visibleInsurances.map((i) => ({ ...i, premiumAmount: cv(Number(i.premiumAmount), i.currency).toString() }))
  );

  const expiringInsurances = upcomingExpiries(visibleInsurances, "expiryDate").map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    expiryDate: i.expiryDate,
    kind: "insurance" as const,
  }));
  const maturingInvestments = upcomingExpiries(visibleInvestments, "maturityDate").map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    expiryDate: i.maturityDate,
    kind: "investment" as const,
  }));
  const endingDebts = upcomingExpiries(visibleDebts, "endDate").map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    expiryDate: d.endDate,
    kind: "debt" as const,
  }));

  return NextResponse.json({
    monthlyTrend: Object.entries(monthlyTotals)
      .map(([month, v]) => ({ month, ...v }))
      .slice(-12),
    categoryBreakdown: Object.entries(categoryBreakdown).map(([name, amount]) => ({ name, amount })),
    netWorth,
    netWorthTrend,
    savingsRate,
    thisMonthIncome,
    recentTransactions,
    displayCurrency,
    totals: {
      investments: visibleInvestments.reduce((s, i) => s + cv(Number(i.currentValue ?? i.investedAmount), i.currency), 0),
      assets: visibleAssets.reduce((s, a) => s + cv(Number(a.value), a.currency), 0),
      debts: visibleDebts.reduce((s, d) => s + cv(Number(d.outstandingAmount), d.currency), 0),
      thisMonthExpense,
    },
    cashflowProjection,
    upcomingExpiries: [...expiringInsurances, ...maturingInvestments, ...endingDebts].sort((a, b) =>
      (a.expiryDate ?? "").localeCompare(b.expiryDate ?? "")
    ),
  });
}
