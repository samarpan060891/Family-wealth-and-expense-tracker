import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { invites, users, households, sharePermissions } from "@/db/schema";
import { hashPassword, createSessionCookie } from "@/lib/auth";
import { apiError, safeRoute, zodMessage } from "@/lib/api";
import { nameSchema, passwordSchema, emailSchema } from "@/lib/validation";

// Look up an invite by token so the accept page can show who invited them and what
// they'll be able to see. Public — no session required.
export async function GET(req: NextRequest) {
  return safeRoute(async () => {
    const token = req.nextUrl.searchParams.get("token")?.trim();
    if (!token) return apiError("Missing invite token.", 400);

    const db = await getDb();
    const [invite] = await db.select().from(invites).where(eq(invites.token, token));
    if (!invite) return apiError("This invitation link is not valid.", 404);
    if (invite.acceptedAt) return apiError("This invitation has already been used.", 410);
    if (invite.expiresAt.getTime() < Date.now())
      return apiError("This invitation has expired. Ask for a new link.", 410);

    const [household] = await db.select().from(households).where(eq(households.id, invite.householdId));

    return Response.json({
      householdName: household?.name ?? "your family",
      email: invite.email,
      suggestedName: invite.suggestedName,
      grants: invite.grants,
    });
  });
}

const acceptSchema = z.object({
  token: z.string().trim().min(1),
  name: nameSchema,
  password: passwordSchema,
  email: emailSchema.optional(),
});

// Accept an invite: create the member account with the pre-configured permissions,
// mark the invite used, and sign the new member in. Public — no session required.
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const parsed = acceptSchema.safeParse(await req.json());
    if (!parsed.success) return apiError(zodMessage(parsed.error), 400);

    const { token, name, password } = parsed.data;
    const db = await getDb();

    const [invite] = await db.select().from(invites).where(eq(invites.token, token));
    if (!invite) return apiError("This invitation link is not valid.", 404);
    if (invite.acceptedAt) return apiError("This invitation has already been used.", 410);
    if (invite.expiresAt.getTime() < Date.now())
      return apiError("This invitation has expired. Ask for a new link.", 410);

    // The email is fixed by the inviter when present; otherwise the invitee supplies it.
    const email = (invite.email ?? parsed.data.email)?.trim().toLowerCase();
    if (!email) return apiError("Please enter your email address to create your account.", 400);

    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0)
      return apiError("An account with this email already exists. Try logging in instead.", 409);

    const passwordHash = await hashPassword(password);
    const [member] = await db
      .insert(users)
      .values({
        householdId: invite.householdId,
        name,
        email,
        passwordHash,
        role: "member",
      })
      .returning();

    if (invite.grants.length) {
      await db.insert(sharePermissions).values(
        invite.grants.map((g) => ({
          householdId: invite.householdId,
          memberId: member.id,
          module: g.module,
          category: g.category ?? null,
          accessLevel: g.accessLevel,
        }))
      );
    }

    await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id));

    await createSessionCookie({
      userId: member.id,
      householdId: member.householdId,
      role: "member",
    });

    return Response.json({ ok: true });
  });
}
