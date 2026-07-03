import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { getDb } from "@/db";
import { transactions, categories, investments, debts, assets, goals, netWorthSnapshots } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getCategoryFilter } from "@/lib/permissions";
import { computeInsights } from "@/lib/insights";
import { summarizeFacts, isAiConfigured } from "@/lib/ai-summary";
import { safeRoute, UNAUTHORIZED } from "@/lib/api";

export const maxDuration = 30;

export async function GET() {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const db = await getDb();
    const [txRows, invRows, debtRows, assetRows, goalRows, snapRows] = await Promise.all([
      db
        .select({
          type: transactions.type,
          amount: transactions.amount,
          date: transactions.date,
          isRecurring: transactions.isRecurring,
          categoryName: categories.name,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(eq(transactions.householdId, session.householdId)),
      db.select().from(investments).where(eq(investments.householdId, session.householdId)),
      db.select().from(debts).where(eq(debts.householdId, session.householdId)),
      db.select().from(assets).where(eq(assets.householdId, session.householdId)),
      db.select().from(goals).where(eq(goals.householdId, session.householdId)),
      db.select().from(netWorthSnapshots).where(eq(netWorthSnapshots.householdId, session.householdId)),
    ]);

    // Respect a member's category visibility for the numbers we analyze.
    let visibleTx = txRows;
    let visibleInv = invRows;
    let visibleDebts = debtRows;
    let visibleAssets = assetRows;
    if (session.role !== "admin") {
      const [expF, incF, invF, debtF, assetF] = await Promise.all([
        getCategoryFilter(session, "expense"),
        getCategoryFilter(session, "income"),
        getCategoryFilter(session, "investment"),
        getCategoryFilter(session, "debt"),
        getCategoryFilter(session, "asset"),
      ]);
      const ok = (f: Awaited<ReturnType<typeof getCategoryFilter>>, v: string | null) =>
        f === "all" ? true : f === "none" ? false : v ? f.categories.includes(v) : false;
      visibleTx = txRows.filter((t) => ok(t.type === "expense" ? expF : incF, t.categoryName));
      visibleInv = invRows.filter((i) => ok(invF, i.type));
      visibleDebts = debtRows.filter((d) => ok(debtF, d.type));
      visibleAssets = assetRows.filter((a) => ok(assetF, a.type));
    }

    const investTotal = visibleInv.reduce((s, i) => s + Number(i.currentValue ?? i.investedAmount), 0);
    const assetTotal = visibleAssets.reduce((s, a) => s + Number(a.value), 0);
    const debtTotal = visibleDebts.reduce((s, d) => s + Number(d.outstandingAmount), 0);
    const netWorth = investTotal + assetTotal - debtTotal;

    // Record today's snapshot once per day (admins only, to keep it a whole-household figure).
    if (session.role === "admin") {
      const today = format(new Date(), "yyyy-MM-dd");
      await db
        .insert(netWorthSnapshots)
        .values({
          householdId: session.householdId,
          date: today,
          netWorth: netWorth.toString(),
          investments: investTotal.toString(),
          assets: assetTotal.toString(),
          debts: debtTotal.toString(),
        })
        .onConflictDoUpdate({
          target: [netWorthSnapshots.householdId, netWorthSnapshots.date],
          set: { netWorth: netWorth.toString(), investments: investTotal.toString(), assets: assetTotal.toString(), debts: debtTotal.toString() },
        });
    }

    const result = computeInsights({
      transactions: visibleTx.map((t) => ({
        type: t.type as "expense" | "income",
        amount: t.amount,
        date: t.date,
        isRecurring: t.isRecurring,
        categoryName: t.categoryName,
      })),
      investments: visibleInv,
      debts: visibleDebts,
      netWorth,
      snapshots: snapRows.map((s) => ({ date: s.date, netWorth: s.netWorth })),
      goals: goalRows.map((g) => ({
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        targetDate: g.targetDate,
      })),
    });

    const aiSummary = await summarizeFacts(result.facts);

    return Response.json({
      summary: aiSummary ?? result.headline,
      aiGenerated: Boolean(aiSummary),
      aiAvailable: isAiConfigured(),
      insights: result.insights,
      anomalies: result.anomalies,
    });
  });
}
