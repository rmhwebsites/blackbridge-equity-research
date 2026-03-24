/**
 * /api/analyze
 * Secure proxy to Anthropic API.
 * - ANTHROPIC_API_KEY never leaves the server
 * - Verifies session cookie independently of middleware (defence in depth)
 * - Only POST allowed
 */

// ── Crypto helpers ─────────────────────────────────────────────────────────
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

function parseSessionCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)bb_session=([^;]+)/);
  return match ? match[1] : null;
}

async function isAuthenticated(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const token = parseSessionCookie(req.headers["cookie"] || "");
  if (!token) return false;
  const expected = await hmacSign(secret, "bb-auth-session-v1");
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Defence-in-depth: verify session cookie independently of middleware
  const authed = await isAuthenticated(req);
  if (!authed) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server misconfigured: ANTHROPIC_API_KEY not set" });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Proxy error: " + err.message });
  }
}
