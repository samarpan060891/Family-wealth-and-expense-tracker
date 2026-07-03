// Simple in-memory sliding-window rate limiter, keyed by an arbitrary string
// (e.g. "login:<ip>"). This guards against brute-force / credential-stuffing on
// auth endpoints. NOTE: in-memory state is per-process — on a multi-instance
// deployment each instance limits independently. For a single Railway instance
// this is sufficient; move to a shared store (Redis/Postgres) if you scale out.
const hits = new Map<string, number[]>();

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= max) {
    const oldest = recent[0];
    return { allowed: false, retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000) };
  }

  recent.push(now);
  hits.set(key, recent);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= cutoff)) hits.delete(k);
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Best-effort client IP from proxy headers (Railway sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
