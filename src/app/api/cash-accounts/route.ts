import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cashAccounts, transactions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";
import { getDisplayCurrency } from "@/lib/display";
import { computeBalances } from "@/lib/cash";
import { isSupportedCurrency } from "@/lib/currency";

// List cash/bank accounts with each account's live balance (opening + income − expenses).
export async function GET() {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const db = await getDb();
    const [accounts, txs] = await Promise.all([
      db.select().from(cashAccounts).where(eq(cashAccounts.householdId, session.householdId)),
      db
        .select({
          accountId: transactions.accountId,
          type: transactions.type,
          amount: transactions.amount,
          currency: transactions.currency,
          paymentMethod: transactions.paymentMethod,
        })
        .from(transactions)
        .where(eq(transactions.householdId, session.householdId)),
    ]);

    const balances = await computeBalances(
      accounts,
      txs.map((t) => ({ ...t, type: t.type as "income" | "expense" }))
    );

    return Response.json({
      accounts: accounts.map((a) => ({ ...a, balance: balances.get(a.id) ?? Number(a.openingBalance) })),
    });
  });
}

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["bank", "cash", "wallet"]).default("bank"),
  currency: z.string().length(3).optional(),
  openingBalance: z.coerce.number().optional(),
});

export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    const { base } = await getDisplayCurrency(session);
    const currency = parsed.data.currency && isSupportedCurrency(parsed.data.currency) ? parsed.data.currency : base;

    const db = await getDb();
    const [row] = await db
      .insert(cashAccounts)
      .values({
        householdId: session.householdId,
        createdById: session.userId,
        name: parsed.data.name,
        kind: parsed.data.kind,
        currency,
        openingBalance: (parsed.data.openingBalance ?? 0).toString(),
      })
      .returning();

    return Response.json({ account: row });
  });
}
