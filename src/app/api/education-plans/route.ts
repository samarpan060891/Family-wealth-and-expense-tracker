import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { educationPlans, familyMembers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const rows = await db
    .select()
    .from(educationPlans)
    .where(eq(educationPlans.householdId, session.householdId));

  return NextResponse.json({ educationPlans: rows });
}

const schema = z.object({
  familyMemberId: z.string().uuid(),
  courseName: z.string().min(1).max(150),
  country: z.string().min(1),
  startAge: z.coerce.number().min(0).max(100),
  durationYears: z.coerce.number().min(0.5).max(15),
  currentAnnualCost: z.coerce.number().nonnegative(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Only the main account holder can manage education plans" }, { status: 403 });

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
    .insert(educationPlans)
    .values({
      householdId: session.householdId,
      familyMemberId: parsed.data.familyMemberId,
      courseName: parsed.data.courseName,
      country: parsed.data.country,
      startAge: parsed.data.startAge.toString(),
      durationYears: parsed.data.durationYears.toString(),
      currentAnnualCost: parsed.data.currentAnnualCost.toString(),
      notes: parsed.data.notes,
      createdById: session.userId,
    })
    .returning();

  return NextResponse.json({ educationPlan: row });
}
