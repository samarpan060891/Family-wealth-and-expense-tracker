"use client";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";

// Client-side helpers for App Lock. The lock state lives in sessionStorage with an
// expiry timestamp, so:
//   - a cold app start (new tab / PWA launch) starts locked (empty storage);
//   - a reload within a session stays unlocked until the inactivity window passes;
//   - inactivity re-locks by letting the timestamp lapse.

const UNLOCK_KEY = "fw_unlock_until";
export const INACTIVITY_MS = 3 * 60 * 1000; // re-lock after 3 minutes idle

export function isUnlocked(): boolean {
  try {
    const until = Number(sessionStorage.getItem(UNLOCK_KEY) ?? 0);
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function markUnlocked() {
  try {
    sessionStorage.setItem(UNLOCK_KEY, String(Date.now() + INACTIVITY_MS));
  } catch {}
}

/** Extend the unlock window on user activity (only while already unlocked). */
export function touchActivity() {
  if (isUnlocked()) markUnlocked();
}

export function lockNow() {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {}
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    return browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable());
  } catch {
    return false;
  }
}

async function postJSON(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Register this device's biometric (Face ID / fingerprint) for unlocking. */
export async function registerBiometric(deviceLabel?: string): Promise<{ ok: boolean; error?: string }> {
  const opt = await postJSON("/api/app-lock/biometric/register-options");
  if (!opt.ok) return { ok: false, error: opt.data.error ?? "Could not start setup." };
  try {
    const credential = await startRegistration({ optionsJSON: opt.data });
    const verify = await postJSON("/api/app-lock/biometric/register", { credential, deviceLabel });
    if (!verify.ok) return { ok: false, error: verify.data.error ?? "Could not verify your device." };
    return { ok: true };
  } catch (e) {
    // User cancelled the OS prompt, or no authenticator available.
    return { ok: false, error: humanizeWebauthnError(e) };
  }
}

/** Attempt a biometric unlock. Returns ok=false so the caller can fall back to PIN. */
export async function unlockBiometric(): Promise<{ ok: boolean; error?: string; cancelled?: boolean }> {
  const opt = await postJSON("/api/app-lock/biometric/auth-options");
  if (!opt.ok) return { ok: false, error: opt.data.error ?? "Biometric unavailable." };
  try {
    const credential = await startAuthentication({ optionsJSON: opt.data });
    const verify = await postJSON("/api/app-lock/biometric/auth", { credential });
    if (!verify.ok) return { ok: false, error: verify.data.error ?? "Verification failed." };
    markUnlocked();
    return { ok: true };
  } catch (e) {
    return { ok: false, cancelled: true, error: humanizeWebauthnError(e) };
  }
}

function humanizeWebauthnError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError") return "Cancelled or timed out.";
  if (name === "InvalidStateError") return "This device is already registered.";
  return "Biometric authentication isn't available right now.";
}
