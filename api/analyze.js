// Vercel serverless function — acts as a secure proxy to Anthropic API.
// The ANTHROPIC_API_KEY never leaves the server.
// Requests must include the correct DASHBOARD_PASSWORD or they are rejected.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  const password = req.headers["x-dashboard-password"];
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    return res.status(500).json({ error: "Server misconfigured: DASHBOARD_PASSWORD not set" });
  }
  if (!password || password !== expected) {
    return res.status(401).json({ error: "Unauthorized: incorrect password" });
  }

  // ── Forward request to Anthropic ──────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server misconfigured: ANTHROPIC_API_KEY not set" });
  }

  try {
    const body = req.body;

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Proxy error: " + err.message });
  }
}
