import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { MAX_UPLOAD_BASE64, MAX_UPLOAD_LABEL } from "@/lib/limits";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      category: documents.category,
      note: documents.note,
      fileName: documents.fileName,
      fileType: documents.fileType,
      fileSize: documents.fileSize,
      uploadedAt: documents.uploadedAt,
    })
    .from(documents)
    .where(eq(documents.householdId, session.householdId))
    .orderBy(desc(documents.uploadedAt));

  return NextResponse.json({ documents: rows });
}

const schema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(40),
  note: z.string().max(2000).optional(),
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

  if (parsed.data.fileData.length > MAX_UPLOAD_BASE64) {
    return NextResponse.json({ error: `File is too large (max ~${MAX_UPLOAD_LABEL})` }, { status: 413 });
  }

  const fileSize = Math.floor((parsed.data.fileData.length * 3) / 4);

  const db = await getDb();
  const [row] = await db
    .insert(documents)
    .values({
      householdId: session.householdId,
      title: parsed.data.title,
      category: parsed.data.category,
      note: parsed.data.note ?? null,
      fileName: parsed.data.fileName,
      fileType: parsed.data.fileType,
      fileSize,
      fileData: parsed.data.fileData,
      uploadedById: session.userId,
    })
    .returning();

  return NextResponse.json({
    document: {
      id: row.id,
      title: row.title,
      category: row.category,
      note: row.note,
      fileName: row.fileName,
      fileType: row.fileType,
      fileSize: row.fileSize,
      uploadedAt: row.uploadedAt,
    },
  });
}
