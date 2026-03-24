/**
 * /api/analyze — Vercel Edge Function
 *
 * Keeps SSE connection alive with periodic pings (prevents 30s Edge timeout),
 * calls Anthropic with stream:false (avoids complex SSE text_delta parsing
 * that fails when web_search tool_use blocks precede the final text),
 * then sends the complete Anthropic JSON response as a single SSE data event.
 *
 * Frontend just waits for the final data event and parses it normally.
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
function parseSessionCookie(h) {
  if (!h) return null;
  const m = h.match(/(?:^|;\s*)bb_session=([^;]+)/);
  return m ? m[1] : null;
}
async function isAuthenticated(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const token = parseSessionCookie(req.headers.get("cookie") || "");
  if (!token) return false;
  const expected = await hmacSign(secret, "bb-auth-session-v1");
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ── Handler ───────────────────────────────────────────────────────────────────
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }

  // Parse request body before starting the transform stream
  let body;
  try { body = await req.json(); }
  catch (e) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  // Open a TransformStream — lets us write SSE events from an async background task
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  const write = (s) => writer.write(enc.encode(s)).catch(() => {});

  // Background task: ping to keep the Edge connection alive, then call Anthropic
  (async () => {
    let pingTimer;
    try {
      // Send a ping every 8 seconds so the Edge Function response never stalls
      pingTimer = setInterval(() => write(": ping\n\n"), 8000);

      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          // No stream:true — avoids the web_search tool_use / text_delta ordering problem
        },
        body: JSON.stringify({ ...body, stream: false }),
      });

      clearInterval(pingTimer);

      const data = await upstream.json();

      if (!upstream.ok) {
        await write(`data: ${JSON.stringify({ error: data.error || { message: `API error ${upstream.status}` } })}\n\n`);
      } else {
        // Send the complete Anthropic response as one SSE data event
        await write(`data: ${JSON.stringify(data)}\n\n`);
      }
    } catch (err) {
      clearInterval(pingTimer);
      await write(`data: ${JSON.stringify({ error: { message: "Proxy error: " + err.message } })}\n\n`);
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  // Return the streaming response immediately — the background task fills it
  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
