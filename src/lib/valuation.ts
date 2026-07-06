import Anthropic from "@anthropic-ai/sdk";

// Uses Claude's server-side web-search tool to look up recent comparable listings
// / prices and estimate the current market value of an asset (real estate,
// vehicle, gold, etc.). A capable model helps; override with VALUATION_MODEL.
const MODEL = process.env.VALUATION_MODEL ?? process.env.EXTRACTION_MODEL ?? "claude-haiku-4-5";

export function isValuationConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ValuationInput = {
  assetType: string; // e.g. Real Estate, Vehicle, Gold / Jewellery
  name?: string | null;
  location?: string | null;
  sizeValue?: number | null;
  sizeUnit?: string | null;
  details?: string | null; // free text: make/model/year, purity/weight, condition…
  purchasePrice?: number | null;
  purchaseDate?: string | null;
  currency: string;
};

export type ValuationResult = {
  configured: boolean;
  estimatedValue: number | null;
  perUnitValue: number | null;
  unit: string | null;
  currency: string;
  confidence: "low" | "medium" | "high" | null;
  summary: string;
  sources: { title: string; url: string }[];
};

function parseJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return {};
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return {};
  }
}

export async function estimateValue(input: ValuationInput): Promise<ValuationResult> {
  const base: ValuationResult = {
    configured: isValuationConfigured(),
    estimatedValue: null,
    perUnitValue: null,
    unit: input.sizeUnit ?? null,
    currency: input.currency,
    confidence: null,
    summary: "",
    sources: [],
  };
  if (!isValuationConfigured())
    return { ...base, summary: "AI valuation is off — set ANTHROPIC_API_KEY to enable it." };

  const facts = [
    `Asset type: ${input.assetType}`,
    input.name ? `Name/description: ${input.name}` : "",
    input.location ? `Location / area: ${input.location}` : "",
    input.sizeValue && input.sizeUnit ? `Size: ${input.sizeValue} ${input.sizeUnit}` : "",
    input.details ? `Details: ${input.details}` : "",
    input.purchasePrice != null
      ? `Bought for ${input.purchasePrice} ${input.currency}${input.purchaseDate ? ` on ${input.purchaseDate}` : ""}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 } as unknown as Anthropic.Messages.ToolUnion],
    messages: [
      {
        role: "user",
        content:
          `Estimate the current market value of this asset using recent web listings, sale prices or market rates.\n` +
          `${facts}\n\n` +
          `Search recent (last ~6-12 months) comparable listings / prices for this kind of asset in the relevant market ` +
          `(for property: comparable homes in that area and a per-unit rate × the size; for a vehicle: same make/model/year/condition; ` +
          `for gold/jewellery: the current per-gram rate × weight and purity). Report the value in ${input.currency}.\n\n` +
          `Respond with ONLY a JSON object with keys: ` +
          `estimatedValue (number, total value in ${input.currency}, digits only), ` +
          `perUnitValue (number or null), unit (string or null), confidence ("low"|"medium"|"high"), ` +
          `summary (one or two sentences on how you arrived at it and the range seen). ` +
          `No currency symbols or commas in numbers.`,
      },
    ],
  });

  const sources: { title: string; url: string }[] = [];
  let finalText = "";
  for (const block of response.content) {
    if (block.type === "text") {
      finalText += block.text;
      const cites = (block as { citations?: { url?: string; title?: string }[] }).citations;
      if (Array.isArray(cites)) {
        for (const c of cites) if (c.url) sources.push({ title: c.title ?? c.url, url: c.url });
      }
    }
  }

  const parsed = parseJsonObject(finalText);
  const num = (v: unknown) => {
    const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const conf = parsed.confidence;
  const seen = new Set<string>();
  const uniqueSources = sources.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).slice(0, 6);

  return {
    ...base,
    estimatedValue: num(parsed.estimatedValue),
    perUnitValue: num(parsed.perUnitValue),
    unit: typeof parsed.unit === "string" ? parsed.unit : input.sizeUnit ?? null,
    confidence: conf === "low" || conf === "medium" || conf === "high" ? conf : null,
    summary: typeof parsed.summary === "string" ? parsed.summary : "Estimated from recent comparable prices.",
    sources: uniqueSources,
  };
}
