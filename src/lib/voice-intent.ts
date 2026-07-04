import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.VOICE_MODEL ?? process.env.EXTRACTION_MODEL ?? "claude-haiku-4-5";

export function isVoiceConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type VoiceModule = "expense" | "income" | "investment" | "debt" | "asset" | "insurance";
export type VoiceQuery = "net_worth" | "renewals" | "spending_this_month" | "top_categories" | "totals";

export type VoiceIntent = {
  intent: "create" | "query" | "unknown";
  module: VoiceModule | null;
  fields: Record<string, string | number | boolean | null>;
  missing: string[];
  query: VoiceQuery | null;
  message: string;
  clarification: string | null;
};

// Required fields per module — used to decide whether we need to ask a follow-up.
export const REQUIRED_FIELDS: Record<VoiceModule, string[]> = {
  expense: ["amount", "categoryName"],
  income: ["amount", "categoryName"],
  investment: ["name", "type", "investedAmount"],
  debt: ["name", "type", "principal", "outstandingAmount"],
  asset: ["name", "type", "value"],
  insurance: ["name", "type", "premiumAmount", "expiryDate"],
};

type Context = {
  today: string;
  expenseCategories: string[];
  incomeCategories: string[];
  investmentTypes: string[];
  debtTypes: string[];
  assetTypes: string[];
  insuranceTypes: string[];
  scopedModule?: VoiceModule;
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

function buildPrompt(transcript: string, ctx: Context): string {
  const scope = ctx.scopedModule
    ? `The user is on the "${ctx.scopedModule}" form, so prefer intent=create with module="${ctx.scopedModule}" unless they clearly ask a question.`
    : "";
  return [
    `You are the voice assistant for a family finance app. Convert the user's spoken command into a single JSON object. Today is ${ctx.today}.`,
    scope,
    ``,
    `Decide the intent:`,
    `- "create": the user wants to add an expense, income, investment, debt, asset, or insurance record.`,
    `- "query": the user is asking about their finances (net worth, upcoming insurance/investment renewals, this month's spending, top categories, totals).`,
    `- "unknown": anything else.`,
    ``,
    `For intent="create", set "module" and fill "fields" using EXACTLY these keys per module:`,
    `- expense/income: amount (digits), date (YYYY-MM-DD, default today if unspecified), categoryName, paymentMethod (one of cash, debit_card, credit_card, upi, bank_transfer, auto_debit, cheque, dividend, other), note, isRecurring (true/false), recurrenceFrequency (one_time, monthly, quarterly, half_yearly, yearly).`,
    `- investment: name, type, investedAmount (digits), currentValue (digits), purchaseDate (YYYY-MM-DD, default today), maturityDate, isRecurring (true if a SIP/recurring), recurrenceFrequency, notes.`,
    `- debt: name, lender, type, principal (digits), outstandingAmount (digits), interestRate (digits), emiAmount (digits), startDate (default today), notes.`,
    `- asset: name, type, value (digits), purchaseDate, notes.`,
    `- insurance: name, type, provider, premiumAmount (digits), premiumFrequency (one_time, monthly, quarterly, half_yearly, yearly), startDate (default today), expiryDate, sumAssured (digits), nominee, notes.`,
    ``,
    `Pick categoryName / type from these allowed values (choose the closest; use "Other" if nothing fits):`,
    `- expense categories: ${ctx.expenseCategories.join(", ")}`,
    `- income categories: ${ctx.incomeCategories.join(", ")}`,
    `- investment types: ${ctx.investmentTypes.join(", ")}`,
    `- debt types: ${ctx.debtTypes.join(", ")}`,
    `- asset types: ${ctx.assetTypes.join(", ")}`,
    `- insurance types: ${ctx.insuranceTypes.join(", ")}`,
    ``,
    `For intent="query", set "query" to one of: net_worth, renewals, spending_this_month, top_categories, totals. Leave module null.`,
    ``,
    `Rules:`,
    `- Amounts are plain digits only (no symbols/commas). "5k" = 5000, "1.5 lakh" = 150000, "2 crore" = 20000000.`,
    `- Put any field you cannot determine as null. List required fields you could not fill in "missing".`,
    `- "message": one short friendly sentence summarizing what you understood (for create) or restating the question (for query).`,
    `- "clarification": if a REQUIRED field is missing, a short question to ask the user (e.g. "Which category is this expense?"), else null.`,
    `- Respond with ONLY the JSON object, keys: intent, module, fields, missing, query, message, clarification. No markdown, no commentary.`,
    ``,
    `User said: "${transcript}"`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function parseVoiceCommand(transcript: string, ctx: Context): Promise<VoiceIntent> {
  const fallback: VoiceIntent = {
    intent: "unknown",
    module: null,
    fields: {},
    missing: [],
    query: null,
    message: "Sorry, I didn't catch that. Please try again or type it in.",
    clarification: null,
  };
  if (!isVoiceConfigured()) return { ...fallback, message: "Voice parsing needs ANTHROPIC_API_KEY to be set." };

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    messages: [{ role: "user", content: buildPrompt(transcript, ctx) }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return fallback;

  const raw = parseJsonObject(textBlock.text);
  const intent = (["create", "query", "unknown"].includes(raw.intent as string) ? raw.intent : "unknown") as VoiceIntent["intent"];
  const module = (raw.module as VoiceModule) ?? null;
  const fields = (raw.fields && typeof raw.fields === "object" ? raw.fields : {}) as VoiceIntent["fields"];

  // Server-side safety net: recompute "missing" from required fields so the UI can
  // always trust it, even if the model under/over-reported.
  let missing: string[] = Array.isArray(raw.missing) ? (raw.missing as string[]) : [];
  if (intent === "create" && module && REQUIRED_FIELDS[module]) {
    missing = REQUIRED_FIELDS[module].filter((k) => {
      const v = fields[k];
      return v === null || v === undefined || v === "";
    });
  }

  return {
    intent,
    module: intent === "create" ? module : null,
    fields,
    missing,
    query: intent === "query" ? ((raw.query as VoiceQuery) ?? "totals") : null,
    message: typeof raw.message === "string" ? raw.message : fallback.message,
    clarification: typeof raw.clarification === "string" ? raw.clarification : null,
  };
}
