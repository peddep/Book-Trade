import type { NextConfig } from "next";

// A baseline of security headers a browser otherwise gets none of. Not a
// nonce-based strict CSP — Next's own hydration script and Tailwind both
// need 'unsafe-inline' without one, and adding that infrastructure is a
// bigger lift than this app's risk profile calls for — but this still closes
// the easy ones: clickjacking, MIME-sniffing, and loading the barcode
// scanner's camera or embedding this site from anywhere but itself.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Book covers can come from wherever a student's ISBN lookup found one.
      "img-src 'self' data: https:",
      "connect-src 'self'",
      // The push-notification service worker (public/sw.js).
      "worker-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
