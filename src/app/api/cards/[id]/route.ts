import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cards, transactions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";
import { isSupportedCurrency } from "@/lib/currency";

const patchSchema = z.object({
  nickname: z.string().trim().min(1).max(80).optional(),
  bank: z.string().trim().max(80).nullable().optional(),
  network: z.string().trim().max(30).nullable().optional(),
  last4: z.string().regex(/^\d{4}$/).nullable().optional().or(z.literal("")),
  creditLimit: z.coerce.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).optional(),
  billingDay: z.coerce.number().min(1).max(31).nullable().optional(),
  dueDay: z.coerce.number().min(1).max(31).nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/cards/[id]">) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    const { id } = await ctx.params;

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);
    const d = parsed.data;
    if (d.currency && !isSupportedCurrency(d.currency)) return apiError("Unsupported currency.", 400);

    const db = await getDb();
    const [existing] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, id), eq(cards.householdId, session.householdId)));
    if (!existing) return apiError("Card not found.", 404);

    const [row] = await db
      .update(cards)
      .set({
        ...(d.nickname !== undefined ? { nickname: d.nickname } : {}),
        ...(d.bank !== undefined ? { bank: d.bank || null } : {}),
        ...(d.network !== undefined ? { network: d.network || null } : {}),
        ...(d.last4 !== undefined ? { last4: d.last4 || null } : {}),
        ...(d.creditLimit !== undefined ? { creditLimit: d.creditLimit != null ? d.creditLimit.toString() : null } : {}),
        ...(d.currency !== undefined ? { currency: d.currency } : {}),
        ...(d.billingDay !== undefined ? { billingDay: d.billingDay } : {}),
        ...(d.dueDay !== undefined ? { dueDay: d.dueDay } : {}),
      })
      .where(and(eq(cards.id, id), eq(cards.householdId, session.householdId)))
      .returning();

    return Response.json({ card: row });
  });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/cards/[id]">) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    const { id } = await ctx.params;

    const db = await getDb();
    const [existing] = await db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.id, id), eq(cards.householdId, session.householdId)));
    if (!existing) return apiError("Card not found.", 404);

    // Unlink transactions from the card (they stay as records), then remove it.
    await db
      .update(transactions)
      .set({ cardId: null })
      .where(and(eq(transactions.cardId, id), eq(transactions.householdId, session.householdId)));
    await db.delete(cards).where(and(eq(cards.id, id), eq(cards.householdId, session.householdId)));

    return Response.json({ ok: true });
  });
}
