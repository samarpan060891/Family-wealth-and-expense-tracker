import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { households, users, categories } from "@/db/schema";
import { hashPassword, createSessionCookie } from "@/lib/auth";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

const schema = z.object({
  householdName: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { householdName, name, email, password } = parsed.data;

  const db = await getDb();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
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

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
