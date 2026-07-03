import Anthropic from "@anthropic-ai/sdk";

// Reuses the same key as document extraction. Defaults to the cheapest model.
const MODEL = process.env.INSIGHTS_MODEL ?? process.env.EXTRACTION_MODEL ?? "claude-haiku-4-5";

export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Turns pre-computed, factual numbers into a short friendly summary. Returns null
 * if no API key is configured (caller falls back to the deterministic headline).
 * The model is given ONLY the computed facts — it never sees raw data and is told
 * not to invent numbers, so it can't fabricate figures.
 */
export async function summarizeFacts(facts: Record<string, unknown>): Promise<string | null> {
  if (!isAiConfigured()) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system:
        "You are a concise personal-finance assistant. Write a 2-3 sentence summary of the user's month " +
        "using ONLY the numbers provided in the JSON. Never invent or estimate figures not present. Amounts are " +
        "in the given currency (format Indian rupees as ₹ with no decimals). Be encouraging but honest; if they " +
        "are overspending or have a risk, say so plainly. No preamble, no bullet points, no markdown.",
      messages: [{ role: "user", content: `Facts:\n${JSON.stringify(facts)}` }],
    });
    const text = response.content.find((b) => b.type === "text");
    return text && text.type === "text" ? text.text.trim() : null;
  } catch {
    return null;
  }
}
