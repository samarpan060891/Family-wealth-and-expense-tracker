import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { transactions, categories, debts, insurances, investments, cards, reminderCompletions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { safeRoute, UNAUTHORIZED } from "@/lib/api";
import { computeReminders } from "@/lib/reminders";
import { getRate } from "@/lib/fx";

// All open "action needed" reminders for the household, cross-referenced against
// what's already been marked done.
export async function GET() {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const db = await getDb();
    const [txRows, debtRows, insRows, invRows, doneRows] = await Promise.all([
      db
        .select({
          id: transactions.id,
          type: transactions.type,
          amount: transactions.amount,
          currency: transactions.currency,
          date: transactions.date,
          isRecurring: transactions.isRecurring,
          recurrenceFrequency: transactions.recurrenceFrequency,
          categoryName: categories.name,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(and(eq(transactions.householdId, session.householdId), eq(transactions.isRecurring, true))),
      db.select().from(debts).where(eq(debts.householdId, session.householdId)),
      db.select().from(insurances).where(eq(insurances.householdId, session.householdId)),
      db.select().from(investments).where(eq(investments.householdId, session.householdId)),
      db.select().from(reminderCompletions).where(eq(reminderCompletions.householdId, session.householdId)),
    ]);

    // Cards + their outstanding (for payment-due reminders).
    const [cardRows, cardTx] = await Promise.all([
      db.select().from(cards).where(eq(cards.householdId, session.householdId)),
      db
        .select({ cardId: transactions.cardId, amount: transactions.amount, currency: transactions.currency, isTransfer: transactions.isTransfer })
        .from(transactions)
        .where(eq(transactions.householdId, session.householdId)),
    ]);
    const cardDues = [];
    for (const c of cardRows) {
      let outstanding = 0;
      for (const t of cardTx) {
        if (t.cardId !== c.id) continue;
        const amt = Number(t.amount) * (await getRate(t.currency, c.currency));
        outstanding += t.isTransfer ? -amt : amt;
      }
      cardDues.push({ id: c.id, nickname: c.nickname, currency: c.currency, dueDay: c.dueDay, outstanding: Math.max(0, outstanding) });
    }

    const completed = new Set(doneRows.map((r) => `${r.kind}:${r.sourceId}:${r.dueDate}`));

    const items = computeReminders({
      transactions: txRows.map((t) => ({
        id: t.id,
        type: t.type as "income" | "expense",
        amount: t.amount,
        currency: t.currency,
        date: t.date,
        isRecurring: t.isRecurring,
        recurrenceFrequency: t.recurrenceFrequency,
        categoryName: t.categoryName,
      })),
      debts: debtRows,
      insurances: insRows,
      investments: invRows,
      cards: cardDues,
      completed,
    });

    const counts = {
      total: items.length,
      overdue: items.filter((i) => i.status === "overdue").length,
      dueSoon: items.filter((i) => i.status === "due_soon").length,
    };

    return Response.json({ items, counts });
  });
}
