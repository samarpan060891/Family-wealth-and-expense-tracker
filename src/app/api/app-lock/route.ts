import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, webauthnCredentials } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { safeRoute, UNAUTHORIZED } from "@/lib/api";

// App Lock status for the current user: whether it's on, and which unlock
// methods are set up. Drives the Settings UI and the lock screen.
export async function GET() {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const db = await getDb();
    const [user] = await db
      .select({ enabled: users.appLockEnabled, pinHash: users.pinHash })
      .from(users)
      .where(eq(users.id, session.userId));

    const creds = await db
      .select({ id: webauthnCredentials.id })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, session.userId));

    return Response.json({
      enabled: user?.enabled ?? false,
      hasPin: Boolean(user?.pinHash),
      hasBiometric: creds.length > 0,
      biometricCount: creds.length,
    });
  });
}
