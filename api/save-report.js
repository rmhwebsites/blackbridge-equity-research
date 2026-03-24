/**
 * /api/save-report
 * POST { report: {...} } → upserts one report into Supabase bb_reports table
 *
 * Uses upsert on report_date so re-running the same day overwrites cleanly.
 */

export const config = { runtime: "edge" };

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

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  return {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Prefer": "resolution=merge-duplicates,return=minimal",
  };
}

function supabaseUrl(path) {
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/rest/v1/${path}`;
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" }
    });
  }

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

  let body;
  try { body = await req.json(); }
  catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  const { report } = body;
  if (!report || !report.reportDate) {
    return new Response(JSON.stringify({ error: "Missing report or reportDate" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  // Upsert: insert or replace on report_date conflict
  const res = await fetch(supabaseUrl("bb_reports?on_conflict=report_date"), {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({
      report_date: report.reportDate,
      payload: report,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: `Save failed: ${res.status} — ${err}` }), {
      status: 502, headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ ok: true, date: report.reportDate }), {
    status: 200, headers: { "Content-Type": "application/json" }
  });
}
