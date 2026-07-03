import { NextResponse } from "next/server";
import { z } from "zod";

/** Consistent JSON error shape. Never leak internal error text to the client. */
export function apiError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export const UNAUTHORIZED = () => apiError("Please sign in to continue.", 401);
export const FORBIDDEN = (msg = "You do not have permission to do this.") => apiError(msg, 403);

/** Turns a ZodError into a single user-friendly message. */
export function zodMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Some details were invalid — please check the form.";
  const field = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${field}${issue.message}`;
}

/**
 * Wraps a route body so an unexpected throw returns a clean 500 (with the real
 * error logged server-side only) instead of leaking a stack trace to the client.
 */
export async function safeRoute<T>(fn: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (err) {
    console.error("[api] unhandled route error:", err);
    return apiError("Something went wrong. Please try again.", 500);
  }
}
