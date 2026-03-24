/**
 * /api/trigger-daily
 *
 * Called by the GitHub Actions daily cron job (not the browser).
 * Auth: X-Trigger-Secret header (separate from session cookie).
 *
 * Flow:
 *   1. Verify X-Trigger-Secret matches TRIGGER_SECRET env var
 *   2. Check if today's report already exists in Supabase (skip if so, unless force=true)
 *   3. Call Anthropic API with the full 6-layer system prompt
 *   4. Parse the JSON report
 *   5. Upsert into Supabase bb_reports
 *   6. Return the report + metadata as JSON
 *
 * This is an Edge Function — no session cookie, no browser needed.
 */

export const config = { runtime: "edge" };

// ── JSON sanitiser (same logic as frontend robustParseJSON) ───────────────────
function isTerminatorQuote(str, pos) {
  let i = pos + 1;
  while (i < str.length && /\s/.test(str[i])) i++;
  return i >= str.length || /[,:}\]]/.test(str[i]);
}

function robustParseJSON(raw) {
  let s = raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
  const start = s.indexOf("{"), end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);

  // Pass 1 — direct
  try { return JSON.parse(s); } catch(_) {}

  // Pass 2 — fix bare control chars
  function fixControls(str) {
    let out = "", inStr = false, i = 0;
    while (i < str.length) {
      const ch = str[i], code = str.charCodeAt(i);
      if (inStr) {
        if (ch==="\\") { out+=ch+(str[i+1]||""); i+=2; continue; }
        if (ch==='"') { inStr=false; out+=ch; i++; continue; }
        if (code<0x20) { out+=ch==="\n"?"\\n":ch==="\r"?"\\r":ch==="\t"?"\\t":"\\u"+code.toString(16).padStart(4,"0"); i++; continue; }
      } else { if (ch==='"') inStr=true; }
      out+=ch; i++;
    }
    return out;
  }
  try { return JSON.parse(fixControls(s)); } catch(_) {}

  // Pass 3 — trailing commas
  try { return JSON.parse(fixControls(s.replace(/,(\s*[}\]])/g,"$1"))); } catch(_) {}

  // Pass 4 — bare unescaped quotes
  function fixBareQuotes(str) {
    let out="", i=0;
    while (i<str.length) {
      const ch=str[i];
      if (ch!=='"') { out+=ch; i++; continue; }
      out+='"'; i++;
      while (i<str.length) {
        const c=str[i];
        if (c==="\\") { out+=c+(str[i+1]||""); i+=2; continue; }
        if (c==='"') { if (isTerminatorQuote(str,i)) { out+='"'; i++; break; } out+='\\"'; i++; continue; }
        const code=c.charCodeAt(0);
        if (code<0x20) { out+=c==="\n"?"\\n":c==="\r"?"\\r":c==="\t"?"\\t":"\\u"+code.toString(16).padStart(4,"0"); i++; continue; }
        out+=c; i++;
      }
    }
    return out;
  }
  try { return JSON.parse(fixBareQuotes(s)); } catch(_) {}

  throw new Error("Could not parse JSON after 4 repair passes");
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
function sbUrl(path) {
  const base = globalThis.process?.env?.SUPABASE_URL || globalThis.process?.env?.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/rest/v1/${path}`;
}
function sbHeaders(prefer="return=minimal") {
  const key = globalThis.process?.env?.SUPABASE_SERVICE_ROLE_KEY || globalThis.process?.env?.SUPABASE_ANON_KEY;
  return { "Content-Type":"application/json","apikey":key,"Authorization":`Bearer ${key}`,"Prefer":prefer };
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildPrompt(today) {
  return `You are the Chief Investment Strategist at a bulge bracket investment bank. Run a six-layer institutional top-down analysis to recommend the optimal S&P 500 sector.

TODAY: ${today}

LAYER 1 — MACRO REGIME: Search for ISM PMI, Core CPI, 10Y breakeven, DXY, commodity index. Classify quadrant: GOLDILOCKS (growth↑ inflation↓), REFLATION (both↑), STAGFLATION (growth↓ inflation↑), DEFLATION (both↓). Score growthMomentum and inflationMomentum as RISING/FALLING/STABLE. Estimate growthZScore and inflationZScore (-2 to +2).

LAYER 2 — BUSINESS CYCLE: Search yield curve (2s10s), ISM New Orders minus Inventories, unemployment. Classify: EARLY_EXPANSION, MID_EXPANSION, LATE_EXPANSION, or RECESSION. Map to clock position 1-12.

LAYER 3 — CREDIT & LIQUIDITY: Search HY OAS (ICE BofA), IG OAS, Chicago Fed NFCI, VIX. Rate hyOASRegime: TIGHT(<300), NORMAL(300-450), ELEVATED(450-500), STRESS(500-700), CRISIS(>700).

LAYER 4 — SECTOR FACTORS: For each of XLK,XLV,XLF,XLY,XLP,XLE,XLI,XLB,XLRE,XLU,XLC score: momentum(12-1m), value(fwdPE vs history), quality(ROE/debt), earningsRevisionBreadth, lowVol, carry. Composite score -2.0 to +2.0.

LAYER 5 — TECHNICALS: For each sector: price vs 200-DMA, RSI(14), MACD signal, relative strength vs SPX.

LAYER 6 — TAIL RISK: Score 0-100 each: volatilityStress, creditStress, fundingLiquidity, systemicRisk, macroVulnerability, geopoliticalTail. Dampener = max(0.25, 1-(max(0,score-50)/100)). Check: dalioDepressionGauge(LOW/MEDIUM/HIGH), bisEarlyWarning(GREEN/AMBER/RED), reflexivityAlert(bool), breadthDivergence(bool), creditGapWarning(bool), yieldCurveInversion(bool).

SCORING: StrategicView=0.5×L1+0.5×L2 | TacticalView=0.25×L3+0.45×L4+0.3×L5 | Base=0.4×Strategic+0.6×Tactical | Final=Base×Dampener
Signals: >1.0=STRONG_OVERWEIGHT, 0.5-1.0=OVERWEIGHT, -0.5-0.5=NEUTRAL, -1.0--0.5=UNDERWEIGHT, <-1.0=STRONG_UNDERWEIGHT

OUTPUT: Single valid JSON only. No markdown, no extra text. All string values must be on one line — no literal newlines, tabs, or unescaped quotes inside strings.
{"reportDate":"","reportTime":"","schemaVersion":"3.0","macroRegime":{"quadrant":"","growthMomentum":"","inflationMomentum":"","growthZScore":0,"inflationZScore":0,"regimeConfidence":0,"dalioDebtCyclePhase":"","regimeNarrative":""},"marketRegime":"","cyclePhase":"","businessCycle":{"phase":"","yieldCurveSignal":"","ismPMI":"","ismNewOrdersInventoriesDiff":"","clockPosition":0,"cycleNarrative":""},"creditLiquidity":{"hyOAS":"","hyOASRegime":"","igOAS":"","nfci":"","nfciRegime":"","vixLevel":"","vixTermStructure":"","moveIndex":"","creditSignal":"","liquidityNarrative":""},"macroIndicators":{"fedFundsRate":"","cpi":"","corePCE":"","unemployment":"","gdpGrowth":"","yieldCurve10Y2Y":"","tenYearYield":"","twoYearYield":"","dxy":"","dxyTrend":"","wtiCrude":"","goldPrice":"","copperGoldRatio":"","vix":"","moveIndex":"","spx":"","spxChange":"","spxVs200dma":"","breakeven10Y":"","realRate10Y":""},"economicEvents":[{"event":"","date":"","impact":"","actual":"","expected":"","prior":"","surprise":"","marketImplication":"","affectedSectors":[]}],"topNews":[{"headline":"","source":"","sentiment":"","sectorImpact":[],"macroRelevance":"","impact":""}],"sectorAnalysis":[{"ticker":"","name":"","compositeScore":0,"signal":"","confidence":0,"primaryDriver":"","layerScores":{"l1MacroRegime":0,"l2CycleTilt":0,"l3CreditLiq":0,"l4Fundamentals":0,"l5Technicals":0},"factorScores":{"momentum":"","momentum12m1":"","value":"","fwdPERelative":"","quality":"","earningsRevisionBreadth":"","erbTrend":"","lowVol":"","carry":"","technicalTrend":"","rsi14":"","macdSignal":"","relStrengthVsSPX":""},"cycleAlignment":"","catalyst":"","risk":"","conflictingSignals":[]}],"tailRisk":{"compositeScore":0,"regime":"","dampener":0,"subScores":{"volatilityStress":0,"creditStress":0,"fundingLiquidity":0,"systemicRisk":0,"macroVulnerability":0,"geopoliticalTail":0},"vixTermStructure":"","activeAlerts":[],"blackSwanChecklist":{"dalioDepressionGauge":"","bisEarlyWarning":"","reflexivityAlert":false,"breadthDivergence":false,"creditGapWarning":false,"yieldCurveInversion":false},"tailNarrative":""},"recommendation":{"primarySector":{"ticker":"","name":"","conviction":"","compositeScore":0,"thesis":"","timeHorizon":"","entryRationale":"","catalysts":[],"keyRisks":[]},"secondarySector":{"ticker":"","name":"","conviction":"","compositeScore":0,"thesis":"","timeHorizon":"","entryRationale":"","catalysts":[],"keyRisks":[]},"avoidSectors":[{"ticker":"","reason":""}],"defensivePivot":false,"overallRiskLevel":"","tailRiskAdjustment":"","strategistNote":""}}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" }
    });
  }

  // Auth — separate secret from session cookies (no browser session needed)
  const triggerSecret = process.env.TRIGGER_SECRET;
  if (!triggerSecret) {
    return new Response(JSON.stringify({ error: "TRIGGER_SECRET not configured" }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
  const provided = req.headers.get("x-trigger-secret") || "";
  if (provided !== triggerSecret) {
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

  // Parse body
  let body = {};
  try { body = await req.json(); } catch (_) {}
  const force = body.force === true || body.force === "true";

  const today = new Date().toISOString().split("T")[0];

  // Check if today's report already exists (skip unless force=true)
  if (!force) {
    const supabaseBase = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (supabaseBase && supabaseKey) {
      try {
        const existing = await fetch(
          sbUrl(`bb_reports?report_date=eq.${today}&select=report_date`),
          { headers: sbHeaders("return=representation") }
        );
        if (existing.ok) {
          const rows = await existing.json();
          if (rows.length > 0) {
            return new Response(JSON.stringify({
              skipped: true,
              reason: `Report for ${today} already exists. Pass force=true to override.`,
              date: today
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
        }
      } catch (_) { /* Supabase check failed — proceed anyway */ }
    }
  }

  // Run the analysis
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 8000,
        system: buildPrompt(today),
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `Today is ${today}. Execute the full six-layer institutional market analysis. Use web search extensively for current data. Score all 11 S&P 500 sector ETFs. Output ONLY the JSON report object.`
        }],
        stream: false,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      throw new Error(`Anthropic API error ${upstream.status}: ${err.error?.message || "unknown"}`);
    }

    const data = await upstream.json();

    // Extract the JSON block (prefer block starting with '{', ignore prose preamble)
    const textBlocks = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text || "");
    const jsonBlock = [...textBlocks].reverse().find(t => t.trimStart().startsWith("{"))
                   || textBlocks[textBlocks.length - 1]
                   || "";

    if (!jsonBlock) throw new Error("No text content in API response");

    const report = robustParseJSON(jsonBlock);
    if (!report.reportDate) report.reportDate = today;

    // Save to Supabase
    const supabaseBase = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    let saved = false;
    if (supabaseBase && supabaseKey) {
      const saveRes = await fetch(sbUrl("bb_reports?on_conflict=report_date"), {
        method: "POST",
        headers: sbHeaders("resolution=merge-duplicates,return=minimal"),
        body: JSON.stringify({ report_date: report.reportDate, payload: report }),
      });
      saved = saveRes.ok;
    }

    return new Response(JSON.stringify({
      ok: true,
      date: report.reportDate,
      saved,
      report,
      usage: data.usage,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      date: today,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
