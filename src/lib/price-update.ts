import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { investments } from "@/db/schema";
import { fetchYahooQuote, fetchAmfiNavMap, isAmfiSchemeCode } from "@/lib/prices";
import { getRate } from "@/lib/fx";

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

  // Load AMFI NAVs once, only if any holding needs a mutual-fund lookup.
  const needsAmfi = eligible.some((r) => isAmfiSchemeCode(r.symbol!));
  const navMap = needsAmfi ? await fetchAmfiNavMap() : new Map<string, number>();

  for (const r of eligible) {
    const symbol = r.symbol!.trim();
    const qty = Number(r.quantity);
    const holdingCurrency = r.currency || "INR";
    try {
      // Price per unit expressed in the holding's own currency.
      let pricePerUnit: number | null = null;

      if (isAmfiSchemeCode(symbol)) {
        const nav = navMap.get(symbol); // AMFI NAV is in INR
        pricePerUnit = nav != null ? nav * (await getRate("INR", holdingCurrency)) : null;
      } else {
        const quote = await fetchYahooQuote(symbol);
        if (quote) {
          const fx = await getRate(quote.currency, holdingCurrency);
          pricePerUnit = quote.price * fx;
        }
      }

      if (pricePerUnit == null || !Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
        result.failed++;
        result.details.push({ id: r.id, name: r.name, ok: false, reason: "No price found" });
        continue;
      }

      const value = Math.round(qty * pricePerUnit * 100) / 100;
      await db
        .update(investments)
        .set({
          currentValue: value.toString(),
          lastPrice: pricePerUnit.toString(),
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
