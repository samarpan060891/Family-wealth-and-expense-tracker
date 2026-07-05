import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, households } from "@/db/schema";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import { ratesTo } from "@/lib/fx";
import type { SessionPayload } from "@/lib/auth";

// Resolve the viewer's display currency (falls back to the household default).
export async function getDisplayCurrency(
  session: SessionPayload
): Promise<{ display: string; base: string }> {
  const db = await getDb();
  const [u] = await db
    .select({ d: users.displayCurrency })
    .from(users)
    .where(eq(users.id, session.userId));
  const [h] = await db
    .select({ d: households.defaultCurrency })
    .from(households)
    .where(eq(households.id, session.householdId));
  const base = h?.d ?? DEFAULT_CURRENCY;
  return { display: u?.d ?? base, base };
}

// Convenience: display currency + a {currency→rate} map covering the given rows,
// for a list endpoint to return so the client can total in the display currency.
export async function displayWithRates(
  session: SessionPayload,
  currencies: Iterable<string>
): Promise<{ displayCurrency: string; rates: Record<string, number> }> {
  const { display } = await getDisplayCurrency(session);
  const rates = await ratesTo(display, currencies);
  return { displayCurrency: display, rates };
}
