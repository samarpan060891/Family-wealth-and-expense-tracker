import { NextRequest } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getDb } from "@/db";
import { invites, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, zodMessage, UNAUTHORIZED, FORBIDDEN } from "@/lib/api";

// List pending (unaccepted, unexpired) invites for the household.
export async function GET() {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    if (session.role !== "admin") return FORBIDDEN();

    const db = await getDb();
    const rows = await db
      .select()
      .from(invites)
      .where(and(eq(invites.householdId, session.householdId), isNull(invites.acceptedAt)));

    const now = Date.now();
    const pending = rows
      .filter((r) => r.expiresAt.getTime() > now)
      .map((r) => ({
        id: r.id,
        token: r.token,
        email: r.email,
        suggestedName: r.suggestedName,
        grantCount: r.grants.length,
        expiresAt: r.expiresAt,
      }));

    return Response.json({ invites: pending });
  });
}

// Revoke a pending invite.
export async function DELETE(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    if (session.role !== "admin") return FORBIDDEN();

    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) return apiError("Missing invite id.", 400);

    const db = await getDb();
    await db
      .delete(invites)
      .where(and(eq(invites.id, id), eq(invites.householdId, session.householdId)));

    return Response.json({ ok: true });
  });
}

const grantSchema = z.object({
  module: z.enum(["expense", "income", "investment", "debt", "asset", "insurance"]),
  category: z.string().nullable().optional(),
  accessLevel: z.enum(["view", "edit"]).default("view"),
});

const schema = z.object({
  suggestedName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  grants: z.array(grantSchema).default([]),
});

export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();
    if (session.role !== "admin")
      return apiError("Only the main account holder can invite family members.", 403);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    const email = parsed.data.email?.trim().toLowerCase() || null;
    const db = await getDb();

    if (email) {
      const existing = await db.select().from(users).where(eq(users.email, email));
      if (existing.length > 0)
        return apiError("Someone with this email already has an account.", 409);
    }

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    await db.insert(invites).values({
      householdId: session.householdId,
      token,
      email,
      suggestedName: parsed.data.suggestedName || null,
      grants: parsed.data.grants.map((g) => ({
        module: g.module,
        category: g.category ?? null,
        accessLevel: g.accessLevel,
      })),
      invitedById: session.userId,
      expiresAt,
    });

    // Return a relative path; the client builds the absolute URL from its own origin.
    return Response.json({ token, invitePath: `/accept-invite?token=${token}`, expiresAt });
  });
}
