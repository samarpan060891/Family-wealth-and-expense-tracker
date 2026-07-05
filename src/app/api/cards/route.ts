import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cards, transactions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";
import { getDisplayCurrency } from "@/lib/display";
import { getRate } from "@/lib/fx";
import { isSupportedCurrency } from "@/lib/currency";

// List saved cards with each card's current outstanding, computed from linked
// transactions: purchases add to the balance, bill-payment transfers subtract.
export async function GET() {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const db = await getDb();
    const [cardRows, txRows] = await Promise.all([
      db.select().from(cards).where(eq(cards.householdId, session.householdId)),
      db
        .select({
          cardId: transactions.cardId,
          amount: transactions.amount,
          currency: transactions.currency,
          isTransfer: transactions.isTransfer,
        })
        .from(transactions)
        .where(eq(transactions.householdId, session.householdId)),
    ]);

    // Precompute FX rates for each (txCurrency → cardCurrency) pair we need.
    const rateCache = new Map<string, number>();
    const rate = async (from: string, to: string) => {
      const key = `${from}>${to}`;
      if (!rateCache.has(key)) rateCache.set(key, await getRate(from, to));
      return rateCache.get(key)!;
    };

    const result = [];
    for (const c of cardRows) {
      let outstanding = 0;
      for (const t of txRows) {
        if (t.cardId !== c.id) continue;
        const amt = Number(t.amount) * (await rate(t.currency, c.currency));
        outstanding += t.isTransfer ? -amt : amt;
      }
      result.push({
        ...c,
        outstanding: Math.max(0, Math.round(outstanding * 100) / 100),
      });
    }

    return Response.json({ cards: result });
  });
}

const schema = z.object({
  nickname: z.string().trim().min(1).max(80),
  bank: z.string().trim().max(80).optional(),
  network: z.string().trim().max(30).optional(),
  last4: z.string().regex(/^\d{4}$/).optional().or(z.literal("")),
  creditLimit: z.coerce.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  billingDay: z.coerce.number().min(1).max(31).optional(),
  dueDay: z.coerce.number().min(1).max(31).optional(),
});

export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);
    const d = parsed.data;

    const { base } = await getDisplayCurrency(session);
    const currency = d.currency && isSupportedCurrency(d.currency) ? d.currency : base;

    const db = await getDb();
    const [row] = await db
      .insert(cards)
      .values({
        householdId: session.householdId,
        createdById: session.userId,
        nickname: d.nickname,
        bank: d.bank || null,
        network: d.network || null,
        last4: d.last4 || null,
        creditLimit: d.creditLimit != null ? d.creditLimit.toString() : null,
        currency,
        billingDay: d.billingDay ?? null,
        dueDay: d.dueDay ?? null,
      })
      .returning();

    return Response.json({ card: row });
  });
}
