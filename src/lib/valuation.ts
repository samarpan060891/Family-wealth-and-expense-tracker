import Anthropic from "@anthropic-ai/sdk";

// Uses Claude's server-side web-search tool to look up recent comparable listings
// / sale prices for a property's area and estimate its current market value.
// A capable model helps here; override with VALUATION_MODEL if desired.
const MODEL = process.env.VALUATION_MODEL ?? process.env.EXTRACTION_MODEL ?? "claude-haiku-4-5";

export function isValuationConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ValuationInput = {
  location: string;
  sizeValue?: number | null;
  sizeUnit?: string | null;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
  currency: string;
  propertyName?: string | null;
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

export async function estimateProperty(input: ValuationInput): Promise<ValuationResult> {
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

  const size = input.sizeValue && input.sizeUnit ? `${input.sizeValue} ${input.sizeUnit}` : "unspecified size";
  const bought =
    input.purchasePrice != null
      ? `It was purchased for ${input.purchasePrice} ${input.currency}${input.purchaseDate ? ` on ${input.purchaseDate}` : ""}.`
      : "";

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 } as unknown as Anthropic.Messages.ToolUnion],
    messages: [
      {
        role: "user",
        content:
          `Estimate the current market value of this real-estate property using recent web listings and sale prices.\n` +
          `- Property: ${input.propertyName ?? "residential/commercial property"}\n` +
          `- Location / area: ${input.location}\n` +
          `- Size: ${size}\n` +
          (bought ? `- ${bought}\n` : "") +
          `\nSearch recent (last ~6-12 months) comparable listings or sale prices in that specific area, ` +
          `work out a representative per-unit rate (e.g. price per ${input.sizeUnit ?? "sq ft"}), and multiply by the size. ` +
          `Report the value in ${input.currency}.\n\n` +
          `Respond with ONLY a JSON object with keys: ` +
          `estimatedValue (number, total value in ${input.currency}, digits only), ` +
          `perUnitValue (number or null), unit (string or null), confidence ("low"|"medium"|"high"), ` +
          `summary (one or two sentences on how you arrived at it and the price range seen). ` +
          `Do not include currency symbols or commas in numbers.`,
      },
    ],
  });

  // Collect any cited sources from web-search results.
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

  // De-dup sources by URL.
  const seen = new Set<string>();
  const uniqueSources = sources.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).slice(0, 6);

  return {
    ...base,
    estimatedValue: num(parsed.estimatedValue),
    perUnitValue: num(parsed.perUnitValue),
    unit: typeof parsed.unit === "string" ? parsed.unit : input.sizeUnit ?? null,
    confidence: conf === "low" || conf === "medium" || conf === "high" ? conf : null,
    summary: typeof parsed.summary === "string" ? parsed.summary : "Estimated from recent comparable listings.",
    sources: uniqueSources,
  };
}
