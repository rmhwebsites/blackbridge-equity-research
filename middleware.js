/**
 * Vercel Edge Middleware
 * Runs at the CDN edge before any page/asset/API is served.
 *
 * Edge Runtime HAS globalThis.crypto.subtle natively — no import needed.
 * This is intentionally separate from the Node.js functions (api/*.js)
 * which need `import { webcrypto } from "crypto"`.
 */

const PUBLIC = ["/login", "/api/login", "/api/logout"];

async function signToken(secret, message) {
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

async function hasValidSession(cookieHeader, secret) {
  if (!cookieHeader || !secret) return false;
  const m = cookieHeader.match(/(?:^|;\s*)bb_session=([^;]+)/);
  if (!m) return false;
  const token = m[1];
  const expected = await signToken(secret, "bb-auth-session-v1");
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url);

  // Always allow the auth endpoints through
  if (PUBLIC.some(p => pathname === p || pathname.startsWith(p + "/"))) return;

  // Static build assets (js/css/etc) — also block without session so app
  // can't be fingerprinted, but allow _vercel internal paths
  if (pathname.startsWith("/_vercel")) return;

  const cookie = request.headers.get("cookie") || "";
  const secret = process.env.SESSION_SECRET;

  let valid = false;
  try {
    valid = await hasValidSession(cookie, secret);
  } catch (_) {
    valid = false;
  }

  if (!valid) {
    const loginUrl = new URL("/login", request.url);
    // Only set ?next for page navigations, not XHR/fetch calls
    const isAjax = request.headers.get("accept")?.includes("application/json") ||
                   request.headers.get("x-requested-with") === "XMLHttpRequest";
    if (!isAjax && pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    // For AJAX calls to /api/, return 401 JSON instead of redirect
    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return Response.redirect(loginUrl.toString(), 302);
  }
}

export const config = {
  matcher: ["/((?!_vercel|_next).*)"],
};
