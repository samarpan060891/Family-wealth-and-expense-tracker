import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const SESSION_COOKIE = "fw_session";

// AUTH_SECRET signs session JWTs. A missing secret in production is a critical
// vulnerability (sessions become forgeable), so fail fast there. In development we
// fall back to a fixed dev secret for convenience. Resolved lazily on first use so
// `next build` (which imports this module in production mode) doesn't throw — the
// check fires on the first real request instead.
let cachedSecret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.AUTH_SECRET;
  let value: string;
  if (fromEnv && fromEnv.length >= 16) {
    value = fromEnv;
  } else if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set a long random value (e.g. `openssl rand -base64 32`) before running in production."
    );
  } else {
    value = "dev-only-insecure-secret-change-me";
  }
  cachedSecret = new TextEncoder().encode(value);
  return cachedSecret;
}

export type SessionPayload = {
  userId: string;
  householdId: string;
  role: "admin" | "member";
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionCookie(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}
