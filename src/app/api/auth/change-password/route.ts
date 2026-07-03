import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getSession, hashPassword, verifyPassword, createSessionCookie } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validation";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const limit = rateLimit(`change-password:${clientIp(req)}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) return apiError("Too many attempts. Please try again later.", 429);

    const parsed = changePasswordSchema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);
    const { currentPassword, newPassword } = parsed.data;

    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.id, session.userId));
    if (!user) return UNAUTHORIZED();

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return apiError("Your current password is incorrect.", 400);
    }

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(newPassword) })
      .where(eq(users.id, user.id));

    // Re-issue the session so it's freshly signed after the credential change.
    await createSessionCookie({
      userId: user.id,
      householdId: user.householdId,
      role: user.role,
    });

    return Response.json({ ok: true });
  });
}
