import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getSession, verifyPassword } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";
import { pinGateStatus, recordPinFailure, clearPinFailures } from "@/lib/app-lock";

const schema = z.object({ pin: z.string().min(1).max(12) });

// Verify a 4-digit PIN to unlock the app. Enforces a short lockout after 3 wrong
// tries; the client offers "log in with password" as the escape hatch.
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    const gate = pinGateStatus(session.userId);
    if (gate.locked) {
      return apiError("Too many attempts. Try again shortly or use your password.", 429, {
        locked: true,
        retryAfterSeconds: gate.retryAfterSeconds,
      });
    }

    const db = await getDb();
    const [user] = await db
      .select({ pinHash: users.pinHash })
      .from(users)
      .where(eq(users.id, session.userId));

    if (!user?.pinHash) return apiError("No PIN is set for this account.", 400);

    const ok = await verifyPassword(parsed.data.pin, user.pinHash);
    if (!ok) {
      const next = recordPinFailure(session.userId);
      if (next.locked) {
        return apiError("Too many attempts. Try again shortly or use your password.", 429, {
          locked: true,
          retryAfterSeconds: next.retryAfterSeconds,
        });
      }
      return apiError("Incorrect PIN.", 401, { remainingAttempts: next.remainingAttempts });
    }

    clearPinFailures(session.userId);
    return Response.json({ ok: true });
  });
}
