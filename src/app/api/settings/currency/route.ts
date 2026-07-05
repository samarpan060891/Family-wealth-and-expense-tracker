import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users, households } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";
import { isSupportedCurrency } from "@/lib/currency";

const schema = z.object({
  displayCurrency: z.string().length(3).optional(),
  defaultCurrency: z.string().length(3).optional(), // admin only
});

// Set the viewer's preferred display currency, and (admins) the household default.
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);
    const { displayCurrency, defaultCurrency } = parsed.data;

    if (displayCurrency && !isSupportedCurrency(displayCurrency)) return apiError("Unsupported currency.", 400);
    if (defaultCurrency && !isSupportedCurrency(defaultCurrency)) return apiError("Unsupported currency.", 400);

    const db = await getDb();
    if (displayCurrency) {
      await db.update(users).set({ displayCurrency }).where(eq(users.id, session.userId));
    }
    if (defaultCurrency) {
      if (session.role !== "admin")
        return apiError("Only the main account holder can change the household currency.", 403);
      await db.update(households).set({ defaultCurrency }).where(eq(households.id, session.householdId));
    }

    return Response.json({ ok: true });
  });
}
