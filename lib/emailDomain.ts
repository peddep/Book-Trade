// When ALLOWED_EMAIL_DOMAIN is set (e.g. student.nssc.ac.th), only school
// addresses may hold an account — checked here so password signup and
// "Sign in with Google" cannot drift into two different rules for the same
// thing. Google verifying the address only proves who it belongs to, not
// that the school considers it a student's; this still applies on top.
export function domainError(email: string): { domain: string } | null {
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
  if (!allowedDomain) return null;
  if (email.toLowerCase().endsWith('@' + allowedDomain.toLowerCase())) return null;
  return { domain: allowedDomain };
}
