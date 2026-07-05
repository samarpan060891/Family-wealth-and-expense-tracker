import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";
import { draftHoldingsFromSheet } from "@/lib/import-investments";

export const maxDuration = 60;

const schema = z.object({
  fileName: z.string().max(255).optional(),
  fileData: z.string().min(1), // base64 of the .xlsx/.csv
});

// Parse an uploaded spreadsheet into draft holdings for review. No DB writes here.
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    if (parsed.data.fileData.length > 8_000_000) return apiError("File is too large (max ~6MB).", 413);

    let buffer: Buffer;
    try {
      buffer = Buffer.from(parsed.data.fileData, "base64");
    } catch {
      return apiError("Couldn't read the file.", 400);
    }

    const { rows, aiUsed } = await draftHoldingsFromSheet(buffer);
    if (rows.length === 0)
      return apiError("No holdings found. Check the file has a header row and at least one holding.", 422);

    return Response.json({ rows, aiUsed });
  });
}
