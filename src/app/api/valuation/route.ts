import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";
import { estimateValue } from "@/lib/valuation";
import { isSupportedCurrency } from "@/lib/currency";

export const maxDuration = 60;

const schema = z.object({
  assetType: z.string().trim().min(1).max(80),
  name: z.string().trim().max(150).optional(),
  location: z.string().trim().max(200).optional(),
  sizeValue: z.coerce.number().positive().optional(),
  sizeUnit: z.string().trim().max(20).optional(),
  details: z.string().trim().max(400).optional(),
  purchasePrice: z.coerce.number().nonnegative().optional(),
  purchaseDate: z.string().optional(),
  currency: z.string().length(3),
});

// Estimate an asset's current value from recent web listings/sales/market rates.
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);
    if (!isSupportedCurrency(parsed.data.currency)) return apiError("Unsupported currency.", 400);

    // Need at least a location or some details to search on.
    if (!parsed.data.location && !parsed.data.details && !parsed.data.name)
      return apiError("Add a location or some details to estimate the value.", 400);

    const result = await estimateValue({
      assetType: parsed.data.assetType,
      name: parsed.data.name ?? null,
      location: parsed.data.location ?? null,
      sizeValue: parsed.data.sizeValue ?? null,
      sizeUnit: parsed.data.sizeUnit ?? null,
      details: parsed.data.details ?? null,
      purchasePrice: parsed.data.purchasePrice ?? null,
      purchaseDate: parsed.data.purchaseDate ?? null,
      currency: parsed.data.currency,
    });

    return Response.json(result);
  });
}
