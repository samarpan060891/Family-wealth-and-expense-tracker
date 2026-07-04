import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getSession, hashPassword } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED } from "@/lib/api";

const schema = z.object({
  pin: z
    .string()
    .regex(/^\d{4}$/, "PIN must be exactly 4 digits."),
});

// Set or replace the 4-digit App Lock PIN. The PIN is bcrypt-hashed (via the same
// helper used for passwords) and never stored in plain text. Setting a PIN turns
// App Lock on. The user is already authenticated and past any existing lock here.
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    // Reject trivially guessable PINs.
    const pin = parsed.data.pin;
    if (/^(\d)\1{3}$/.test(pin) || pin === "1234" || pin === "0000")
      return apiError("Choose a less predictable PIN.", 400);

    const pinHash = await hashPassword(pin);
    const db = await getDb();
    await db
      .update(users)
      .set({ pinHash, appLockEnabled: true })
      .where(eq(users.id, session.userId));

    return Response.json({ ok: true });
  });
}
