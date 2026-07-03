import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, createSessionCookie } from "@/lib/auth";
import { apiError, safeRoute } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    // Brute-force guard: max 10 attempts per IP per 15 minutes.
    const ip = clientIp(req);
    const limit = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return apiError("Too many attempts. Please wait a few minutes and try again.", 429, {
        retryAfter: limit.retryAfterSeconds,
      });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError("Enter a valid email and password.", 400);
    const { email, password } = parsed.data;

    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));

    // Same generic message whether the email exists or not (avoids user enumeration).
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return apiError("Invalid email or password.", 401);
    }

    await createSessionCookie({
      userId: user.id,
      householdId: user.householdId,
      role: user.role,
    });

    return Response.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });
}
