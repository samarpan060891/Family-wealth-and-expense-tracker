import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";
import { estimateProperty } from "@/lib/valuation";
import { isSupportedCurrency } from "@/lib/currency";

export const maxDuration = 60;

const schema = z.object({
  location: z.string().trim().min(3, "Enter the area / location.").max(200),
  sizeValue: z.coerce.number().positive().optional(),
  sizeUnit: z.string().trim().max(20).optional(),
  purchasePrice: z.coerce.number().nonnegative().optional(),
  purchaseDate: z.string().optional(),
  currency: z.string().length(3),
  propertyName: z.string().trim().max(150).optional(),
});

// Estimate a real-estate property's current value from recent web listings/sales.
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);
    if (!isSupportedCurrency(parsed.data.currency)) return apiError("Unsupported currency.", 400);

    const result = await estimateProperty({
      location: parsed.data.location,
      sizeValue: parsed.data.sizeValue ?? null,
      sizeUnit: parsed.data.sizeUnit ?? null,
      purchasePrice: parsed.data.purchasePrice ?? null,
      purchaseDate: parsed.data.purchaseDate ?? null,
      currency: parsed.data.currency,
      propertyName: parsed.data.propertyName ?? null,
    });

    return Response.json(result);
  });
}
