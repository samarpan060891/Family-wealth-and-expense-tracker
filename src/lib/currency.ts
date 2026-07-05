// Supported currencies for a household that spans countries. Amounts are stored in
// their own currency on each record; conversion for totals happens via src/lib/fx.ts.

export type CurrencyInfo = { code: string; symbol: string; name: string; locale: string };

export const CURRENCIES: CurrencyInfo[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", locale: "en-AE" },
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "en-IE" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", locale: "en-SA" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);
export const DEFAULT_CURRENCY = "INR";

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function currencyInfo(code: string | null | undefined): CurrencyInfo {
  return (code && BY_CODE.get(code)) || BY_CODE.get(DEFAULT_CURRENCY)!;
}

export function isSupportedCurrency(code: string): boolean {
  return BY_CODE.has(code);
}

/** Format an amount in a given currency (whole units, currency symbol, locale grouping). */
export function formatMoney(amount: number, code: string | null | undefined): string {
  const info = currencyInfo(code);
  try {
    return new Intl.NumberFormat(info.locale, {
      style: "currency",
      currency: info.code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Fallback if the runtime lacks the locale/currency data.
    return `${info.symbol}${Math.round(amount).toLocaleString()}`;
  }
}
