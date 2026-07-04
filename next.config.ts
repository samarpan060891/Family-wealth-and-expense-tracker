import type { NextConfig } from "next";

// A pragmatic Content-Security-Policy for a self-hosted app. 'unsafe-inline' is
// required for the pre-hydration theme script and Next's inline bootstrap; the app
// serves no third-party scripts. img/blob cover captured-photo previews; connect-src
// 'self' means the browser only talks to this origin (the Anthropic call is
// server-side, so it doesn't need to be allow-listed here).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Camera for bill capture; microphone for voice commands (Web Speech API);
  // publickey-credentials-* for App Lock biometric (WebAuthn). All same-origin only.
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(self), geolocation=(), interest-cohort=(), publickey-credentials-get=(self), publickey-credentials-create=(self)",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
