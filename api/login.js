/**
 * /api/login
 * GET  → serves the HTML login page
 * POST → validates password, sets signed HttpOnly session cookie
 */

// ── Crypto helpers ────────────────────────────────────────────────────────────
async function hmacSign(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Constant-time string comparison
function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Simple in-memory rate limiter (resets on cold start, good enough) ─────────
const attempts = new Map(); // ip → { count, resetAt }
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count++;
  return rec.count > MAX_ATTEMPTS;
}

function clearRateLimit(ip) {
  attempts.delete(ip);
}

// ── Login page HTML ───────────────────────────────────────────────────────────
const LOGIN_HTML = (error = "", next = "") => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>BlackBridge Research — Login</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #020b14;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
      color: #e2e8f0;
    }
    .card {
      width: 420px;
      background: #060f1a;
      border: 1px solid #0f2037;
      border-radius: 10px;
      padding: 36px;
    }
    .logo-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
    }
    .logo-mark {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
      border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 900; color: #fff;
      flex-shrink: 0;
    }
    .logo-title { font-size: 13px; font-weight: 700; color: #e2e8f0; letter-spacing: 0.05em; }
    .logo-sub   { font-size: 10px; color: #334155; letter-spacing: 0.1em; margin-top: 2px; }
    .desc { font-size: 12px; color: #64748b; line-height: 1.7; margin-bottom: 24px; }
    label { font-size: 10px; color: #334155; letter-spacing: 0.1em; display: block; margin-bottom: 8px; }
    input[type=password] {
      width: 100%;
      background: #0a1628;
      border: 1px solid ${error ? '#f87171' : '#1e3a5f'};
      border-radius: 5px;
      padding: 10px 14px;
      color: #e2e8f0;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      margin-bottom: ${error ? '8px' : '16px'};
    }
    input[type=password]:focus { border-color: #1d4ed8; }
    .error { font-size: 11px; color: #f87171; margin-bottom: 12px; }
    button {
      width: 100%;
      background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
      border: none; border-radius: 5px;
      color: #fff; padding: 11px;
      font-size: 12px; font-family: inherit;
      font-weight: 700; letter-spacing: 0.08em;
      cursor: pointer; transition: opacity 0.15s;
    }
    button:hover { opacity: 0.9; }
    .divider { border: none; border-top: 1px solid #0f2037; margin: 24px 0; }
    .footer { font-size: 10px; color: #1e3a5f; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-row">
      <div class="logo-mark">BB</div>
      <div>
        <div class="logo-title">BLACKBRIDGE RESEARCH</div>
        <div class="logo-sub">RESTRICTED ACCESS · AUTHORISED USERS ONLY</div>
      </div>
    </div>
    <p class="desc">
      This platform is for authorised use only. All access attempts are logged.
      Enter your dashboard password to continue.
    </p>
    <form method="POST" action="/api/login">
      <input type="hidden" name="next" value="${next}"/>
      <label for="pw">DASHBOARD PASSWORD</label>
      <input type="password" id="pw" name="password" placeholder="Enter password…"
             autocomplete="current-password" autofocus required/>
      ${error ? `<div class="error">⚠ ${error}</div>` : ""}
      <button type="submit">ENTER DASHBOARD →</button>
    </form>
    <hr class="divider"/>
    <div class="footer">BLACKBRIDGE EQUITY RESEARCH · PROPRIETARY &amp; CONFIDENTIAL</div>
  </div>
</body>
</html>`;

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // GET → serve login page
  if (req.method === "GET") {
    const next = req.query?.next || "";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(LOGIN_HTML("", next));
  }

  // POST → validate password
  if (req.method === "POST") {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";

    // Rate limiting
    if (isRateLimited(ip)) {
      res.setHeader("Retry-After", "900");
      return res.status(429).send(LOGIN_HTML("Too many attempts. Please wait 15 minutes.", ""));
    }

    const { password, next } = req.body || {};
    const expected = process.env.DASHBOARD_PASSWORD;
    const secret   = process.env.SESSION_SECRET;

    if (!expected || !secret) {
      return res.status(500).send(LOGIN_HTML("Server misconfigured. Contact admin.", ""));
    }

    // Validate password (constant-time)
    if (!safeCompare(password || "", expected)) {
      return res.status(401).send(LOGIN_HTML("Incorrect password. Please try again.", next || ""));
    }

    // ✅ Correct — issue signed session cookie
    clearRateLimit(ip);
    const token = await hmacSign(secret, "bb-auth-session-v1");

    const isProd = process.env.NODE_ENV !== "development";
    const cookieFlags = [
      `bb_session=${token}`,
      "HttpOnly",
      "SameSite=Strict",
      "Path=/",
      isProd ? "Secure" : "",
      "Max-Age=86400", // 24 hours
    ].filter(Boolean).join("; ");

    res.setHeader("Set-Cookie", cookieFlags);
    res.setHeader("Cache-Control", "no-store");

    const destination = next && next.startsWith("/") ? next : "/";
    return res.redirect(302, destination);
  }

  return res.status(405).send("Method not allowed");
}
