/** Strips currency symbols, thousands separators and stray text from an extracted amount. */
export function cleanAmount(value: string | null | undefined): string {
  if (!value) return "";
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned || Number.isNaN(Number(cleaned))) return "";
  return cleaned;
}

/** Returns the value only if it looks like a YYYY-MM-DD date, else empty string. */
export function cleanDate(value: string | null | undefined): string {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}
