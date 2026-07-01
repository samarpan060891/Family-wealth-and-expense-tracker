import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { familyMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const rows = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.householdId, session.householdId));

  return NextResponse.json({ familyMembers: rows });
}

const schema = z.object({
  name: z.string().min(1).max(120),
  dateOfBirth: z.string(),
  relation: z.enum(["self", "spouse", "child", "parent", "other"]),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Only the main account holder can manage family profiles" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const db = await getDb();
  const [row] = await db
    .insert(familyMembers)
    .values({
      householdId: session.householdId,
      name: parsed.data.name,
      dateOfBirth: parsed.data.dateOfBirth,
      relation: parsed.data.relation,
      createdById: session.userId,
    })
    .returning();

  return NextResponse.json({ familyMember: row });
}
