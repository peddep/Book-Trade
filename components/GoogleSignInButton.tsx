'use client';

// Continues to /api/auth/google as a full page navigation (never a fetch —
// Google's consent screen has to be the top-level page, or the browser
// refuses to load it and a student sees nothing happen).
export default function GoogleSignInButton({ label, href = '/api/auth/google' }: { label: string; href?: string }) {
  return (
    <a
      href={href}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
      style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#3c4043' }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.61Z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.19l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z" />
        <path fill="#FBBC05" d="M3.95 10.69A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.16.27-1.69V4.98H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.02l3-2.33Z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.98l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
      </svg>
      {label}
    </a>
  );
}
