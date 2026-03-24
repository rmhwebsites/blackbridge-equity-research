/**
 * /api/logout
 * Clears the session cookie and redirects to the login page.
 * Works as a plain link/button — no JS required.
 */
export default function handler(req, res) {
  // Clear the cookie by setting it expired
  res.setHeader("Set-Cookie", [
    "bb_session=; HttpOnly; SameSite=Strict; Path=/; Secure; Max-Age=0",
    "bb_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0", // non-Secure fallback
  ]);
  res.setHeader("Cache-Control", "no-store");
  return res.redirect(302, "/login");
}
