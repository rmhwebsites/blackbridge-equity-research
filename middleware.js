/**
 * Vercel Edge Middleware
 * Runs at the CDN edge BEFORE any page, asset, or API route is served.
 * Every request must carry a valid signed session cookie or it is blocked.
 *
 * Protected routes: everything
 * Public routes:    /login  /api/login  /api/logout  (auth flow only)
 */

const PUBLIC_PATHS = ["/login", "/api/login", "/api/logout"];

// ── Crypto helpers (Web Crypto API — available in Edge Runtime) ────────────────
async function hmacSign(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  // base64url encode
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function verifySessionCookie(cookieHeader, secret) {
  if (!cookieHeader || !secret) return false;
  const match = cookieHeader.match(/(?:^|;\s*)bb_session=([^;]+)/);
  if (!match) return false;
  const token = match[1];
  const expected = await hmacSign(secret, "bb-auth-session-v1");
  // Constant-time comparison to prevent timing attacks
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// ── Middleware entry point ────────────────────────────────────────────────────
export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Always allow the auth flow through
  if (PUBLIC_PATHS.some(p => path === p || path.startsWith(p + "/"))) {
    return; // pass through
  }

  // Static assets don't need auth (Vite build output: .js .css .svg etc.)
  // BUT we do protect the index.html itself — no free ride to the shell
  if (path.match(/\.(js|css|ico|png|svg|woff2?|ttf|map)$/)) {
    const cookie = request.headers.get("cookie") || "";
    const valid = await verifySessionCookie(cookie, process.env.SESSION_SECRET);
    if (!valid) {
      // Block asset too — prevents fingerprinting the app without auth
      return new Response("Unauthorized", { status: 401 });
    }
    return; // pass through
  }

  // Verify session for everything else
  const cookie = request.headers.get("cookie") || "";
  const valid = await verifySessionCookie(cookie, process.env.SESSION_SECRET);

  if (!valid) {
    // Redirect to login, preserving the intended destination
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path === "/" ? "" : path);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // ✅ Authenticated — pass through
}

export const config = {
  matcher: ["/((?!_vercel|_next).*)"],
};
