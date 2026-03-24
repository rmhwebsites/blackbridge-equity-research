/**
 * /api/logout
 * Clears the session cookie and redirects to the login page.
 * Works as a plain link/button — no JS required.
 */
export default function handler(req, res) {
  res.setHeader("Set-Cookie", "bb_session=; HttpOnly; SameSite=Strict; Path=/; Secure; Max-Age=0");
  res.setHeader("Cache-Control", "no-store");
  return res.redirect(302, "/login");
}
