/**
 * /api/reports
 * GET    → returns all saved reports from Supabase, ordered by report_date DESC
 * DELETE → deletes all reports (clear archive)
 *
 * Protected by session cookie (same HMAC check as analyze.js).
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars injected by Vercel.
 */

export const config = { runtime: "edge" };

// ── Auth ──────────────────────────────────────────────────────────────────────
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

function parseCookie(h) {
  if (!h) return null;
  const m = h.match(/(?:^|;\s*)bb_session=([^;]+)/);
  return m ? m[1] : null;
}

async function isAuthenticated(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const token = parseCookie(req.headers.get("cookie") || "");
  if (!token) return false;
  const expected = await hmacSign(secret, "bb-auth-session-v1");
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ── Supabase REST helper (no SDK needed in Edge runtime) ──────────────────────
function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  return {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Prefer": "return=representation",
  };
}

function supabaseUrl(path) {
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/rest/v1/${path}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req) {
  if (!await isAuthenticated(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" }
    });
  }

  const supabaseBase = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseBase || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase not configured" }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }

  // GET — fetch all reports in chronological order (oldest first, frontend sorts)
  if (req.method === "GET") {
    const res = await fetch(
      supabaseUrl("bb_reports?select=report_date,payload&order=report_date.asc"),
      { headers: {
          "Content-Type": "application/json",
          "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY}`,
        }
      }
    );
    if (!res.ok) {
      const err = await res.text();
      // Table might not exist yet — return empty array gracefully
      if (res.status === 404 || err.includes("does not exist")) {
        return new Response(JSON.stringify([]), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ error: `Supabase error: ${res.status}` }), {
        status: 502, headers: { "Content-Type": "application/json" }
      });
    }
    const rows = await res.json();
    // Each row: { report_date: "YYYY-MM-DD", payload: {...report object} }
    const reports = rows.map(r => r.payload);
    return new Response(JSON.stringify(reports), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  // DELETE — clear all reports
  if (req.method === "DELETE") {
    const res = await fetch(
      supabaseUrl("bb_reports?report_date=neq.null"),
      { method: "DELETE", headers: supabaseHeaders() }
    );
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Delete failed: ${res.status}` }), {
        status: 502, headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json" }
  });
}
