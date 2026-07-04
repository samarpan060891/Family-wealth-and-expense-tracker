// Free market-price providers, no API key required:
//  - Yahoo Finance chart endpoint for stocks / ETFs / metals / FX.
//  - AMFI (Association of Mutual Funds in India) daily NAV file for Indian MFs.
//
// The fetchers are thin wrappers around pure parsers (parseYahooQuote / parseAmfiNav)
// so the parsing logic can be unit-tested without network access.

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";
const AMFI_NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt";
// A desktop UA avoids Yahoo's occasional bot throttling.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export type Quote = { price: number; currency: string };

async function timedFetch(url: string, timeoutMs = 9000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*" },
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

// ---- Yahoo Finance -----------------------------------------------------------

export function parseYahooQuote(json: unknown): Quote | null {
  const meta = (json as { chart?: { result?: { meta?: { regularMarketPrice?: unknown; currency?: unknown } }[] } })
    ?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  const price = Number(meta.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  const currency = typeof meta.currency === "string" && meta.currency ? meta.currency.toUpperCase() : "USD";
  return { price, currency };
}

export async function fetchYahooQuote(symbol: string): Promise<Quote | null> {
  const url = `${YAHOO_BASE}${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  try {
    const res = await timedFetch(url);
    if (!res.ok) return null;
    return parseYahooQuote(await res.json());
  } catch {
    return null;
  }
}

// ---- Currency conversion to INR ---------------------------------------------

/** Latest exchange rate: 1 unit of `currency` in INR. Uses a cache to avoid refetching. */
export async function fetchFxToInr(currency: string, cache: Map<string, number>): Promise<number | null> {
  const cur = currency.toUpperCase();
  if (cur === "INR") return 1;
  if (cache.has(cur)) return cache.get(cur)!;
  const q = await fetchYahooQuote(`${cur}INR=X`);
  if (!q) return null;
  cache.set(cur, q.price);
  return q.price;
}

// ---- AMFI mutual-fund NAV ----------------------------------------------------

/**
 * Parse the AMFI NAVAll.txt content and return the NAV (INR) for a scheme code.
 * File rows look like: `120503;INF...;INF...;Scheme Name;123.4567;07-Jul-2026`
 */
export function parseAmfiNav(text: string, schemeCode: string): number | null {
  const code = schemeCode.trim();
  for (const line of text.split("\n")) {
    if (!line.includes(";")) continue;
    const parts = line.split(";");
    if (parts[0].trim() !== code) continue;
    const nav = Number(parts[4]);
    return Number.isFinite(nav) && nav > 0 ? nav : null;
  }
  return null;
}

/** Fetch the full AMFI NAV file once and return a code→NAV map. */
export async function fetchAmfiNavMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await timedFetch(AMFI_NAV_URL, 15000);
    if (!res.ok) return map;
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (!line.includes(";")) continue;
      const parts = line.split(";");
      const code = parts[0]?.trim();
      const nav = Number(parts[4]);
      if (code && /^\d+$/.test(code) && Number.isFinite(nav) && nav > 0) map.set(code, nav);
    }
  } catch {
    /* return whatever we have (possibly empty) */
  }
  return map;
}

/** A numeric symbol denotes an AMFI mutual-fund scheme code; otherwise it's a Yahoo ticker. */
export function isAmfiSchemeCode(symbol: string): boolean {
  return /^\d+$/.test(symbol.trim());
}
