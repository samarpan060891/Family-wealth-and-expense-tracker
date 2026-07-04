import { headers, cookies } from "next/headers";

// Relying-Party identity for WebAuthn, derived from the incoming request so the
// same code works on localhost and on the Railway domain without configuration.
// rpID must be the registrable domain (no scheme/port); origin is the full origin.
export async function getRpInfo() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const rpID = host.split(":")[0];
  const origin = `${proto}://${host}`;
  return { rpID, origin, rpName: "FamilyWealth" };
}

const CHALLENGE_COOKIE = "fw_wa_challenge";

// The ceremony challenge is a one-time nonce. Storing it in a short-lived,
// httpOnly cookie ties it to this browser and keeps it out of client JS.
export async function stashChallenge(challenge: string) {
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 300, // 5 minutes
  });
}

export async function readChallenge(): Promise<string | null> {
  const store = await cookies();
  return store.get(CHALLENGE_COOKIE)?.value ?? null;
}

export async function clearChallenge() {
  const store = await cookies();
  store.delete(CHALLENGE_COOKIE);
}
