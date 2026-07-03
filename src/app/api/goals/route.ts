import { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { goals } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";

export async function GET() {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    const db = await getDb();
    const rows = await db
      .select()
      .from(goals)
      .where(eq(goals.householdId, session.householdId))
      .orderBy(desc(goals.createdAt));
    return Response.json({ goals: rows });
  });
}

const schema = z.object({
  name: z.string().trim().min(1, "Give the goal a name.").max(150),
  category: z.string().trim().max(60).optional(),
  targetAmount: z.coerce.number().positive("Target amount must be greater than zero."),
  currentAmount: z.coerce.number().nonnegative().default(0),
  targetDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    const db = await getDb();
    const [row] = await db
      .insert(goals)
      .values({
        householdId: session.householdId,
        createdById: session.userId,
        name: parsed.data.name,
        category: parsed.data.category,
        targetAmount: parsed.data.targetAmount.toString(),
        currentAmount: parsed.data.currentAmount.toString(),
        targetDate: parsed.data.targetDate || null,
        notes: parsed.data.notes,
      })
      .returning();
    return Response.json({ goal: row });
  });
}
