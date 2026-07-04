import { eq } from "drizzle-orm";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getDb } from "@/db";
import { webauthnCredentials } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, UNAUTHORIZED } from "@/lib/api";
import { getRpInfo, stashChallenge } from "@/lib/webauthn";

// Begin biometric unlock: return a challenge scoped to this user's registered
// credentials. userVerification "required" forces the Face ID / fingerprint prompt.
export async function POST() {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const { rpID } = await getRpInfo();
    const db = await getDb();
    const creds = await db
      .select({ credentialId: webauthnCredentials.credentialId, transports: webauthnCredentials.transports })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, session.userId));

    if (creds.length === 0) return apiError("No biometric device is registered.", 400);

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: creds.map((c) => ({
        id: c.credentialId,
        transports: (c.transports?.length ? c.transports : undefined) as never,
      })),
    });

    await stashChallenge(options.challenge);
    return Response.json(options);
  });
}
