// Tracks consecutive failed PIN attempts per user and enforces a short lockout
// after too many, so a lost/stolen unlocked device can't be brute-forced through
// the 10,000-combination PIN space. In-memory + per-process (same trade-off as
// rate-limit.ts) — fine for a single Railway instance.

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 60_000; // 60s lockout after 3 wrong tries

type Entry = { fails: number; lockedUntil: number };
const attempts = new Map<string, Entry>();

export type PinGate =
  | { locked: true; retryAfterSeconds: number }
  | { locked: false; remainingAttempts: number };

/** Call before checking a PIN. If locked, reject without even comparing. */
export function pinGateStatus(userId: string): PinGate {
  const e = attempts.get(userId);
  const now = Date.now();
  if (e && e.lockedUntil > now) {
    return { locked: true, retryAfterSeconds: Math.ceil((e.lockedUntil - now) / 1000) };
  }
  return { locked: false, remainingAttempts: MAX_ATTEMPTS - (e?.fails ?? 0) };
}

/** Record a wrong PIN. Returns the resulting gate state (may now be locked). */
export function recordPinFailure(userId: string): PinGate {
  const now = Date.now();
  const e = attempts.get(userId) ?? { fails: 0, lockedUntil: 0 };
  e.fails += 1;
  if (e.fails >= MAX_ATTEMPTS) {
    e.lockedUntil = now + LOCKOUT_MS;
    e.fails = 0; // reset the counter; the lockout window is the penalty
    attempts.set(userId, e);
    return { locked: true, retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }
  attempts.set(userId, e);
  return { locked: false, remainingAttempts: MAX_ATTEMPTS - e.fails };
}

/** Clear all failure state on a successful unlock. */
export function clearPinFailures(userId: string) {
  attempts.delete(userId);
}

export const APP_LOCK = { MAX_ATTEMPTS, LOCKOUT_MS };
