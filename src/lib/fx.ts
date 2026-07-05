import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { fxRates } from "@/db/schema";
import { fetchYahooQuote } from "@/lib/prices";

// Exchange-rate helper. Rates are fetched from Yahoo Finance (free, no key),
// cached in the fx_rates table, and refreshed when older than the TTL. All amounts
// in the app are converted to a viewer's display currency only for aggregation;
// the stored per-record amounts never change.

const TTL_MS = 12 * 60 * 60 * 1000; // refresh a pair at most twice a day
const mem = new Map<string, { rate: number; at: number }>(); // per-process cache

/** Rate to multiply an amount in `from` to get `to` (e.g. AED→INR ≈ 22.6). */
export async function getRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const key = `${from}${to}`;
  const now = Date.now();

  const cached = mem.get(key);
  if (cached && now - cached.at < TTL_MS) return cached.rate;

  const db = await getDb();
  const [row] = await db
    .select()
    .from(fxRates)
    .where(and(eq(fxRates.base, from), eq(fxRates.quote, to)));
  if (row && now - new Date(row.fetchedAt).getTime() < TTL_MS) {
    const r = Number(row.rate);
    mem.set(key, { rate: r, at: new Date(row.fetchedAt).getTime() });
    return r;
  }

  // Fetch a fresh rate. Try the direct pair, then cross via USD.
  let rate = await fetchPair(from, to);
  if (rate == null) {
    const a = await fetchPair(from, "USD");
    const b = await fetchPair("USD", to);
    if (a != null && b != null) rate = a * b;
  }
  if (rate == null) {
    // Give up gracefully: use the stale cached value if any, else 1 (no conversion).
    if (row) return Number(row.rate);
    return 1;
  }

  await db
    .insert(fxRates)
    .values({ base: from, quote: to, rate: rate.toString(), fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: [fxRates.base, fxRates.quote],
      set: { rate: rate.toString(), fetchedAt: new Date() },
    });
  mem.set(key, { rate, at: now });
  return rate;
}

async function fetchPair(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  const q = await fetchYahooQuote(`${from}${to}=X`);
  return q && q.price > 0 ? q.price : null;
}

/** Build a map of {currency → rate to `display`} for a set of source currencies. */
export async function ratesTo(display: string, currencies: Iterable<string>): Promise<Record<string, number>> {
  const unique = new Set<string>(currencies);
  const out: Record<string, number> = {};
  await Promise.all(
    [...unique].map(async (c) => {
      out[c] = await getRate(c, display);
    })
  );
  out[display] = 1;
  return out;
}

/** Convert using a prefetched rates map (rate falls back to 1 if missing). */
export function convertWith(amount: number, from: string, ratesMap: Record<string, number>): number {
  return amount * (ratesMap[from] ?? 1);
}
