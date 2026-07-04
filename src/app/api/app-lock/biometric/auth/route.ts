import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { getDb } from "@/db";
import { webauthnCredentials } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, UNAUTHORIZED } from "@/lib/api";
import { getRpInfo, readChallenge, clearChallenge } from "@/lib/webauthn";

// Finish biometric unlock: verify the assertion signature against the stored
// public key and advance the signature counter (replay protection).
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const expectedChallenge = await readChallenge();
    if (!expectedChallenge) return apiError("Your session expired. Please try again.", 400);

    const body = await req.json();
    const response = body.credential ?? body;
    const credentialId: string | undefined = response?.id;
    if (!credentialId) {
      await clearChallenge();
      return apiError("Malformed biometric response.", 400);
    }

    const db = await getDb();
    const [cred] = await db
      .select()
      .from(webauthnCredentials)
      .where(and(eq(webauthnCredentials.userId, session.userId), eq(webauthnCredentials.credentialId, credentialId)));

    if (!cred) {
      await clearChallenge();
      return apiError("This device isn't registered for unlock.", 400);
    }

    const { rpID, origin } = await getRpInfo();
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: cred.credentialId,
          publicKey: isoBase64URL.toBuffer(cred.publicKey),
          counter: cred.counter,
          transports: (cred.transports?.length ? cred.transports : undefined) as never,
        },
      });
    } catch {
      await clearChallenge();
      return apiError("Biometric verification failed.", 401);
    }

    await clearChallenge();
    if (!verification.verified) return apiError("Biometric verification failed.", 401);

    await db
      .update(webauthnCredentials)
      .set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(webauthnCredentials.id, cred.id));

    return Response.json({ ok: true });
  });
}
