// Pure, client-safe currency conversion using a prefetched {currency→rate} map.
// (Kept separate from fx.ts so client bundles don't pull in server-only code.)
export function convertWith(amount: number, from: string, ratesMap: Record<string, number>): number {
  return amount * (ratesMap[from] ?? 1);
}
