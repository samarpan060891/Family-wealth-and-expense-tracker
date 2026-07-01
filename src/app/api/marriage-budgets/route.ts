import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { marriageBudgets, familyMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const rows = await db
    .select()
    .from(marriageBudgets)
    .where(eq(marriageBudgets.householdId, session.householdId));

  return NextResponse.json({ marriageBudgets: rows });
}

const schema = z.object({
  familyMemberId: z.string().uuid(),
  included: z.boolean().default(true),
  targetAge: z.coerce.number().min(0).max(100),
  currentBudget: z.coerce.number().nonnegative(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Only the main account holder can manage marriage budgets" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const db = await getDb();
  const [member] = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.id, parsed.data.familyMemberId));
  if (!member || member.householdId !== session.householdId)
    return NextResponse.json({ error: "Invalid family member" }, { status: 400 });

  const [row] = await db
    .insert(marriageBudgets)
    .values({
      householdId: session.householdId,
      familyMemberId: parsed.data.familyMemberId,
      included: parsed.data.included,
      targetAge: parsed.data.targetAge.toString(),
      currentBudget: parsed.data.currentBudget.toString(),
      notes: parsed.data.notes,
      createdById: session.userId,
    })
    .returning();

  return NextResponse.json({ marriageBudget: row });
}
