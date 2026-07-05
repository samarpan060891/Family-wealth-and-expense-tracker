import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { reminderCompletions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";

const schema = z.object({
  kind: z.string().min(1).max(40),
  sourceId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Mark a reminder done for its due date, so it stops nagging for that period.
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    const db = await getDb();
    await db
      .insert(reminderCompletions)
      .values({
        householdId: session.householdId,
        kind: parsed.data.kind,
        sourceId: parsed.data.sourceId,
        dueDate: parsed.data.dueDate,
        completedById: session.userId,
      })
      .onConflictDoNothing();

    return Response.json({ ok: true });
  });
}

// Undo — bring the reminder back (in case it was marked done by mistake).
export async function DELETE(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    const db = await getDb();
    await db
      .delete(reminderCompletions)
      .where(
        and(
          eq(reminderCompletions.householdId, session.householdId),
          eq(reminderCompletions.kind, parsed.data.kind),
          eq(reminderCompletions.sourceId, parsed.data.sourceId),
          eq(reminderCompletions.dueDate, parsed.data.dueDate)
        )
      );

    return Response.json({ ok: true });
  });
}
