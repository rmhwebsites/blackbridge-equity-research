/**
 * /api/login
 * GET  → serve the HTML login page
 * POST → validate password, set signed HttpOnly session cookie
 */
import { webcrypto } from "crypto";

// ── HTML encoding — prevents XSS from query params in the login page ──────────
function htmlEncode(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── HMAC-SHA256 ───────────────────────────────────────────────────────────────
async function hmacSign(secret, message) {
  const enc = new TextEncoder();
  const key = await webcrypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await webcrypto.subtle.sign("HMAC", key, enc.encode(message));
  return Buffer.from(sig).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Rate limiter ──────────────────────────────────────────────────────────────
const attempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) { attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return false; }
  rec.count++;
  return rec.count > MAX_ATTEMPTS;
}
function clearRateLimit(ip) { attempts.delete(ip); }

// ── Login page ────────────────────────────────────────────────────────────────
const loginPage = (error = "", next = "") => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>BlackBridge Research — Login</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:#0B0D12;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Courier New',monospace;color:#E8EDF5}
    .card{width:420px;background:#0F1218;border:1px solid #1E2433;border-radius:10px;padding:36px}
    .logo-row{display:flex;align-items:center;gap:12px;margin-bottom:28px}
    .mark{width:36px;height:36px;background:linear-gradient(135deg,#C9A84C,#E8C96A);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#0B0D12;flex-shrink:0}
    .t1{font-size:13px;font-weight:700;color:#E8EDF5;letter-spacing:.05em}
    .t2{font-size:10px;color:#5A6478;letter-spacing:.1em;margin-top:2px}
    .desc{font-size:12px;color:#5A6478;line-height:1.7;margin-bottom:24px}
    label{font-size:10px;color:#5A6478;letter-spacing:.1em;display:block;margin-bottom:8px}
    input{width:100%;background:#141720;border:1px solid ${error ? "#E84040" : "#1E2433"};border-radius:5px;padding:10px 14px;color:#E8EDF5;font-size:13px;font-family:inherit;outline:none;margin-bottom:${error ? "8px" : "16px"}}
    input:focus{border-color:#C9A84C}
    .err{font-size:11px;color:#E84040;margin-bottom:12px}
    button{width:100%;background:linear-gradient(135deg,#C9A84C,#E8C96A);border:none;border-radius:5px;color:#0B0D12;padding:11px;font-size:12px;font-family:inherit;font-weight:700;letter-spacing:.08em;cursor:pointer}
    hr{border:none;border-top:1px solid #1E2433;margin:24px 0}
    .foot{font-size:10px;color:#1E2433;text-align:center}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-row">
      <div class="mark">BB</div>
      <div><div class="t1">BLACKBRIDGE RESEARCH</div><div class="t2">RESTRICTED ACCESS · AUTHORISED USERS ONLY</div></div>
    </div>
    <p class="desc">This platform is for authorised use only. Enter your dashboard password to continue.</p>
    <form method="POST" action="/api/login">
      <input type="hidden" name="next" value="${htmlEncode(next)}"/>
      <label for="pw">DASHBOARD PASSWORD</label>
      <input type="password" id="pw" name="password" placeholder="Enter password…" autocomplete="current-password" autofocus required/>
      ${error ? `<div class="err">⚠ ${htmlEncode(error)}</div>` : ""}
      <button type="submit">ENTER DASHBOARD →</button>
    </form>
    <hr/>
    <div class="foot">BLACKBRIDGE EQUITY RESEARCH · PROPRIETARY &amp; CONFIDENTIAL</div>
  </div>
</body>
</html>`;

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === "GET") {
    const next = req.query?.next || "";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(loginPage("", next));
  }

  if (req.method === "POST") {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      res.setHeader("Retry-After", "900");
      return res.status(429).send(loginPage("Too many attempts. Wait 15 minutes.", ""));
    }

    const { password, next } = req.body || {};
    const expected = process.env.DASHBOARD_PASSWORD;
    const secret   = process.env.SESSION_SECRET;

    if (!expected || !secret) {
      return res.status(500).send(loginPage("Server misconfigured. Contact administrator.", ""));
    }

    if (!safeCompare(password || "", expected)) {
      return res.status(401).send(loginPage("Incorrect password. Please try again.", next || ""));
    }

    clearRateLimit(ip);
    let token;
    try {
      token = await hmacSign(secret, "bb-auth-session-v1");
    } catch (_) {
      // Do not expose internal error details
      return res.status(500).send(loginPage("Authentication error. Please try again.", ""));
    }

    const cookie = [
      `bb_session=${token}`,
      "HttpOnly",
      "SameSite=Strict",
      "Path=/",
      "Secure",
      "Max-Age=86400",
    ].join("; ");

    res.setHeader("Set-Cookie", cookie);
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, next && next.startsWith("/") ? next : "/");
  }

  return res.status(405).send("Method not allowed");
}
