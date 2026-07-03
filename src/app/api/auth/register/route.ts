import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { households, users, categories } from "@/db/schema";
import { hashPassword, createSessionCookie } from "@/lib/auth";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { registerSchema } from "@/lib/validation";
import { apiError, safeRoute, zodMessage } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  return safeRoute(async () => {
  const ip = clientIp(req);
  const limit = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return apiError("Too many sign-up attempts. Please try again later.", 429, {
      retryAfter: limit.retryAfterSeconds,
    });
  }

  const parsed = registerSchema.safeParse(await req.json());
  if (!parsed.success) return apiError(zodMessage(parsed.error), 400);
  const { householdName, name, email, password } = parsed.data;

  const db = await getDb();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));
  if (existing.length > 0) {
    return apiError("An account with this email already exists.", 409);
  }

  const [household] = await db
    .insert(households)
    .values({ name: householdName })
    .returning();

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({
      householdId: household.id,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "admin",
    })
    .returning();

  const categoryRows = Object.entries(DEFAULT_CATEGORIES).flatMap(
    ([module, names]) =>
      names.map((catName) => ({
        householdId: household.id,
        module: module as "expense" | "income",
        name: catName,
      }))
  );
  if (categoryRows.length) {
    await db.insert(categories).values(categoryRows);
  }

  await createSessionCookie({
    userId: user.id,
    householdId: household.id,
    role: "admin",
  });

  return Response.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
  });
}
