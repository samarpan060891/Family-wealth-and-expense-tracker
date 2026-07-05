import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { investments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";

const rowSchema = z.object({
  name: z.string().trim().min(1).max(150),
  type: z.string().trim().min(1).max(80),
  symbol: z.string().trim().max(40).nullable().optional(),
  quantity: z.coerce.number().nonnegative().nullable().optional(),
  investedAmount: z.coerce.number().nonnegative().nullable().optional(),
  currentValue: z.coerce.number().nonnegative().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
});

const schema = z.object({ rows: z.array(rowSchema).min(1).max(500) });

// Create the reviewed holdings. Each row is permission-checked against the user's
// edit rights for that investment type; rows they can't edit are skipped.
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    const db = await getDb();
    const today = new Date().toISOString().slice(0, 10);
    let created = 0;
    let skippedNoPermission = 0;
    const values: (typeof investments.$inferInsert)[] = [];

    for (const r of parsed.data.rows) {
      const allowed = session.role === "admin" || (await canEdit(session, "investment", r.type));
      if (!allowed) {
        skippedNoPermission++;
        continue;
      }
      // Auto-update only when we have both a symbol and a quantity to price against.
      const autoUpdate = Boolean(r.symbol) && r.quantity != null && r.quantity > 0;
      values.push({
        householdId: session.householdId,
        createdById: session.userId,
        name: r.name,
        type: r.type,
        investedAmount: (r.investedAmount ?? 0).toString(),
        currentValue: r.currentValue != null ? r.currentValue.toString() : null,
        purchaseDate: r.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(r.purchaseDate) ? r.purchaseDate : today,
        autoUpdate,
        symbol: r.symbol || null,
        quantity: r.quantity != null ? r.quantity.toString() : null,
      });
      created++;
    }

    if (values.length > 0) await db.insert(investments).values(values);

    return Response.json({ created, skippedNoPermission });
  });
}
