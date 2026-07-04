import { eq } from "drizzle-orm";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getDb } from "@/db";
import { webauthnCredentials } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { safeRoute, UNAUTHORIZED } from "@/lib/api";
import { getRpInfo, stashChallenge } from "@/lib/webauthn";

// Begin biometric registration: hand the browser a challenge and RP info. We ask
// for a *platform* authenticator with user verification, which is what surfaces
// Face ID / Touch ID / Android fingerprint.
export async function POST() {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const { rpID, rpName } = await getRpInfo();
    const db = await getDb();
    const existing = await db
      .select({ credentialId: webauthnCredentials.credentialId, transports: webauthnCredentials.transports })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, session.userId));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(session.userId),
      // Keep PII out of the authenticator: use the opaque user id as the handle.
      userName: session.userId,
      userDisplayName: "FamilyWealth App Lock",
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: (c.transports?.length ? c.transports : undefined) as never,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
    });

    await stashChallenge(options.challenge);
    return Response.json(options);
  });
}
