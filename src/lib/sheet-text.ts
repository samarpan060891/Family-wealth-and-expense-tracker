import * as XLSX from "xlsx";

// Converts an uploaded spreadsheet (xlsx/xls/csv) to compact CSV-like text so the
// document auto-fill can read it as cheap plain text (no vision, few tokens),
// instead of skipping spreadsheets entirely. Output is capped to bound token use.

const MAX_CHARS = 12000;
const MAX_ROWS = 200;

export function spreadsheetToText(base64: string): string {
  try {
    const buf = Buffer.from(base64, "base64");
    // cellDates + raw:false keep dates as readable strings instead of Excel serials.
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const chunks: string[] = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws) continue;
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "", raw: false });
      if (rows.length === 0) continue;
      const lines = rows
        .slice(0, MAX_ROWS)
        .map((r) => (r as unknown[]).map((c) => String(c ?? "").trim()).join(" | "))
        .filter((l) => l.replace(/[|\s]/g, "") !== "");
      if (lines.length) chunks.push(`# Sheet: ${name}\n${lines.join("\n")}`);
    }
    return chunks.join("\n\n").slice(0, MAX_CHARS).trim();
  } catch {
    return "";
  }
}

export function isSpreadsheet(fileType: string): boolean {
  return /spreadsheet|excel|csv|\.xls|ms-excel/i.test(fileType);
}
