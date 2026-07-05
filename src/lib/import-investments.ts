import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import { INVESTMENT_TYPES } from "@/lib/categories";

const MODEL = process.env.EXTRACTION_MODEL ?? "claude-haiku-4-5";

export type ImportRow = {
  name: string;
  type: string; // one of INVESTMENT_TYPES (or "Other")
  symbol: string | null; // ticker / AMFI scheme code
  quantity: number | null;
  investedAmount: number | null;
  currentValue: number | null;
  purchaseDate: string | null; // YYYY-MM-DD
};

export type ParsedTable = { headers: string[]; rows: string[][] };

/** Read the first sheet of an xlsx/csv buffer into a header row + string data rows. */
export function parseSheet(buffer: Buffer): ParsedTable {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const first = wb.SheetNames[0];
  if (!first) return { headers: [], rows: [] };
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[first], {
    header: 1,
    blankrows: false,
    defval: "",
  });
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = (grid[0] as unknown[]).map((h) => String(h ?? "").trim());
  const rows = grid.slice(1).map((r) => (r as unknown[]).map((c) => String(c ?? "").trim()));
  // Drop fully-empty rows.
  return { headers, rows: rows.filter((r) => r.some((c) => c !== "")) };
}

function normalizeType(raw: string | null | undefined): string {
  if (!raw) return "Other";
  const r = raw.toLowerCase();
  const exact = INVESTMENT_TYPES.find((t) => t.toLowerCase() === r);
  if (exact) return exact;
  const partial = INVESTMENT_TYPES.find((t) => r.includes(t.toLowerCase()) || t.toLowerCase().includes(r));
  if (partial) return partial;
  // A few common aliases.
  if (/\bmf\b|mutual/.test(r)) return "Mutual Fund";
  if (/\betf\b/.test(r)) return "ETF";
  if (/stock|equity|share/.test(r)) return "Stocks";
  if (/gold|silver|metal/.test(r)) return "Gold";
  if (/\bfd\b|fixed deposit/.test(r)) return "Fixed Deposit";
  return "Other";
}

function toNumber(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function toDate(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// ---- Heuristic (no-AI) mapping ----------------------------------------------

const HEADER_PATTERNS: Record<keyof Omit<ImportRow, "type">, RegExp> & { type: RegExp } = {
  name: /name|scheme|security|fund|stock|holding|instrument|particular|description/i,
  type: /^type$|category|asset\s*class|instrument\s*type/i,
  symbol: /symbol|ticker|isin|scheme\s*code|^code$|amfi/i,
  quantity: /qty|quantity|units|shares|no\.?\s*of/i,
  investedAmount: /invest|cost|buy\s*value|purchase\s*value|principal|amount\s*invested|^amount$/i,
  currentValue: /current|market\s*value|present\s*value|latest\s*value|valuation|^value$/i,
  purchaseDate: /purchase\s*date|buy\s*date|^date$|start\s*date|investment\s*date/i,
};

function heuristicMap(table: ParsedTable): ImportRow[] {
  const idx: Partial<Record<keyof ImportRow, number>> = {};
  table.headers.forEach((h, i) => {
    for (const key of Object.keys(HEADER_PATTERNS) as (keyof ImportRow)[]) {
      if (idx[key] === undefined && HEADER_PATTERNS[key].test(h)) idx[key] = i;
    }
  });
  const get = (row: string[], key: keyof ImportRow) => (idx[key] !== undefined ? row[idx[key]!] : "");
  return table.rows
    .map((row) => ({
      name: get(row, "name") || row[0] || "",
      type: normalizeType(get(row, "type")),
      symbol: get(row, "symbol") || null,
      quantity: toNumber(get(row, "quantity")),
      investedAmount: toNumber(get(row, "investedAmount")),
      currentValue: toNumber(get(row, "currentValue")),
      purchaseDate: toDate(get(row, "purchaseDate")),
    }))
    .filter((r) => r.name);
}

// ---- AI mapping --------------------------------------------------------------

function parseJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const arr = JSON.parse(candidate.slice(start, end + 1));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function aiMap(table: ParsedTable): Promise<ImportRow[] | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // Cap rows sent to keep the prompt small.
  const sample = table.rows.slice(0, 200);
  const tsv = [table.headers.join("\t"), ...sample.map((r) => r.join("\t"))].join("\n");

  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content:
          `This is a spreadsheet of investment holdings (tab-separated, first line = headers). ` +
          `Convert every data row into a JSON array. Each item must have exactly these keys: ` +
          `name, type, symbol, quantity, investedAmount, currentValue, purchaseDate.\n` +
          `- type: map to the closest of ${INVESTMENT_TYPES.join(", ")} (use "Other" if unclear).\n` +
          `- symbol: the ticker or AMFI scheme code if present, else null. Keep any exchange suffix (e.g. .NS/.BO).\n` +
          `- quantity/investedAmount/currentValue: plain numbers (no symbols/commas), or null.\n` +
          `- purchaseDate: YYYY-MM-DD or null.\n` +
          `Respond with ONLY the JSON array, no commentary.\n\n` +
          tsv,
      },
    ],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  const arr = parseJsonArray(block.text);
  if (arr.length === 0) return null;

  return arr
    .map((o) => {
      const r = o as Record<string, unknown>;
      return {
        name: String(r.name ?? "").trim(),
        type: normalizeType(typeof r.type === "string" ? r.type : null),
        symbol: r.symbol ? String(r.symbol).trim() : null,
        quantity: toNumber(r.quantity == null ? null : String(r.quantity)),
        investedAmount: toNumber(r.investedAmount == null ? null : String(r.investedAmount)),
        currentValue: toNumber(r.currentValue == null ? null : String(r.currentValue)),
        purchaseDate: toDate(r.purchaseDate == null ? null : String(r.purchaseDate)),
      };
    })
    .filter((r) => r.name);
}

/** Parse a spreadsheet buffer into draft holdings (AI mapping when configured, else heuristic). */
export async function draftHoldingsFromSheet(buffer: Buffer): Promise<{ rows: ImportRow[]; aiUsed: boolean }> {
  const table = parseSheet(buffer);
  if (table.headers.length === 0) return { rows: [], aiUsed: false };
  try {
    const ai = await aiMap(table);
    if (ai && ai.length) return { rows: ai, aiUsed: true };
  } catch {
    /* fall back to heuristics */
  }
  return { rows: heuristicMap(table), aiUsed: false };
}
