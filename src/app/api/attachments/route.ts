import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { attachments } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const moduleParam = req.nextUrl.searchParams.get("module");
  const recordId = req.nextUrl.searchParams.get("recordId");
  if (!moduleParam || !recordId)
    return NextResponse.json({ error: "module and recordId are required" }, { status: 400 });

  const db = await getDb();
  const rows = await db
    .select({
      id: attachments.id,
      fileName: attachments.fileName,
      fileType: attachments.fileType,
      uploadedAt: attachments.uploadedAt,
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.householdId, session.householdId),
        eq(attachments.module, moduleParam as never),
        eq(attachments.recordId, recordId)
      )
    );

  return NextResponse.json({ attachments: rows });
}

const schema = z.object({
  module: z.enum(["expense", "income", "investment", "debt", "asset", "insurance"]),
  recordId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
  fileData: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  // Roughly cap stored file size at ~8MB (base64 inflates by ~1.37x)
  if (parsed.data.fileData.length > 11_000_000) {
    return NextResponse.json({ error: "File is too large (max ~8MB)" }, { status: 413 });
  }

  const db = await getDb();
  const [row] = await db
    .insert(attachments)
    .values({
      householdId: session.householdId,
      module: parsed.data.module,
      recordId: parsed.data.recordId,
      fileName: parsed.data.fileName,
      fileType: parsed.data.fileType,
      fileData: parsed.data.fileData,
      uploadedById: session.userId,
    })
    .returning();

  return NextResponse.json({
    attachment: {
      id: row.id,
      fileName: row.fileName,
      fileType: row.fileType,
      uploadedAt: row.uploadedAt,
    },
  });
}
