import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { extractFromDocument, isExtractionConfigured } from "@/lib/extract";

export const maxDuration = 60;

const schema = z.object({
  module: z.enum(["expense", "income", "investment", "debt", "asset", "insurance"]),
  fileType: z.string().min(1),
  fileData: z.string().min(1), // base64, no data: prefix
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isExtractionConfigured()) {
    return NextResponse.json({
      configured: false,
      fields: {},
      message: "Auto-detect is not configured. Set ANTHROPIC_API_KEY to enable reading documents.",
    });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  // Cap at ~8MB of base64 to protect the request/token budget.
  if (parsed.data.fileData.length > 11_000_000) {
    return NextResponse.json({ error: "File is too large to scan (max ~8MB)" }, { status: 413 });
  }

  try {
    const result = await extractFromDocument({
      module: parsed.data.module,
      fileType: parsed.data.fileType,
      base64: parsed.data.fileData,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ configured: true, fields: {}, error: message }, { status: 502 });
  }
}
