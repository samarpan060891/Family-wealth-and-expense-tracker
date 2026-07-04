import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { investments } from "@/db/schema";
import {
  fetchYahooQuote,
  fetchFxToInr,
  fetchAmfiNavMap,
  isAmfiSchemeCode,
} from "@/lib/prices";

export type PriceUpdateResult = {
  updated: number;
  failed: number;
  skipped: number;
  details: { id: string; name: string; ok: boolean; value?: number; reason?: string }[];
};

type Row = typeof investments.$inferSelect;

// Refresh currentValue for a set of auto-update holdings. Shared by the manual
// "Refresh prices" button (one household) and the weekly cron (all households).
async function priceHoldings(rows: Row[]): Promise<PriceUpdateResult> {
  const result: PriceUpdateResult = { updated: 0, failed: 0, skipped: 0, details: [] };
  const eligible = rows.filter((r) => r.autoUpdate && r.symbol && r.quantity);
  if (eligible.length === 0) return result;

  const db = await getDb();
  const fxCache = new Map<string, number>();

  // Load AMFI NAVs once, only if any holding needs a mutual-fund lookup.
  const needsAmfi = eligible.some((r) => isAmfiSchemeCode(r.symbol!));
  const navMap = needsAmfi ? await fetchAmfiNavMap() : new Map<string, number>();

  for (const r of eligible) {
    const symbol = r.symbol!.trim();
    const qty = Number(r.quantity);
    try {
      let priceInr: number | null = null;

      if (isAmfiSchemeCode(symbol)) {
        const nav = navMap.get(symbol);
        priceInr = nav ?? null; // AMFI NAV is already in INR
      } else {
        const quote = await fetchYahooQuote(symbol);
        if (quote) {
          const fx = await fetchFxToInr(quote.currency, fxCache);
          if (fx != null) priceInr = quote.price * fx;
        }
      }

      if (priceInr == null || !Number.isFinite(priceInr) || priceInr <= 0) {
        result.failed++;
        result.details.push({ id: r.id, name: r.name, ok: false, reason: "No price found" });
        continue;
      }

      const value = Math.round(qty * priceInr * 100) / 100;
      await db
        .update(investments)
        .set({
          currentValue: value.toString(),
          lastPrice: priceInr.toString(),
          lastPricedAt: new Date(),
        })
        .where(eq(investments.id, r.id));

      result.updated++;
      result.details.push({ id: r.id, name: r.name, ok: true, value });
    } catch {
      result.failed++;
      result.details.push({ id: r.id, name: r.name, ok: false, reason: "Fetch error" });
    }
  }
  return result;
}

/** Update every auto-update holding in one household. */
export async function updateHouseholdPrices(householdId: string): Promise<PriceUpdateResult> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(investments)
    .where(and(eq(investments.householdId, householdId), eq(investments.autoUpdate, true)));
  return priceHoldings(rows);
}

/** Update auto-update holdings across all households (used by the weekly cron). */
export async function updateAllPrices(): Promise<PriceUpdateResult> {
  const db = await getDb();
  const rows = await db.select().from(investments).where(eq(investments.autoUpdate, true));
  return priceHoldings(rows);
}
