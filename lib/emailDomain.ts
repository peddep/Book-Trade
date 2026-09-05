// When ALLOWED_EMAIL_DOMAIN is set (e.g. student.nssc.ac.th), only school
// addresses may hold an account — checked here so password signup and
// "Sign in with Google" cannot drift into two different rules for the same
// thing. Google verifying the address only proves who it belongs to, not
// that the school considers it a student's; this still applies on top.
//
// ALLOWED_EMAIL_EXTRA is a short escape hatch for whoever runs the
// deployment: exact addresses (not domains), comma/semicolon/space
// separated — same parsing as ADMIN_EMAIL in lib/auth.ts — that may sign up
// regardless of domain. For testing with a personal account without opening
// the domain restriction to everyone.
export function domainError(email: string): { domain: string } | null {
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
  if (!allowedDomain) return null;
  const lower = email.toLowerCase();
  if (lower.endsWith('@' + allowedDomain.toLowerCase())) return null;

  const extra = process.env.ALLOWED_EMAIL_EXTRA;
  if (extra) {
    const allowed = extra.split(/[,;\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
    if (allowed.includes(lower)) return null;
  }

  return { domain: allowedDomain };
}
