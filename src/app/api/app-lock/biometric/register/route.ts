import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { getDb } from "@/db";
import { users, webauthnCredentials } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, safeRoute, UNAUTHORIZED } from "@/lib/api";
import { getRpInfo, readChallenge, clearChallenge } from "@/lib/webauthn";

// Finish biometric registration: verify the attestation, store the public key +
// counter, and turn App Lock on. The private key stays on the device.
export async function POST(req: NextRequest) {
  return safeRoute(async () => {
    const session = await getSession();
    if (!session) return UNAUTHORIZED();

    const expectedChallenge = await readChallenge();
    if (!expectedChallenge) return apiError("Your session expired. Please try again.", 400);

    const body = await req.json();
    const { rpID, origin } = await getRpInfo();

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.credential ?? body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch {
      await clearChallenge();
      return apiError("Could not verify your device. Please try again.", 400);
    }

    await clearChallenge();
    if (!verification.verified || !verification.registrationInfo)
      return apiError("Biometric registration failed.", 400);

    const { credential } = verification.registrationInfo;
    const db = await getDb();
    await db.insert(webauthnCredentials).values({
      userId: session.userId,
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceLabel: typeof body.deviceLabel === "string" ? body.deviceLabel.slice(0, 120) : null,
    });
    await db.update(users).set({ appLockEnabled: true }).where(eq(users.id, session.userId));

    return Response.json({ ok: true });
  });
}
