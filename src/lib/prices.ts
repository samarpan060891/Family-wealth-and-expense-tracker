// Yahoo Finance quote lookup — used only for currency conversion (src/lib/fx.ts).
const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export type Quote = { price: number; currency: string };

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
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return parseYahooQuote(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
