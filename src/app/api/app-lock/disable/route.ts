import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users, webauthnCredentials } from "@/db/schema";
import { getSession, verifyPassword } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";
import { clearPinFailures } from "@/lib/app-lock";

const schema = z.object({ password: z.string().min(1, "Enter your account password.") });

// Turn App Lock off. Requires the account password as defense-in-depth so a
// briefly-unlocked device can't be permanently un-secured by a bystander.
// Clears the PIN and all biometric credentials.
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    const db = await getDb();
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.userId));
    if (!user) return UNAUTHORIZED();

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) return apiError("Incorrect password.", 401);

    await db
      .update(users)
      .set({ appLockEnabled: false, pinHash: null })
      .where(eq(users.id, session.userId));
    await db.delete(webauthnCredentials).where(eq(webauthnCredentials.userId, session.userId));
    clearPinFailures(session.userId);

    return Response.json({ ok: true });
  });
}
