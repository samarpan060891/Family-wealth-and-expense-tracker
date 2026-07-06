import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { getDb } from "@/db";
import { transactions, categories, investments, debts, assets, goals, netWorthSnapshots, cashAccounts, cards } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getCategoryFilter } from "@/lib/permissions";
import { computeInsights } from "@/lib/insights";
import { summarizeFacts, isAiConfigured } from "@/lib/ai-summary";
import { safeRoute, UNAUTHORIZED } from "@/lib/api";
import { getDisplayCurrency } from "@/lib/display";
import { ratesTo, getRate } from "@/lib/fx";
import { computeBalances } from "@/lib/cash";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    // The AI summary spends API tokens, so it's opt-in: only generated when the
    // client explicitly asks with ?ai=1 (the "Generate summary" button). The rest
    // of this endpoint (insights, anomalies, snapshot) is deterministic and free.
    const wantAiSummary = req.nextUrl.searchParams.get("ai") === "1";

    const db = await getDb();
    const [txRows, invRows, debtRows, assetRows, goalRows, snapRows] = await Promise.all([
      db
        .select({
          type: transactions.type,
          amount: transactions.amount,
          currency: transactions.currency,
          isTransfer: transactions.isTransfer,
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

    // Aggregate everything in the household base currency (snapshots + insights).
    const { base } = await getDisplayCurrency(session);
    const currencies = new Set<string>([base]);
    for (const i of visibleInv) currencies.add(i.currency);
    for (const a of visibleAssets) currencies.add(a.currency);
    for (const d of visibleDebts) currencies.add(d.currency);
    for (const t of visibleTx) currencies.add(t.currency);
    const rates = await ratesTo(base, currencies);
    const cv = (amount: number, currency: string) => amount * (rates[currency] ?? 1);

    // Cash accounts (+) and card outstanding (−), in base currency.
    const [accountRows, cardRows, balanceTx] = await Promise.all([
      db.select().from(cashAccounts).where(eq(cashAccounts.householdId, session.householdId)),
      db.select().from(cards).where(eq(cards.householdId, session.householdId)),
      db
        .select({
          accountId: transactions.accountId,
          cardId: transactions.cardId,
          type: transactions.type,
          amount: transactions.amount,
          currency: transactions.currency,
          paymentMethod: transactions.paymentMethod,
          isTransfer: transactions.isTransfer,
        })
        .from(transactions)
        .where(eq(transactions.householdId, session.householdId)),
    ]);
    for (const a of accountRows) currencies.add(a.currency);
    for (const c of cardRows) currencies.add(c.currency);
    const rates2 = await ratesTo(base, currencies);
    const cv2 = (amount: number, currency: string) => amount * (rates2[currency] ?? 1);

    const balances = await computeBalances(
      accountRows,
      balanceTx.map((t) => ({ ...t, type: t.type as "income" | "expense" }))
    );
    const cashTotal = accountRows.reduce((s, a) => s + cv2(balances.get(a.id) ?? 0, a.currency), 0);
    let cardTotal = 0;
    for (const c of cardRows) {
      let bal = 0;
      for (const t of balanceTx) {
        if (t.cardId !== c.id) continue;
        bal += (t.isTransfer ? -1 : 1) * Number(t.amount) * (await getRate(t.currency, c.currency));
      }
      cardTotal += cv2(Math.max(0, bal), c.currency);
    }

    const investTotal = visibleInv.reduce((s, i) => s + cv(Number(i.currentValue ?? i.investedAmount), i.currency), 0);
    const assetTotal = visibleAssets.reduce((s, a) => s + cv(Number(a.value), a.currency), 0);
    const debtTotal = visibleDebts.reduce((s, d) => s + cv(Number(d.outstandingAmount), d.currency), 0);
    const netWorth = investTotal + assetTotal + cashTotal - debtTotal - cardTotal;

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
      transactions: visibleTx
        .filter((t) => !t.isTransfer)
        .map((t) => ({
          type: t.type as "expense" | "income",
          amount: cv(Number(t.amount), t.currency).toString(),
          date: t.date,
          isRecurring: t.isRecurring,
          categoryName: t.categoryName,
        })),
      investments: visibleInv.map((i) => ({
        ...i,
        investedAmount: cv(Number(i.investedAmount), i.currency).toString(),
        currentValue: i.currentValue != null ? cv(Number(i.currentValue), i.currency).toString() : i.currentValue,
      })),
      debts: visibleDebts.map((d) => ({
        ...d,
        outstandingAmount: cv(Number(d.outstandingAmount), d.currency).toString(),
      })),
      netWorth,
      snapshots: snapRows.map((s) => ({ date: s.date, netWorth: s.netWorth })),
      goals: goalRows.map((g) => ({
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        targetDate: g.targetDate,
      })),
    });

    const aiSummary = wantAiSummary ? await summarizeFacts(result.facts) : null;

    return Response.json({
      summary: aiSummary ?? result.headline,
      aiGenerated: Boolean(aiSummary),
      aiAvailable: isAiConfigured(),
      insights: result.insights,
      anomalies: result.anomalies,
    });
  });
}
