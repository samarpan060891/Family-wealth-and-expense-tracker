import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cashAccounts, transactions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";
import { isSupportedCurrency } from "@/lib/currency";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  kind: z.enum(["bank", "cash", "wallet"]).optional(),
  currency: z.string().length(3).optional(),
  openingBalance: z.coerce.number().optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/cash-accounts/[id]">) {
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
      .select({ id: cashAccounts.id })
      .from(cashAccounts)
      .where(and(eq(cashAccounts.id, id), eq(cashAccounts.householdId, session.householdId)));
    if (!existing) return apiError("Account not found.", 404);

    const [row] = await db
      .update(cashAccounts)
      .set({
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.kind !== undefined ? { kind: d.kind } : {}),
        ...(d.currency !== undefined ? { currency: d.currency } : {}),
        ...(d.openingBalance !== undefined ? { openingBalance: d.openingBalance.toString() } : {}),
      })
      .where(and(eq(cashAccounts.id, id), eq(cashAccounts.householdId, session.householdId)))
      .returning();

    return Response.json({ account: row });
  });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/cash-accounts/[id]">) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    const { id } = await ctx.params;

    const db = await getDb();
    const [existing] = await db
      .select({ id: cashAccounts.id })
      .from(cashAccounts)
      .where(and(eq(cashAccounts.id, id), eq(cashAccounts.householdId, session.householdId)));
    if (!existing) return apiError("Account not found.", 404);

    // Un-link transactions (kept as records), then delete the account.
    await db
      .update(transactions)
      .set({ accountId: null })
      .where(and(eq(transactions.accountId, id), eq(transactions.householdId, session.householdId)));
    await db.delete(cashAccounts).where(and(eq(cashAccounts.id, id), eq(cashAccounts.householdId, session.householdId)));

    return Response.json({ ok: true });
  });
}
