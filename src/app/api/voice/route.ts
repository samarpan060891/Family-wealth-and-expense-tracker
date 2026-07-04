import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { format } from "date-fns";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";
import { parseVoiceCommand, isVoiceConfigured, type VoiceModule } from "@/lib/voice-intent";
import { INVESTMENT_TYPES, DEBT_TYPES, ASSET_TYPES, INSURANCE_TYPES } from "@/lib/categories";

export const maxDuration = 30;

const schema = z.object({
  transcript: z.string().trim().min(1, "Nothing was heard.").max(1000),
  module: z.enum(["expense", "income", "investment", "debt", "asset", "insurance"]).optional(),
});

// Turns a spoken command into a structured intent via Claude. Returns either a
// prefilled create-record draft, a query classification, or a clarifying question.
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    if (!isVoiceConfigured())
      return Response.json({
        intent: "unknown",
        module: null,
        fields: {},
        missing: [],
        query: null,
        message: "Voice understanding is off. Ask the owner to set ANTHROPIC_API_KEY, or type the entry manually.",
        clarification: null,
        configured: false,
      });

    // Household expense/income categories drive category matching.
    const db = await getDb();
    const [expenseCats, incomeCats] = await Promise.all([
      db
        .select({ name: categories.name })
        .from(categories)
        .where(and(eq(categories.householdId, session.householdId), eq(categories.module, "expense"))),
      db
        .select({ name: categories.name })
        .from(categories)
        .where(and(eq(categories.householdId, session.householdId), eq(categories.module, "income"))),
    ]);

    const intent = await parseVoiceCommand(parsed.data.transcript, {
      today: format(new Date(), "yyyy-MM-dd"),
      expenseCategories: expenseCats.map((c) => c.name),
      incomeCategories: incomeCats.map((c) => c.name),
      investmentTypes: INVESTMENT_TYPES,
      debtTypes: DEBT_TYPES,
      assetTypes: ASSET_TYPES,
      insuranceTypes: INSURANCE_TYPES,
      scopedModule: parsed.data.module as VoiceModule | undefined,
    });

    return Response.json({ ...intent, configured: true });
  });
}
