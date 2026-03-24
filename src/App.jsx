import { useState, useEffect, useRef } from "react";

// ─── BRAND SYSTEM ─────────────────────────────────────────────────────────────
const BRAND = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Mono:wght@300;400;500&family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');

  :root {
    --bg:        #0B0D12;
    --bg2:       #0F1218;
    --bg3:       #141720;
    --bg4:       #1A1E2A;
    --border:    #1E2433;
    --border2:   #252B3A;
    --gold:      #C9A84C;
    --gold2:     #E8C96A;
    --gold-dim:  #5C4A1E;
    --platinum:  #8C96A8;
    --text:      #E8EDF5;
    --text2:     #9BA8BC;
    --text3:     #5A6478;
    --green:     #1DB87A;
    --green2:    #15875A;
    --red:       #E84040;
    --red2:      #A02828;
    --amber:     #E8A020;
    --amber2:    #A06F10;
    --font-display: 'Playfair Display', Georgia, serif;
    --font-data:    'DM Mono', 'Courier New', monospace;
    --font-body:    'Source Serif 4', Georgia, serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes fadeUp   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

  /* Responsive grid helpers */
  .grid-3col  { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:16px; }
  .grid-2col  { display:grid; grid-template-columns:3fr 2fr; gap:16px; margin-bottom:16px; }
  .grid-4col  { display:grid; grid-template-columns:1fr 1fr 200px 200px; gap:16px; margin-bottom:16px; }
  .grid-tail  { display:grid; grid-template-columns:260px 1fr 1fr; gap:16px; margin-bottom:16px; }
  .grid-2even { display:grid; grid-template-columns:1fr 1fr; gap:16px; }

  @media (max-width: 1100px) {
    .grid-4col { grid-template-columns:1fr 1fr; }
    .grid-tail { grid-template-columns:1fr 1fr; }
  }
  @media (max-width: 900px) {
    .grid-3col  { grid-template-columns:1fr 1fr; }
    .grid-2col  { grid-template-columns:1fr; }
    .grid-4col  { grid-template-columns:1fr; }
    .grid-tail  { grid-template-columns:1fr; }
    .grid-2even { grid-template-columns:1fr; }
  }
  @media (max-width: 600px) {
    .grid-3col  { grid-template-columns:1fr; }
    .grid-2even { grid-template-columns:1fr; }
    .bb-header-sub { display:none; }
    .bb-header-rule { display:none; }
    .bb-logout { display:none; }
    .bb-status-bar { flex-wrap:wrap; gap:8px; }
  }
`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "bb_market_reports_v3";

const REGIME_COLORS = {
  GOLDILOCKS:"#1DB87A", REFLATION:"#E8A020", STAGFLATION:"#E84040", DEFLATION:"#5A6478",
  RISK_ON:"#1DB87A", RISK_OFF:"#E84040", TRANSITIONING:"#E8A020", NEUTRAL:"#8C96A8",
};
const TAIL_COLORS = { LOW:"#1DB87A", NORMAL:"#5A6478", ELEVATED:"#E8A020", HIGH:"#E87020", CRISIS:"#E84040" };
const SIGNAL_STYLE = {
  STRONG_OVERWEIGHT: { bg:"#0A2E1A", text:"#22EE96", border:"#1DB87A" },
  OVERWEIGHT:        { bg:"#061A10", text:"#1DB87A", border:"#0A3020" },
  NEUTRAL:           { bg:"#141720", text:"#8C96A8", border:"#1E2433" },
  UNDERWEIGHT:       { bg:"#1A0808", text:"#E84040", border:"#3A1010" },
  STRONG_UNDERWEIGHT:{ bg:"#2E0808", text:"#FF6060", border:"#E84040" },
};

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const buildSystemPrompt = () => `You are the Chief Investment Strategist at a bulge bracket investment bank. Run a six-layer institutional top-down analysis to recommend the optimal S&P 500 sector.

TODAY: ${new Date().toISOString().split("T")[0]}

LAYER 1 — MACRO REGIME: Search for ISM PMI, Core CPI, 10Y breakeven, DXY, commodity index. Classify quadrant: GOLDILOCKS (growth↑ inflation↓), REFLATION (both↑), STAGFLATION (growth↓ inflation↑), DEFLATION (both↓). Score growthMomentum and inflationMomentum as RISING/FALLING/STABLE. Estimate growthZScore and inflationZScore (-2 to +2).

LAYER 2 — BUSINESS CYCLE: Search yield curve (2s10s), ISM New Orders minus Inventories, unemployment. Classify: EARLY_EXPANSION, MID_EXPANSION, LATE_EXPANSION, or RECESSION. Map to clock position 1-12.

LAYER 3 — CREDIT & LIQUIDITY: Search HY OAS (ICE BofA), IG OAS, Chicago Fed NFCI, VIX. Rate hyOASRegime: TIGHT(<300), NORMAL(300-450), ELEVATED(450-500), STRESS(500-700), CRISIS(>700).

LAYER 4 — SECTOR FACTORS: For each of XLK,XLV,XLF,XLY,XLP,XLE,XLI,XLB,XLRE,XLU,XLC score: momentum(12-1m), value(fwdPE vs history), quality(ROE/debt), earningsRevisionBreadth, lowVol, carry. Composite score -2.0 to +2.0.

LAYER 5 — TECHNICALS: For each sector: price vs 200-DMA, RSI(14), MACD signal, relative strength vs SPX.

LAYER 6 — TAIL RISK: Score 0-100 each: volatilityStress, creditStress, fundingLiquidity, systemicRisk, macroVulnerability, geopoliticalTail. Dampener = max(0.25, 1-(max(0,score-50)/100)). Check: dalioDepressionGauge(LOW/MEDIUM/HIGH), bisEarlyWarning(GREEN/AMBER/RED), reflexivityAlert(bool), breadthDivergence(bool), creditGapWarning(bool), yieldCurveInversion(bool).

SCORING: StrategicView=0.5×L1+0.5×L2 | TacticalView=0.25×L3+0.45×L4+0.3×L5 | Base=0.4×Strategic+0.6×Tactical | Final=Base×Dampener
Signals: >1.0=STRONG_OVERWEIGHT, 0.5-1.0=OVERWEIGHT, -0.5-0.5=NEUTRAL, -1.0--0.5=UNDERWEIGHT, <-1.0=STRONG_UNDERWEIGHT

OUTPUT: Single valid JSON only. No markdown, no extra text. All string values must be on one line — no literal newlines, tabs, or unescaped quotes inside strings. Use spaces instead.
{"reportDate":"","reportTime":"","schemaVersion":"3.0","macroRegime":{"quadrant":"","growthMomentum":"","inflationMomentum":"","growthZScore":0,"inflationZScore":0,"regimeConfidence":0,"dalioDebtCyclePhase":"","regimeNarrative":""},"marketRegime":"","cyclePhase":"","businessCycle":{"phase":"","yieldCurveSignal":"","ismPMI":"","ismNewOrdersInventoriesDiff":"","clockPosition":0,"cycleNarrative":""},"creditLiquidity":{"hyOAS":"","hyOASRegime":"","igOAS":"","nfci":"","nfciRegime":"","vixLevel":"","vixTermStructure":"","moveIndex":"","creditSignal":"","liquidityNarrative":""},"macroIndicators":{"fedFundsRate":"","cpi":"","corePCE":"","unemployment":"","gdpGrowth":"","yieldCurve10Y2Y":"","tenYearYield":"","twoYearYield":"","dxy":"","dxyTrend":"","wtiCrude":"","goldPrice":"","copperGoldRatio":"","vix":"","moveIndex":"","spx":"","spxChange":"","spxVs200dma":"","breakeven10Y":"","realRate10Y":""},"economicEvents":[{"event":"","date":"","impact":"","actual":"","expected":"","prior":"","surprise":"","marketImplication":"","affectedSectors":[]}],"topNews":[{"headline":"","source":"","sentiment":"","sectorImpact":[],"macroRelevance":"","impact":""}],"sectorAnalysis":[{"ticker":"","name":"","compositeScore":0,"signal":"","confidence":0,"primaryDriver":"","layerScores":{"l1MacroRegime":0,"l2CycleTilt":0,"l3CreditLiq":0,"l4Fundamentals":0,"l5Technicals":0},"factorScores":{"momentum":"","momentum12m1":"","value":"","fwdPERelative":"","quality":"","earningsRevisionBreadth":"","erbTrend":"","lowVol":"","carry":"","technicalTrend":"","rsi14":"","macdSignal":"","relStrengthVsSPX":""},"cycleAlignment":"","catalyst":"","risk":"","conflictingSignals":[]}],"tailRisk":{"compositeScore":0,"regime":"","dampener":0,"subScores":{"volatilityStress":0,"creditStress":0,"fundingLiquidity":0,"systemicRisk":0,"macroVulnerability":0,"geopoliticalTail":0},"vixTermStructure":"","activeAlerts":[],"blackSwanChecklist":{"dalioDepressionGauge":"","bisEarlyWarning":"","reflexivityAlert":false,"breadthDivergence":false,"creditGapWarning":false,"yieldCurveInversion":false},"tailNarrative":""},"recommendation":{"primarySector":{"ticker":"","name":"","conviction":"","compositeScore":0,"thesis":"","timeHorizon":"","entryRationale":"","catalysts":[],"keyRisks":[]},"secondarySector":{"ticker":"","name":"","conviction":"","compositeScore":0,"thesis":"","timeHorizon":"","entryRationale":"","catalysts":[],"keyRisks":[]},"avoidSectors":[{"ticker":"","reason":""}],"defensivePivot":false,"overallRiskLevel":"","tailRiskAdjustment":"","strategistNote":""}}
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Sanitise JSON from LLMs: escape bare control characters inside string values
// using a proper state machine (regex can't reliably track string boundaries).
function sanitizeJSON(str) {
  let out = "", inStr = false, i = 0;
  while (i < str.length) {
    const ch = str[i], code = str.charCodeAt(i);
    if (inStr) {
      if (ch === "\\") { out += ch + (str[i+1]||""); i += 2; continue; }  // skip escape seq
      if (ch === '"')  { inStr = false; out += ch; i++; continue; }
      // Bare control character inside string — escape it
      if (code < 0x20) {
        if      (ch === "\n") out += "\\n";
        else if (ch === "\r") out += "\\r";
        else if (ch === "\t") out += "\\t";
        else out += "\\u" + code.toString(16).padStart(4,"0");
        i++; continue;
      }
    } else {
      if (ch === '"') inStr = true;
    }
    out += ch; i++;
  }
  return out;
}

function parseReport(text) {
  // Strip markdown fences
  let clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // Extract outermost JSON object
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s !== -1 && e !== -1) clean = clean.slice(s, e + 1);

  // Try direct parse
  try { return JSON.parse(clean); } catch (_) {}

  // Sanitise control characters inside strings and retry
  try { return JSON.parse(sanitizeJSON(clean)); } catch (_) {}

  throw new Error("Could not parse report JSON. The model may have returned malformed output.");
}
function fmtDate(d, short=false) {
  if (!d) return "—";
  const opts = short
    ? { month:"short", day:"numeric" }
    : { month:"short", day:"numeric", year:"numeric" };
  return new Date(d+"T12:00:00Z").toLocaleDateString("en-US", opts);
}
function scoreColor(s) {
  if (s==null) return "var(--text3)";
  if (s>=1.0)  return "var(--green)";
  if (s>=0.5)  return "#4DB887";
  if (s>=-0.5) return "var(--platinum)";
  if (s>=-1.0) return "var(--amber)";
  return "var(--red)";
}
function scoreBar(s) {
  if (s==null) return 50;
  return Math.max(2, Math.min(98, ((s+2)/4)*100));
}
function signalStyle(sig) {
  return SIGNAL_STYLE[sig] || SIGNAL_STYLE.NEUTRAL;
}
function signalShort(sig) {
  if(!sig) return "N";
  return sig.replace("STRONG_OVERWEIGHT","S.OW").replace("OVERWEIGHT","OW")
            .replace("STRONG_UNDERWEIGHT","S.UW").replace("UNDERWEIGHT","UW")
            .replace("NEUTRAL","N");
}

// ─── BB LOGO ─────────────────────────────────────────────────────────────────
function BBLogo({ size=36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bbGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8C96A"/>
          <stop offset="100%" stopColor="#C9A84C"/>
        </linearGradient>
        <linearGradient id="bbShield" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1A1E2A"/>
          <stop offset="100%" stopColor="#0F1218"/>
        </linearGradient>
      </defs>
      {/* Shield shape */}
      <path d="M18 2L33 8V20C33 27.5 25.5 33 18 34C10.5 33 3 27.5 3 20V8L18 2Z"
        fill="url(#bbShield)" stroke="url(#bbGrad)" strokeWidth="1"/>
      {/* BB monogram */}
      <text x="18" y="23" textAnchor="middle" fill="url(#bbGrad)"
        fontSize="12" fontWeight="700" fontFamily="'Playfair Display', Georgia, serif"
        letterSpacing="-0.5">BB</text>
    </svg>
  );
}

// ─── REGIME BADGE ─────────────────────────────────────────────────────────────
function RegimeBadge({ regime, size="md" }) {
  const c = REGIME_COLORS[regime] || "var(--platinum)";
  const pad = size==="sm" ? "1px 7px" : "3px 11px";
  const fs  = size==="sm" ? 9 : 10;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:c+"18",
      border:`1px solid ${c}40`, borderRadius:3, padding:pad, fontSize:fs,
      color:c, fontFamily:"var(--font-data)", fontWeight:500, letterSpacing:"0.08em" }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:c, boxShadow:`0 0 5px ${c}` }}/>
      {regime?.replace(/_/g," ")}
    </span>
  );
}

// ─── MACRO TILE ───────────────────────────────────────────────────────────────
function MacroTile({ label, value, sub, trend }) {
  const trendColor = trend==="RISING"||trend?.startsWith("+") ? "var(--green)"
                   : trend==="FALLING"||trend?.startsWith("-") ? "var(--red)" : "var(--platinum)";
  return (
    <div style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6,
      padding:"10px 14px", minWidth:100, flexShrink:0 }}>
      <div style={{ fontSize:14, color:"var(--text3)", letterSpacing:"0.14em", textTransform:"uppercase",
        fontFamily:"var(--font-data)", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:500, color:"var(--text)", fontFamily:"var(--font-data)",
        letterSpacing:"-0.02em" }}>{value||"—"}</div>
      {sub && <div style={{ fontSize:16, color:trendColor, fontFamily:"var(--font-data)", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

// ─── CARD WRAPPER ─────────────────────────────────────────────────────────────
function Card({ children, style={} }) {
  return (
    <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:8,
      padding:20, ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize:15, color:"var(--gold)", letterSpacing:"0.16em", textTransform:"uppercase",
      fontFamily:"var(--font-data)", fontWeight:500, marginBottom:14, paddingBottom:8,
      borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ width:16, height:1, background:"var(--gold)", display:"inline-block" }}/>
      {children}
      <span style={{ flex:1, height:1, background:"var(--border)", display:"inline-block" }}/>
    </div>
  );
}

// ─── SCORE METER ─────────────────────────────────────────────────────────────
function ScoreMeter({ score, size=40 }) {
  const c = scoreColor(score);
  const label = score==null ? "—" : score>=1 ? "OW+" : score>=0.5 ? "OW" : score>-0.5 ? "N" : score>-1 ? "UW" : "UW−";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
      <div style={{ width:size, height:size, borderRadius:"50%", border:`1.5px solid ${c}`,
        display:"flex", alignItems:"center", justifyContent:"center", background:c+"12" }}>
        <span style={{ fontSize:size*0.21, color:c, fontFamily:"var(--font-data)", fontWeight:500 }}>{label}</span>
      </div>
      {score!=null && <span style={{ fontSize:15, color:c, fontFamily:"var(--font-data)" }}>{score.toFixed(2)}</span>}
    </div>
  );
}

// ─── LAYER BAR ────────────────────────────────────────────────────────────────
function LayerBar({ label, score }) {
  const c = scoreColor(score);
  const w = scoreBar(score);
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
        <span style={{ fontSize:15, color:"var(--text3)", fontFamily:"var(--font-data)" }}>{label}</span>
        <span style={{ fontSize:15, color:c, fontFamily:"var(--font-data)", fontWeight:500 }}>
          {score!=null ? score.toFixed(2) : "—"}
        </span>
      </div>
      <div style={{ height:2, background:"var(--bg4)", borderRadius:1, overflow:"hidden" }}>
        <div style={{ width:w+"%", height:"100%", background:c, borderRadius:1 }}/>
      </div>
    </div>
  );
}

// ─── FACTOR PILL ──────────────────────────────────────────────────────────────
function FactorRow({ label, value, signal }) {
  const c = {
    STRONG:"var(--green)",HIGH:"var(--green)",OUTPERFORMING:"var(--green)",BULLISH:"var(--green)",
    ABOVE_200DMA:"var(--green)",IMPROVING:"var(--green)",
    MODERATE:"var(--amber)",NEUTRAL:"var(--amber)",INLINE:"var(--platinum)",
    WEAK:"var(--amber)",EXPENSIVE:"var(--amber)",
    NEGATIVE:"var(--red)",UNDERPERFORMING:"var(--red)",BEARISH:"var(--red)",
    BELOW_200DMA:"var(--red)",LOW:"var(--amber)",DETERIORATING:"var(--red)",
  }[signal] || "var(--text3)";
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
      <span style={{ fontSize:16, color:"var(--text3)", fontFamily:"var(--font-body)" }}>{label}</span>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        {value && <span style={{ fontSize:15, color:"var(--text3)", fontFamily:"var(--font-data)" }}>{value}</span>}
        <span style={{ fontSize:15, color:c, fontFamily:"var(--font-data)", fontWeight:500 }}>{signal||"—"}</span>
      </div>
    </div>
  );
}

// ─── S&P 500 vs RECOMMENDATION PERFORMANCE CHART ────────────────────────────
function PerformanceChart({ reports }) {
  if (reports.length < 2) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:160,
      color:"var(--text3)", fontSize:14, fontFamily:"var(--font-data)" }}>
      Run 2+ reports to see performance chart
    </div>
  );

  const last12 = reports.slice(-12);
  const W=560, H=130, PAD={top:16,right:20,bottom:24,left:40};
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // Build data points
  const pts = last12.map((r, i) => ({
    spx: parseFloat((r.macroIndicators?.spxChange||"0").replace(/[^0-9.\-+]/g,"")),
    score: r.recommendation?.primarySector?.compositeScore ?? 0,
    regime: r.macroRegime?.quadrant || r.marketRegime,
    sector: r.recommendation?.primarySector?.ticker || "—",
  }));

  // Normalize each series to [-2, 2] for overlay
  const spxVals  = pts.map(p => p.spx);
  const scoreVals= pts.map(p => p.score);
  const minSPX = Math.min(...spxVals), maxSPX = Math.max(...spxVals);
  const minScore= Math.min(...scoreVals), maxScore= Math.max(...scoreVals);

  const toY = (val, min, max) => {
    const range = max - min || 1;
    return PAD.top + innerH - ((val - min) / range) * innerH;
  };

  const spxPoints  = pts.map((p,i) => ({ x: PAD.left + (i/(pts.length-1))*innerW, y: toY(p.spx, minSPX, maxSPX) }));
  const scorePoints= pts.map((p,i) => ({ x: PAD.left + (i/(pts.length-1))*innerW, y: toY(p.score, minScore, maxScore) }));

  const polyline = (pts) => pts.map(p=>`${p.x},${p.y}`).join(" ");
  const area     = (pts, baseY) => `M${pts[0].x},${baseY} ` + pts.map(p=>`L${p.x},${p.y}`).join(" ") + ` L${pts[pts.length-1].x},${baseY} Z`;
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:20, height:2, background:"var(--green)", borderRadius:1 }}/>
          <span style={{ fontSize:15, color:"var(--text3)", fontFamily:"var(--font-data)" }}>S&P 500 Daily %</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:20, height:2, background:"var(--gold)", borderRadius:1, borderTop:"1px dashed var(--gold)" }}/>
          <span style={{ fontSize:15, color:"var(--text3)", fontFamily:"var(--font-data)" }}>Primary Sector Score</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }}>
        <defs>
          <linearGradient id="spxGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1DB87A" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#1DB87A" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#C9A84C" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map(t => {
          const y = PAD.top + t * innerH;
          return <line key={t} x1={PAD.left} x2={PAD.left+innerW} y1={y} y2={y}
            stroke="var(--border)" strokeWidth="1" strokeDasharray="3,4"/>;
        })}

        {/* SPX area + line */}
        <path d={area(spxPoints, PAD.top+innerH)} fill="url(#spxGrad)"/>
        <polyline points={polyline(spxPoints)} fill="none" stroke="var(--green)" strokeWidth="1.5"/>

        {/* Score area + dashed line */}
        <path d={area(scorePoints, PAD.top+innerH)} fill="url(#scoreGrad)"/>
        <polyline points={polyline(scorePoints)} fill="none" stroke="var(--gold)"
          strokeWidth="1.5" strokeDasharray="4,3"/>

        {/* Dots + date labels */}
        {pts.map((p, i) => {
          const x = PAD.left + (i/(pts.length-1))*innerW;
          const c = REGIME_COLORS[p.regime] || "var(--platinum)";
          return (
            <g key={i}>
              <circle cx={x} cy={spxPoints[i].y} r="3" fill="var(--green)"/>
              <circle cx={x} cy={scorePoints[i].y} r="3" fill="var(--gold)"/>
              {/* Sector label */}
              <text x={x} y={H-4} textAnchor="middle" fill="var(--text3)"
                fontSize="9" fontFamily="var(--font-data)">{p.sector}</text>
              {/* Regime dot at bottom */}
              <circle cx={x} cy={H-14} r="2.5" fill={c} opacity="0.7"/>
            </g>
          );
        })}

        {/* Y axis labels */}
        <text x={PAD.left-4} y={PAD.top+5} textAnchor="end" fill="var(--text3)" fontSize="9" fontFamily="var(--font-data)">+</text>
        <text x={PAD.left-4} y={PAD.top+innerH} textAnchor="end" fill="var(--text3)" fontSize="9" fontFamily="var(--font-data)">−</text>
      </svg>
    </div>
  );
}

// ─── SECTOR HEATMAP ───────────────────────────────────────────────────────────
const SECTOR_TICKERS = ["XLK","XLV","XLF","XLY","XLP","XLE","XLI","XLB","XLRE","XLU","XLC"];
const SECTOR_SHORT   = ["Tech","Hlth","Fin","Disc","Stpls","Enrg","Ind","Matl","RE","Util","Com"];

function SectorHeatmap({ reports }) {
  if (reports.length === 0) return null;
  const last8 = reports.slice(-8);
  return (
    <div style={{ overflowX:"auto" }}>
      <div style={{ minWidth:480 }}>
        {/* Header row */}
        <div style={{ display:"flex", marginBottom:4 }}>
          <div style={{ width:40, flexShrink:0 }}/>
          {last8.map((r,i) => (
            <div key={i} style={{ flex:1, textAlign:"center", fontSize:14, color:"var(--text3)", fontFamily:"var(--font-data)" }}>
              {fmtDate(r.reportDate, true)}
            </div>
          ))}
        </div>
        {/* Sector rows */}
        {SECTOR_TICKERS.map((ticker, si) => (
          <div key={ticker} style={{ display:"flex", alignItems:"center", marginBottom:3 }}>
            <div style={{ width:40, fontSize:15, color:"var(--text3)", fontFamily:"var(--font-data)", flexShrink:0 }}>
              {SECTOR_SHORT[si]}
            </div>
            {last8.map((r, ri) => {
              const sa = r.sectorAnalysis?.find(s=>s.ticker===ticker);
              const score = sa?.compositeScore ?? null;
              const c = scoreColor(score);
              const opacity = score!=null ? 0.15 + Math.abs(score)/2*0.6 : 0.05;
              return (
                <div key={ri} style={{ flex:1, height:22, background:c, opacity, borderRadius:2,
                  margin:"0 1px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {score!=null && <span style={{ fontSize:15, color:"var(--text)", fontFamily:"var(--font-data)",
                    opacity:1 }}>{score.toFixed(1)}</span>}
                </div>
              );
            })}
          </div>
        ))}
        {/* Regime row */}
        <div style={{ display:"flex", alignItems:"center", marginTop:6 }}>
          <div style={{ width:40, fontSize:15, color:"var(--text3)", fontFamily:"var(--font-data)" }}>Regime</div>
          {last8.map((r,i) => {
            const q = r.macroRegime?.quadrant||r.marketRegime;
            const c = REGIME_COLORS[q]||"var(--text3)";
            return <div key={i} style={{ flex:1, height:4, background:c, borderRadius:1, margin:"0 1px" }}/>;
          })}
        </div>
      </div>
    </div>
  );
}

// ─── MACRO QUADRANT ───────────────────────────────────────────────────────────
function MacroQuadrantWidget({ mr }) {
  if (!mr) return null;
  const gz = mr.growthZScore||0, iz = mr.inflationZScore||0;
  const dotX = ((iz+2)/4)*100;
  const dotY = 100 - ((gz+2)/4)*100;
  const qc = REGIME_COLORS[mr.quadrant]||"var(--platinum)";
  return (
    <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
      <div style={{ position:"relative", width:110, height:110, flexShrink:0,
        border:"1px solid var(--border)", borderRadius:5, overflow:"hidden", background:"var(--bg)" }}>
        {[{x:0,y:0,l:"GOLD",c:"var(--green)"},{x:50,y:0,l:"REFL",c:"var(--amber)"},
          {x:0,y:50,l:"DEFL",c:"var(--text3)"},{x:50,y:50,l:"STAG",c:"var(--red)"}
        ].map(({x,y,l,c})=>(
          <div key={l} style={{position:"absolute",left:x+"%",top:y+"%",width:"50%",height:"50%",
            background:c+"10",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:15,color:c,fontFamily:"var(--font-data)",opacity:0.6}}>{l}</span>
          </div>
        ))}
        <div style={{position:"absolute",left:"50%",top:0,bottom:0,width:1,background:"var(--border)"}}/>
        <div style={{position:"absolute",top:"50%",left:0,right:0,height:1,background:"var(--border)"}}/>
        <div style={{position:"absolute",left:`calc(${dotX}% - 6px)`,top:`calc(${dotY}% - 6px)`,
          width:12,height:12,borderRadius:"50%",background:qc,boxShadow:`0 0 8px ${qc}`,zIndex:10}}/>
        <div style={{position:"absolute",bottom:2,left:"50%",transform:"translateX(-50%)",
          fontSize:6,color:"var(--text3)",fontFamily:"var(--font-data)"}}>INFLATION →</div>
      </div>
      <div style={{flex:1}}>
        <RegimeBadge regime={mr.quadrant}/>
        {mr.regimeConfidence != null && (
          <div style={{fontSize:15,color:"var(--text3)",fontFamily:"var(--font-data)",marginTop:5}}>
            Confidence: <span style={{color:mr.regimeConfidence>0.6?"var(--green)":"var(--amber)"}}>
              {Math.round(mr.regimeConfidence*100)}%
            </span>
          </div>
        )}
        <div style={{display:"flex",gap:12,marginTop:6}}>
          {[["Growth",mr.growthMomentum],["Inflation",mr.inflationMomentum]].map(([l,v])=>(
            <div key={l}>
              <div style={{fontSize:14,color:"var(--text3)",fontFamily:"var(--font-data)",marginBottom:2}}>{l}</div>
              <div style={{fontSize:16,fontFamily:"var(--font-data)",fontWeight:500,
                color:{RISING:"var(--green)",FALLING:"var(--red)",STABLE:"var(--platinum)"}[v]||"var(--platinum)"}}>
                {v||"—"}
              </div>
            </div>
          ))}
        </div>
        {mr.regimeNarrative && (
          <div style={{fontSize:16,color:"var(--text3)",fontFamily:"var(--font-body)",
            lineHeight:1.5,marginTop:8,fontStyle:"italic"}}>{mr.regimeNarrative}</div>
        )}
      </div>
    </div>
  );
}

// ─── INVESTMENT CLOCK ─────────────────────────────────────────────────────────
function InvestmentClockWidget({ bc }) {
  if (!bc) return null;
  const pos = bc.clockPosition||9;
  const rad = (pos/12)*2*Math.PI - Math.PI/2;
  const hx = 50 + 34*Math.cos(rad), hy = 50 + 34*Math.sin(rad);
  return (
    <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
      <div style={{width:110,height:110,flexShrink:0,position:"relative"}}>
        <svg viewBox="0 0 100 100" style={{width:"100%",height:"100%"}}>
          {[{d:"M50,50 L50,10 A40,40 0 0,1 90,50 Z",c:"#1DB87A18",l:"EARLY",lx:72,ly:28},
            {d:"M50,50 L90,50 A40,40 0 0,1 50,90 Z",c:"#E8A02018",l:"LATE",lx:72,ly:72},
            {d:"M50,50 L50,90 A40,40 0 0,1 10,50 Z",c:"#E8404018",l:"RECESS",lx:16,ly:72},
            {d:"M50,50 L10,50 A40,40 0 0,1 50,10 Z",c:"#8C96A818",l:"RECOV",lx:20,ly:28}
          ].map(({d,c,l,lx,ly})=>(
            <g key={l}>
              <path d={d} fill={c}/>
              <text x={lx} y={ly} textAnchor="middle" fill="var(--text3)" fontSize="9" fontFamily="var(--font-data)">{l}</text>
            </g>
          ))}
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="1"/>
          <circle cx="50" cy="50" r="2.5" fill="var(--text3)"/>
          {Array.from({length:12},(_,i)=>{
            const a=(i/12)*2*Math.PI-Math.PI/2;
            return <line key={i} x1={50+34*Math.cos(a)} y1={50+34*Math.sin(a)}
              x2={50+39*Math.cos(a)} y2={50+39*Math.sin(a)} stroke="var(--border)" strokeWidth="0.8"/>;
          })}
          <line x1="50" y1="50" x2={hx} y2={hy} stroke="var(--gold)" strokeWidth="2" strokeLinecap="round"/>
          <circle cx={hx} cy={hy} r="2.5" fill="var(--gold)"/>
          <text x="50" y="54" textAnchor="middle" fill="var(--gold)" fontSize="9" fontFamily="var(--font-data)">{pos}:00</text>
        </svg>
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:16,fontFamily:"var(--font-display)",fontWeight:600,color:"var(--text)",marginBottom:6}}>
          {bc.phase?.replace(/_/g," ")||"—"}
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          {bc.ismPMI && (
            <span style={{fontSize:15,color:parseFloat(bc.ismPMI)>50?"var(--green)":"var(--red)",
              fontFamily:"var(--font-data)",background:"var(--bg3)",border:"1px solid var(--border)",
              borderRadius:3,padding:"1px 7px"}}>PMI {bc.ismPMI}</span>
          )}
          <span style={{fontSize:15,color:{STEEPENING:"var(--green)",INVERTED:"var(--red)",FLAT:"var(--amber)"}[bc.yieldCurveSignal]||"var(--platinum)",
            fontFamily:"var(--font-data)",background:"var(--bg3)",border:"1px solid var(--border)",
            borderRadius:3,padding:"1px 7px"}}>CURVE {bc.yieldCurveSignal||"—"}</span>
        </div>
        {bc.cycleNarrative && (
          <div style={{fontSize:16,color:"var(--text3)",fontFamily:"var(--font-body)",lineHeight:1.5,fontStyle:"italic"}}>
            {bc.cycleNarrative}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CREDIT PANEL ─────────────────────────────────────────────────────────────
function CreditPanel({ cl }) {
  if (!cl) return null;
  const hyN = parseInt(cl.hyOAS)||0;
  const hyC = hyN>700?"var(--red)":hyN>500?"var(--amber)":hyN>300?"var(--platinum)":"var(--green)";
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        {[
          {l:"HY OAS",v:cl.hyOAS,c:hyC,s:cl.hyOASRegime},
          {l:"IG OAS",v:cl.igOAS,c:"var(--platinum)"},
          {l:"NFCI",v:cl.nfci,c:parseFloat(cl.nfci)>0?"var(--amber)":"var(--green)",s:cl.nfciRegime},
          {l:"MOVE",v:cl.moveIndex,c:parseInt(cl.moveIndex)>150?"var(--red)":"var(--platinum)"},
        ].map(({l,v,c,s})=>(
          <div key={l} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:5,padding:"8px 10px"}}>
            <div style={{fontSize:14,color:"var(--text3)",fontFamily:"var(--font-data)",marginBottom:3,letterSpacing:"0.1em"}}>{l}</div>
            <div style={{fontSize:14,fontWeight:500,color:c,fontFamily:"var(--font-data)"}}>{v||"—"}</div>
            {s && <div style={{fontSize:14,color:c,fontFamily:"var(--font-data)",marginTop:1}}>{s}</div>}
          </div>
        ))}
      </div>
      {/* HY threshold bar */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:14,color:"var(--text3)",fontFamily:"var(--font-data)",marginBottom:4,letterSpacing:"0.1em"}}>HY OAS REGIME THRESHOLDS</div>
        <div style={{display:"flex",height:5,borderRadius:2,overflow:"hidden",gap:1}}>
          {[["TIGHT",20,"var(--green)"],["NORMAL",30,"#4DB887"],["ELEVATED",15,"var(--amber)"],["STRESS",20,"var(--amber2)"],["CRISIS",15,"var(--red)"]].map(([l,w,c])=>(
            <div key={l} style={{flex:w,background:c,opacity:cl.hyOASRegime===l?1:0.2,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:5.5,color:"var(--bg)",fontFamily:"var(--font-data)",fontWeight:700}}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      {cl.liquidityNarrative && (
        <div style={{fontSize:16,color:"var(--text3)",fontFamily:"var(--font-body)",lineHeight:1.5,fontStyle:"italic"}}>
          {cl.liquidityNarrative}
        </div>
      )}
    </div>
  );
}

// ─── TAIL RISK PANEL ──────────────────────────────────────────────────────────
function TailRiskWidget({ tailRisk }) {
  if (!tailRisk) return null;
  const sc = tailRisk.compositeScore||0;
  const c  = TAIL_COLORS[tailRisk.regime]||"var(--platinum)";
  const ss = tailRisk.subScores||{};
  const bsc= tailRisk.blackSwanChecklist||{};
  const subKeys=[["volatilityStress","VOL STRESS"],["creditStress","CREDIT"],["fundingLiquidity","FUNDING"],["systemicRisk","SYSTEMIC"],["macroVulnerability","MACRO VULN"],["geopoliticalTail","GEO RISK"]];
  return (
    <div>
      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:14}}>
        <div style={{position:"relative",width:64,height:64,flexShrink:0}}>
          <svg viewBox="0 0 36 36" style={{width:"100%",height:"100%",transform:"rotate(-90deg)"}}>
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--bg4)" strokeWidth="3"/>
            <circle cx="18" cy="18" r="15" fill="none" stroke={c} strokeWidth="3"
              strokeDasharray={`${(sc/100)*94.2} 94.2`} strokeLinecap="round"/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:14,fontWeight:700,color:c,fontFamily:"var(--font-data)"}}>{sc}</span>
            <span style={{fontSize:15,color:c,fontFamily:"var(--font-data)"}}>/ 100</span>
          </div>
        </div>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:c,fontFamily:"var(--font-display)"}}>{tailRisk.regime}</div>
          <div style={{fontSize:15,color:"var(--text3)",marginTop:2}}>
            Dampener: <span style={{color:c,fontFamily:"var(--font-data)"}}>{tailRisk.dampener?.toFixed(2)||"1.00"}×</span>
          </div>
        </div>
      </div>
      <div style={{marginBottom:12}}>
        {subKeys.map(([k,label])=>{
          const v=ss[k]||0;
          const bc=v>=70?"var(--red)":v>=50?"var(--amber)":"var(--border2)";
          return (
            <div key={k} style={{marginBottom:5}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:14,color:"var(--text3)",fontFamily:"var(--font-data)"}}>{label}</span>
                <span style={{fontSize:14,color:bc,fontFamily:"var(--font-data)",fontWeight:500}}>{v}</span>
              </div>
              <div style={{height:2,background:"var(--bg4)",borderRadius:1,overflow:"hidden"}}>
                <div style={{width:v+"%",height:"100%",background:bc,borderRadius:1}}/>
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <div style={{fontSize:14,color:"var(--gold)",fontFamily:"var(--font-data)",letterSpacing:"0.12em",marginBottom:7}}>
          BLACK SWAN CHECKLIST
        </div>
        {[
          ["Dalio Depression Gauge", bsc.dalioDepressionGauge==="LOW"],
          ["BIS Early Warning",      bsc.bisEarlyWarning==="GREEN"],
          ["Soros Reflexivity",      !bsc.reflexivityAlert],
          ["Breadth Divergence",     !bsc.breadthDivergence],
          ["Credit Gap (>10pp)",     !bsc.creditGapWarning],
          ["Yield Curve Inversion",  !bsc.yieldCurveInversion],
        ].map(([label,ok])=>(
          <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid var(--border)"}}>
            <span style={{fontSize:15,color:"var(--text3)",fontFamily:"var(--font-body)"}}>{label}</span>
            <span style={{fontSize:15,color:ok?"var(--green)":"var(--amber)",fontFamily:"var(--font-data)"}}>
              {ok ? "✓ CLEAR" : "⚠ ALERT"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SECTOR ROW ───────────────────────────────────────────────────────────────
function SectorRow({ s, onSelect, selected }) {
  const ss = signalStyle(s.signal);
  const sc = scoreColor(s.compositeScore);
  return (
    <div onClick={()=>onSelect(s)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px",
      borderBottom:"1px solid var(--border)",cursor:"pointer",background:selected?"var(--bg3)":"transparent",
      borderRadius:4,transition:"background 0.1s"}}>
      <div style={{width:36,fontSize:16,color:"var(--text3)",fontFamily:"var(--font-data)"}}>{s.ticker}</div>
      <div style={{flex:1,fontSize:14,color:"var(--text2)",fontFamily:"var(--font-body)"}}>{s.name}</div>
      <div style={{width:48,height:3,background:"var(--bg4)",borderRadius:1,overflow:"hidden"}}>
        <div style={{width:scoreBar(s.compositeScore)+"%",height:"100%",background:sc,borderRadius:1}}/>
      </div>
      <div style={{width:30,textAlign:"right",fontSize:15,color:sc,fontFamily:"var(--font-data)",fontWeight:500}}>
        {s.compositeScore!=null?s.compositeScore.toFixed(1):"—"}
      </div>
      <div style={{fontSize:15,fontWeight:500,color:ss.text,background:ss.bg,
        border:`1px solid ${ss.border}`,borderRadius:3,padding:"1px 5px",
        fontFamily:"var(--font-data)",minWidth:26,textAlign:"center"}}>
        {signalShort(s.signal)}
      </div>
    </div>
  );
}

// ─── SECTOR DETAIL PANEL ──────────────────────────────────────────────────────
function SectorDetailPanel({ s }) {
  if (!s) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",
      color:"var(--text3)",fontSize:14,fontFamily:"var(--font-data)"}}>
      Select a sector ↑
    </div>
  );
  const f  = s.factorScores||{};
  const ls = s.layerScores||{};
  return (
    <div style={{height:"100%",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontSize:15,fontFamily:"var(--font-display)",fontWeight:600,color:"var(--text)"}}>{s.name}</div>
          <div style={{fontSize:16,color:"var(--text3)",fontFamily:"var(--font-data)"}}>{s.ticker}</div>
        </div>
        <ScoreMeter score={s.compositeScore} size={42}/>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
        {s.confidence!=null && <span style={{fontSize:14,color:s.confidence>0.65?"var(--green)":"var(--amber)",
          fontFamily:"var(--font-data)",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:3,padding:"1px 6px"}}>
          {Math.round(s.confidence*100)}% CONF</span>}
        {s.primaryDriver && <span style={{fontSize:14,color:"var(--gold)",fontFamily:"var(--font-data)",
          background:"var(--bg3)",border:"1px solid var(--gold-dim)",borderRadius:3,padding:"1px 6px"}}>{s.primaryDriver}</span>}
      </div>
      <div style={{marginBottom:10}}>
        <div style={{fontSize:14,color:"var(--text3)",fontFamily:"var(--font-data)",letterSpacing:"0.1em",marginBottom:6}}>LAYER SCORES</div>
        <LayerBar label="L1 Macro Regime" score={ls.l1MacroRegime}/>
        <LayerBar label="L2 Cycle Tilt"   score={ls.l2CycleTilt}/>
        <LayerBar label="L3 Credit/Liq"   score={ls.l3CreditLiq}/>
        <LayerBar label="L4 Fundamentals" score={ls.l4Fundamentals}/>
        <LayerBar label="L5 Technicals"   score={ls.l5Technicals}/>
      </div>
      <div style={{marginBottom:10}}>
        <div style={{fontSize:14,color:"var(--text3)",fontFamily:"var(--font-data)",letterSpacing:"0.1em",marginBottom:6}}>FACTOR SCORES</div>
        <FactorRow label="Momentum (12-1m)"    value={f.momentum12m1} signal={f.momentum}/>
        <FactorRow label="Valuation (Fwd P/E)" value={f.fwdPERelative} signal={f.value}/>
        <FactorRow label="Quality (ROE/Debt)"  signal={f.quality}/>
        <FactorRow label="Earnings Revisions"  value={f.earningsRevisionBreadth} signal={f.erbTrend}/>
        <FactorRow label="Low Volatility"      signal={f.lowVol}/>
        <FactorRow label="Carry / Yield"       signal={f.carry}/>
        <FactorRow label={`RSI(14): ${f.rsi14||"—"}`} signal={parseFloat(f.rsi14)>70?"OVERBOUGHT":parseFloat(f.rsi14)<30?"OVERSOLD":parseFloat(f.rsi14)>55?"BULLISH":"NEUTRAL"}/>
        <FactorRow label="MACD Signal"  signal={f.macdSignal}/>
        <FactorRow label="vs SPX"       signal={f.relStrengthVsSPX}/>
      </div>
      {s.catalyst && <div style={{marginBottom:8}}>
        <div style={{fontSize:14,color:"var(--green)",fontFamily:"var(--font-data)",marginBottom:4}}>▲ CATALYST</div>
        <div style={{fontSize:16,color:"var(--text3)",lineHeight:1.5}}>{s.catalyst}</div>
      </div>}
      {s.risk && <div>
        <div style={{fontSize:14,color:"var(--red)",fontFamily:"var(--font-data)",marginBottom:4}}>▼ RISK</div>
        <div style={{fontSize:16,color:"var(--text3)",lineHeight:1.5}}>{s.risk}</div>
      </div>}
    </div>
  );
}

// ─── REC CARD ─────────────────────────────────────────────────────────────────
function RecCard({ rec, primary }) {
  if (!rec) return null;
  const convC = {HIGH:"var(--green)",MEDIUM:"var(--amber)",LOW:"var(--red)"}[rec.conviction]||"var(--platinum)";
  return (
    <div style={{background:primary?"var(--bg2)":"var(--bg3)",border:`1px solid ${primary?"var(--gold-dim)":"var(--border)"}`,
      borderRadius:8,padding:20,position:"relative",overflow:"hidden"}}>
      {primary && <div style={{position:"absolute",top:0,left:0,right:0,height:2,
        background:"linear-gradient(90deg,var(--gold),var(--gold2))"}}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontSize:15,color:"var(--gold)",fontFamily:"var(--font-data)",letterSpacing:"0.14em",marginBottom:6}}>
            {primary ? "PRIMARY OVERWEIGHT" : "SECONDARY OVERWEIGHT"}
          </div>
          <div style={{fontSize:26,fontFamily:"var(--font-display)",fontWeight:600,color:"var(--text)",
            letterSpacing:"-0.02em",lineHeight:1}}>{rec.name}</div>
          <div style={{fontSize:14,color:"var(--text3)",fontFamily:"var(--font-data)",marginTop:3}}>{rec.ticker}</div>
        </div>
        <ScoreMeter score={rec.compositeScore} size={42}/>
      </div>
      <div style={{fontSize:15,color:"var(--text3)",fontFamily:"var(--font-body)",lineHeight:1.7,marginBottom:12}}>
        {rec.thesis}
      </div>
      {rec.catalysts?.length>0 && (
        <div style={{marginBottom:10}}>
          <div style={{fontSize:14,color:"var(--green)",fontFamily:"var(--font-data)",marginBottom:4}}>▲ CATALYSTS</div>
          {rec.catalysts.map((c,i)=><div key={i} style={{fontSize:16,color:"var(--text3)",marginBottom:2}}>· {c}</div>)}
        </div>
      )}
      {rec.keyRisks?.length>0 && (
        <div style={{marginBottom:12}}>
          <div style={{fontSize:14,color:"var(--red)",fontFamily:"var(--font-data)",marginBottom:4}}>▼ KEY RISKS</div>
          {rec.keyRisks.map((r,i)=><div key={i} style={{fontSize:16,color:"var(--text3)",marginBottom:2}}>· {r}</div>)}
        </div>
      )}
      <div style={{background:"var(--bg)",borderRadius:5,padding:"9px 12px",
        borderLeft:`2px solid ${convC}`,fontSize:16,color:"var(--text3)",fontFamily:"var(--font-body)"}}>
        <span style={{color:convC,fontFamily:"var(--font-data)",fontWeight:500}}>ENTRY: </span>{rec.entryRationale}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:10,alignItems:"center"}}>
        <span style={{fontSize:15,color:convC,fontFamily:"var(--font-data)"}}>{rec.conviction} CONVICTION</span>
        <span style={{fontSize:15,color:"var(--text3)",fontFamily:"var(--font-data)"}}>{rec.timeHorizon}</span>
      </div>
    </div>
  );
}

// ─── NEWS ITEM ────────────────────────────────────────────────────────────────
function NewsItem({ item }) {
  const c = item.sentiment==="BULLISH"?"var(--green)":item.sentiment==="BEARISH"?"var(--red)":"var(--platinum)";
  return (
    <div style={{padding:"10px 0",borderBottom:"1px solid var(--border)",display:"flex",gap:12}}>
      <div style={{width:2,background:c,borderRadius:1,flexShrink:0}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:15,color:"var(--text)",fontFamily:"var(--font-body)",lineHeight:1.55,marginBottom:4}}>
          {item.headline}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:15,color:"var(--text3)"}}>{item.source}</span>
          {item.sectorImpact?.slice(0,3).map(t=>(
            <span key={t} style={{fontSize:14,color:"var(--text3)",fontFamily:"var(--font-data)",
              background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:2,padding:"0 4px"}}>{t}</span>
          ))}
          <span style={{fontSize:15,color:c,fontFamily:"var(--font-data)",fontWeight:500}}>{item.sentiment}</span>
          {item.macroRelevance==="HIGH" && <span style={{fontSize:14,color:"var(--amber)",fontFamily:"var(--font-data)"}}>MACRO</span>}
        </div>
        {item.impact && <div style={{fontSize:16,color:"var(--text3)",marginTop:4,lineHeight:1.45,fontFamily:"var(--font-body)"}}>{item.impact}</div>}
      </div>
    </div>
  );
}

// ─── EVENT ITEM ───────────────────────────────────────────────────────────────
function EventItem({ item }) {
  const ic = {HIGH:"var(--red)",MEDIUM:"var(--amber)",LOW:"var(--green)"}[item.impact]||"var(--text3)";
  const sc = item.surprise==="BEAT"?"var(--green)":item.surprise==="MISS"?"var(--red)":"var(--platinum)";
  return (
    <div style={{padding:"9px 0",borderBottom:"1px solid var(--border)",display:"flex",gap:10}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:ic,marginTop:4,flexShrink:0,boxShadow:`0 0 4px ${ic}`}}/>
      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
          <div style={{fontSize:14,color:"var(--text)",fontFamily:"var(--font-body)",fontWeight:400}}>{item.event}</div>
          <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
            {item.surprise && <span style={{fontSize:14,color:sc,fontFamily:"var(--font-data)",fontWeight:500}}>{item.surprise}</span>}
            <span style={{fontSize:15,color:"var(--text3)",fontFamily:"var(--font-data)"}}>{item.date}</span>
          </div>
        </div>
        {(item.actual||item.expected) && (
          <div style={{fontSize:15,color:"var(--text3)",fontFamily:"var(--font-data)",marginTop:2}}>
            {item.actual&&`A: ${item.actual}`}{item.expected&&` · E: ${item.expected}`}{item.prior&&` · P: ${item.prior}`}
          </div>
        )}
        {item.marketImplication && <div style={{fontSize:16,color:"var(--text3)",marginTop:3,lineHeight:1.4,fontFamily:"var(--font-body)"}}>{item.marketImplication}</div>}
      </div>
    </div>
  );
}

// ─── MACRO SPARKLINE ─────────────────────────────────────────────────────────
function MacroSparkline({ reports, field, label, color="var(--green)" }) {
  if (reports.length < 2) return null;
  const vals = reports.map(r => parseFloat((r.macroIndicators?.[field]||"0").replace(/[^0-9.\-]/g,""))).filter(v=>!isNaN(v));
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 0.01;
  const W=60, H=20;
  const pts = vals.map((v,i) => `${(i/(vals.length-1))*W},${H-((v-min)/range)*H}`).join(" ");
  const last = vals[vals.length-1];
  const prev = vals[vals.length-2];
  const trend = last > prev ? "↑" : last < prev ? "↓" : "→";
  const tC = last > prev ? "var(--green)" : last < prev ? "var(--red)" : "var(--platinum)";
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <svg width={W} height={H} style={{flexShrink:0}}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" opacity="0.7"/>
        <circle cx={W} cy={H-((last-min)/range)*H} r="2" fill={color}/>
      </svg>
      <div>
        <div style={{fontSize:14,color:"var(--text3)",fontFamily:"var(--font-data)",letterSpacing:"0.08em"}}>{label}</div>
        <div style={{fontSize:16,color:tC,fontFamily:"var(--font-data)"}}>{trend} {last.toFixed(2)}</div>
      </div>
    </div>
  );
}

// ─── ANALYSIS SCREEN ─────────────────────────────────────────────────────────
const ANALYSIS_LAYERS = [
  { id:"L1", label:"Macro Regime",         sub:"ISM PMI · CPI · Breakeven · DXY · AQR quadrant" },
  { id:"L2", label:"Business Cycle",       sub:"Yield curve · New Orders-Inventory · CLI" },
  { id:"L3", label:"Credit & Liquidity",   sub:"HY/IG OAS · Chicago Fed NFCI · VIX structure" },
  { id:"L4", label:"Factor Scoring",       sub:"Momentum · Value · Quality · ERB · Low-vol · Carry" },
  { id:"L5", label:"Technical Overlays",   sub:"200-DMA · RSI(14) · MACD · Relative strength" },
  { id:"L6", label:"Tail Risk",            sub:"BIS early warning · Dalio gauge · Black swan checklist" },
  { id:"∑",  label:"Composite Scoring",    sub:"Strategic × Tactical blend · Dampener applied" },
  { id:"↑",  label:"Recommendation",       sub:"Primary overweight · Secondary · Avoid list" },
];


function AnalysisScreen({ loadingStep }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [elapsed, setElapsed]     = useState(0);
  const startRef = useRef(Date.now());

  // Map loadingStep string → layer index
  useEffect(() => {
    const map = {
      "L1 · Scanning macro regime…": 0,
      "L2 · Mapping business cycle…": 1,
      "L3 · Credit & liquidity scan…": 2,
      "L4 · Factor scoring 11 sectors…": 3,
      "L5 · Technical overlays…": 4,
      "L6 · Tail risk computation…": 5,
      "Composite scoring…": 6,
      "Generating recommendation…": 7,
      "Receiving analysis…": 7,
    };
    const idx = map[loadingStep];
    if (idx !== undefined) setActiveIdx(idx);
  }, [loadingStep]);

  // Elapsed clock
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now()-startRef.current)/1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const mins = Math.floor(elapsed/60);
  const secs = String(elapsed % 60).padStart(2,"0");
  const elapsedStr = mins > 0 ? `${mins}:${secs}` : `0:${secs}`;

  // Progress: each completed step = 1/8; active step gets partial credit based on elapsed
  const baseProgress = (activeIdx / ANALYSIS_LAYERS.length) * 100;
  // Crawls slowly from baseProgress toward next step's value while waiting
  const stepProgress  = Math.min(baseProgress + 10, ((activeIdx + 0.85) / ANALYSIS_LAYERS.length) * 100);

  return (
    <div style={{
      minHeight:"100vh", background:"var(--bg)",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      fontFamily:"var(--font-data)",
    }}>
      {/* Subtle top accent */}
      <div style={{
        position:"fixed", top:0, left:0, right:0, height:2,
        background:"linear-gradient(90deg, transparent 0%, var(--gold) 40%, var(--gold2) 60%, transparent 100%)",
        opacity:0.7,
      }}/>

      {/* Card */}
      <div style={{
        width:"100%", maxWidth:520, padding:"0 20px",
      }}>
        {/* Logo + title */}
        <div style={{display:"flex", alignItems:"center", gap:14, marginBottom:40}}>
          <BBLogo size={36}/>
          <div>
            <div style={{fontSize:17, fontFamily:"var(--font-display)", fontWeight:600, color:"var(--text)", letterSpacing:"0.01em"}}>
              BlackBridge
            </div>
            <div style={{fontSize:12, color:"var(--text3)", letterSpacing:"0.1em", textTransform:"uppercase"}}>
              Running analysis
            </div>
          </div>
          {/* Elapsed time — top right */}
          <div style={{marginLeft:"auto", fontSize:13, color:"var(--text3)", fontVariantNumeric:"tabular-nums"}}>
            {elapsedStr}
          </div>
        </div>

        {/* Progress bar — thin, clean */}
        <div style={{marginBottom:36}}>
          <div style={{
            height:2, background:"var(--border)", borderRadius:1, overflow:"hidden",
          }}>
            <div style={{
              height:"100%", borderRadius:1,
              background:"linear-gradient(90deg, var(--gold2), var(--gold))",
              width: stepProgress + "%",
              transition:"width 2.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}/>
          </div>
        </div>

        {/* Layer rows */}
        <div style={{display:"flex", flexDirection:"column", gap:2}}>
          {ANALYSIS_LAYERS.map((layer, i) => {
            const done   = i < activeIdx;
            const active = i === activeIdx;
            return (
              <div key={layer.id} style={{
                display:"flex", alignItems:"center", gap:14,
                padding:"11px 14px",
                borderRadius:6,
                background: active ? "var(--bg2)" : "transparent",
                border: `1px solid ${active ? "var(--border2)" : "transparent"}`,
                transition:"background 0.3s, border-color 0.3s",
              }}>
                {/* Left indicator */}
                <div style={{
                  width:22, height:22, borderRadius:"50%", flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  background: done ? "var(--green2)" : active ? "var(--gold-dim)" : "var(--bg3)",
                  border: `1px solid ${done ? "var(--green)" : active ? "var(--gold)" : "var(--border)"}`,
                  fontSize:11,
                  transition:"all 0.3s",
                }}>
                  {done
                    ? <span style={{color:"var(--green)", fontSize:11}}>✓</span>
                    : <span style={{
                        color: active ? "var(--gold)" : "var(--text3)",
                        fontSize:9, fontWeight:500, letterSpacing:"0.05em",
                      }}>{layer.id}</span>
                  }
                </div>

                {/* Text */}
                <div style={{flex:1, minWidth:0}}>
                  <div style={{
                    fontSize:14,
                    color: done ? "var(--text3)" : active ? "var(--text)" : "var(--text3)",
                    fontWeight: active ? 500 : 400,
                    transition:"color 0.3s",
                    display:"flex", alignItems:"center", gap:8,
                  }}>
                    {layer.label}
                    {active && (
                      <span style={{
                        display:"inline-block", width:6, height:6, borderRadius:"50%",
                        background:"var(--gold)", opacity:0.9,
                        animation:"pulse 1s ease-in-out infinite",
                        flexShrink:0,
                      }}/>
                    )}
                  </div>
                  <div style={{
                    fontSize:12, color: active ? "var(--text3)" : "var(--border2)",
                    marginTop:1, transition:"color 0.3s",
                  }}>
                    {layer.sub}
                  </div>
                </div>

                {/* Right status */}
                <div style={{
                  fontSize:11, letterSpacing:"0.08em", flexShrink:0,
                  color: done ? "var(--green)" : active ? "var(--gold)" : "transparent",
                  transition:"color 0.3s",
                }}>
                  {done ? "DONE" : active ? "ACTIVE" : "·"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          marginTop:32, textAlign:"center",
          fontSize:12, color:"var(--text3)", letterSpacing:"0.04em",
        }}>
          Live web search active · typically 60–90 seconds
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [reports,setReports]=useState([]);
  const [currentReport,setCurrentReport]=useState(null);
  const [loading,setLoading]=useState(false);
  const [loadingStep,setLoadingStep]=useState("");
  const [error,setError]=useState(null);
  const [tab,setTab]=useState("dashboard");
  const [selectedDate,setSelectedDate]=useState(null);
  const [selectedSector,setSelectedSector]=useState(null);

  // ── Load reports: Supabase first, localStorage as fallback cache ─────────────
  useEffect(()=>{
    // 1. Hydrate from localStorage immediately (instant, no flicker)
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const arr = JSON.parse(s);
        const valid = arr.filter(r =>
          r && typeof r === "object" &&
          typeof r.reportDate === "string" &&
          r.reportDate.match(/^\d{4}-\d{2}-\d{2}$/)
        );
        if (valid.length) {
          setReports(valid);
          setCurrentReport(valid[valid.length - 1]);
        }
      }
    } catch(_) {}

    // 2. Then fetch from Supabase (source of truth — syncs across devices)
    fetch("/api/reports", { credentials: "same-origin" })
      .then(r => {
        if (r.status === 401) { window.location.href = "/login"; return null; }
        return r.ok ? r.json() : null;
      })
      .then(data => {
        if (!data || !Array.isArray(data) || data.length === 0) return;
        // Merge: Supabase wins for any date that exists in both
        setReports(prev => {
          const merged = [...prev];
          data.forEach(remote => {
            const idx = merged.findIndex(l => l.reportDate === remote.reportDate);
            if (idx >= 0) merged[idx] = remote;
            else merged.push(remote);
          });
          const sorted = merged.sort((a,b) => a.reportDate < b.reportDate ? -1 : 1);
          // Update localStorage cache
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted)); } catch(_) {}
          // Set current to the latest report in the final merged+sorted array
          if (sorted.length > 0) setCurrentReport(sorted[sorted.length - 1]);
          return sorted;
        });
      })
      .catch(() => {}); // offline or Supabase down — localStorage cache is fine
  }, []);

  const saveReports = (arr) => {
    const sorted = [...arr].sort((a,b) => (a.reportDate||"") < (b.reportDate||"") ? -1 : 1);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    } catch(e) {
      if (sorted.length > 10) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted.slice(-10))); } catch(_) {}
      }
    }
    setReports(sorted);
  };

  // Persist a single report to Supabase (non-blocking — localStorage already has it)
  const saveReportRemote = async (report) => {
    try {
      await fetch("/api/save-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ report }),
      });
    } catch(_) {}
  };

  const runAnalysis=async()=>{
    setLoading(true); setError(null); setTab("dashboard"); setSelectedDate(null); setSelectedSector(null);
    const STEPS=["L1 · Scanning macro regime…","L2 · Mapping business cycle…","L3 · Credit & liquidity scan…","L4 · Factor scoring 11 sectors…","L5 · Technical overlays…","L6 · Tail risk computation…","Composite scoring…","Generating recommendation…"];
    // Staggered delays between steps (ms) — total ~75s matching median analysis time.
    // Each delay is the gap BEFORE advancing to that step index.
    // Final step stays active until the real response arrives.
    const DELAYS = [0, 8000, 9000, 11000, 11000, 10000, 14000, 12000];
    let si = 0;
    setLoadingStep(STEPS[0]);
    const timers = [];
    let cumulative = 0;
    for (let i = 1; i < STEPS.length; i++) {
      cumulative += DELAYS[i];
      const step = i;
      timers.push(setTimeout(() => setLoadingStep(STEPS[step]), cumulative));
    }
    const clearAllTimers = () => timers.forEach(clearTimeout);
    try {
      const res=await fetch("/api/analyze",{
        method:"POST", headers:{"Content-Type":"application/json"}, credentials:"same-origin",
        body:JSON.stringify({
          model:"claude-sonnet-4-5", max_tokens:6000, system:buildSystemPrompt(),
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{role:"user",content:`Today is ${new Date().toISOString().split("T")[0]}. Execute the full six-layer institutional market analysis. Use web search extensively. Score all 11 S&P 500 sector ETFs. Output ONLY the JSON report object.`}]
        })
      });
      if(res.status===401){ clearAllTimers(); window.location.href="/login"; return; }
      if(!res.ok){
        const e=await res.json().catch(()=>({}));
        throw new Error(e.error?.message||e.error||`Server error ${res.status}`);
      }
      clearAllTimers(); setLoadingStep("Receiving analysis…");
      // Read the SSE stream — proxy sends pings to keep alive, then one final data event
      const reader=res.body.getReader(); const dec=new TextDecoder();
      let buf="", finalData=null;
      while(true){
        const {done,value}=await reader.read(); if(done) break;
        buf+=dec.decode(value,{stream:true});
        const lines=buf.split("\n"); buf=lines.pop()||"";
        for(const line of lines){
          if(!line.startsWith("data: ")) continue; // skip pings (": ping")
          const payload=line.slice(6).trim(); if(!payload) continue;
          try{
            const parsed=JSON.parse(payload);
            if(parsed.error) throw new Error(parsed.error?.message||parsed.error||"API error");
            if(parsed.content) finalData=parsed; // complete Anthropic response object
          }catch(e){ if(!(e instanceof SyntaxError)) throw e; }  // skip malformed SSE lines, re-throw real errors
        }
      }
      if(!finalData) throw new Error("No response received from analysis. Please try again.");
      const texts = (finalData.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
      if (!texts) throw new Error("No text content in response. Please try again.");
      let report;
      try {
        report = parseReport(texts);
      } catch (parseErr) {
        // Show the position of the failure to help diagnose
        throw new Error(`Report JSON invalid: ${parseErr.message}. The model may have included unescaped characters in a text field.`);
      }
      const updated=[...reports.filter(r=>r.reportDate!==report.reportDate),report];
      saveReports(updated);
      setCurrentReport(report);
      saveReportRemote(report); // async — persist to Supabase in background
    } catch(err) {
      clearAllTimers();
      setError(err.message||"Analysis failed. Please try again.");
    } finally { setLoading(false); setLoadingStep(""); }
  };

  const displayReport=selectedDate?reports.find(r=>r.reportDate===selectedDate):currentReport;

  const clearHistory = async () => {
    if (!window.confirm("Clear all saved reports? This deletes from Supabase too.")) return;
    saveReports([]);
    setCurrentReport(null);
    setSelectedDate(null);
    // Delete from Supabase
    try {
      await fetch("/api/reports", { method: "DELETE", credentials: "same-origin" });
    } catch(_) {}
  };

  // ── LOADING SCREEN ──────────────────────────────────────────────────────────
  if(loading) return <AnalysisScreen loadingStep={loadingStep}/>;

  const r   = displayReport;
  const m   = r?.macroIndicators||{};
  const rec = r?.recommendation||{};

  // ── ARCHIVE TAB ─────────────────────────────────────────────────────────────
  const renderArchive=()=>(
    <div>
      <Card style={{marginBottom:16}}>
        <SectionLabel>Report Archive</SectionLabel>
        {reports.length===0
          ? <div style={{color:"var(--text3)",fontSize:14,fontFamily:"var(--font-data)",padding:"24px 0",textAlign:"center"}}>
              No reports saved yet
            </div>
          : [...reports].reverse().map((rp,i)=>{
              const tailC = TAIL_COLORS[rp.tailRisk?.regime]||"var(--text3)";
              const active = selectedDate===rp.reportDate;
              return (
                <div key={i} onClick={()=>{setSelectedDate(rp.reportDate);setTab("dashboard");}}
                  style={{display:"flex",alignItems:"center",gap:14,padding:"10px 14px",borderRadius:6,
                    cursor:"pointer",marginBottom:4,background:active?"var(--bg3)":"transparent",
                    border:`1px solid ${active?"var(--gold-dim)":"transparent"}`,transition:"all 0.15s"}}>
                  <div style={{fontSize:14,color:"var(--text)",fontFamily:"var(--font-display)",width:110,fontStyle:"italic"}}>
                    {fmtDate(rp.reportDate)}
                  </div>
                  <RegimeBadge regime={rp.macroRegime?.quadrant||rp.marketRegime} size="sm"/>
                  <div style={{fontSize:16,color:"var(--text3)",flex:1,fontFamily:"var(--font-body)"}}>
                    {rp.businessCycle?.phase?.replace(/_/g," ")||rp.cyclePhase}
                  </div>
                  {rp.tailRisk&&<span style={{fontSize:15,color:tailC,fontFamily:"var(--font-data)",
                    background:tailC+"15",border:`1px solid ${tailC}30`,borderRadius:3,padding:"1px 7px"}}>
                    TAIL {rp.tailRisk.compositeScore}</span>}
                  {rp.recommendation?.primarySector&&<div style={{fontSize:16,color:"var(--gold)",fontFamily:"var(--font-data)",fontWeight:500}}>
                    ↑ {rp.recommendation.primarySector.ticker}</div>}
                  <div style={{fontSize:16,color:"var(--border2)"}}>›</div>
                </div>
              );
            })
        }
      </Card>
      {reports.length>0&&<div className="grid-2even" style={{marginTop:12}}>
        <div style={{fontSize:16,color:"var(--text3)",fontFamily:"var(--font-data)"}}>{reports.length} report{reports.length!==1?"s":""} in archive</div>
        <button onClick={clearHistory} style={{background:"none",border:"1px solid var(--red2)",color:"var(--red)",
          borderRadius:4,padding:"5px 14px",fontSize:15,fontFamily:"var(--font-data)",cursor:"pointer",letterSpacing:"0.08em"}}>
          CLEAR ARCHIVE
        </button>
      </div>}
    </div>
  );

  // ── DASHBOARD ───────────────────────────────────────────────────────────────
  const renderDashboard=()=>{
    if(!r) return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:460,gap:20}}>
        <BBLogo size={64}/>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:28,fontFamily:"var(--font-display)",fontStyle:"italic",color:"var(--text)",marginBottom:8}}>
            BlackBridge Equity Research
          </div>
          <div style={{fontSize:15,color:"var(--text3)",fontFamily:"var(--font-body)",marginBottom:4}}>
            6-Layer Institutional Market Analysis
          </div>
          <div style={{fontSize:16,color:"var(--text3)",fontFamily:"var(--font-data)"}}>
            Bridgewater · AQR · BlackRock · Goldman Sachs · Fidelity
          </div>
        </div>
        <div style={{width:160,height:1,background:"linear-gradient(90deg,transparent,var(--gold),transparent)"}}/>
        <div style={{fontSize:16,color:"var(--text3)",fontFamily:"var(--font-data)"}}>
          Click ▶ RUN ANALYSIS to begin
        </div>
      </div>
    );

    return (
      <div style={{animation:"fadeUp 0.4s ease"}}>
        {/* ── Header row */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{fontFamily:"var(--font-display)",fontStyle:"italic",fontSize:26,color:"var(--text)"}}>
              {fmtDate(r.reportDate)}
            </div>
            <RegimeBadge regime={r.macroRegime?.quadrant||r.marketRegime}/>
            <span style={{fontSize:16,color:"var(--text3)",fontFamily:"var(--font-body)"}}>
              {r.businessCycle?.phase?.replace(/_/g," ")||r.cyclePhase}
            </span>
            {r.tailRisk && <span style={{fontSize:15,color:TAIL_COLORS[r.tailRisk.regime]||"var(--text3)",
              fontFamily:"var(--font-data)",background:TAIL_COLORS[r.tailRisk.regime]+"18",
              border:`1px solid ${TAIL_COLORS[r.tailRisk.regime]}30`,borderRadius:3,padding:"1px 8px"}}>
              TAIL {r.tailRisk.compositeScore}
            </span>}
          </div>
          <div style={{fontSize:16,color:"var(--text3)",fontFamily:"var(--font-data)"}}>{r.reportTime}</div>
        </div>

        {/* ── Macro strip */}
        <div style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,
          padding:"12px 16px",marginBottom:16,overflowX:"auto"}}>
          <div style={{display:"flex",gap:8,minWidth:"fit-content"}}>
            <MacroTile label="S&P 500"     value={m.spx}          sub={m.spxChange} trend={m.spxChange}/>
            <MacroTile label="VIX"         value={m.vix}          sub={r.creditLiquidity?.vixTermStructure}/>
            <MacroTile label="MOVE"        value={m.moveIndex}/>
            <MacroTile label="Fed Rate"    value={m.fedFundsRate}/>
            <MacroTile label="CPI"         value={m.cpi}          sub={m.corePCE?"PCE: "+m.corePCE:null}/>
            <MacroTile label="Real Rate"   value={m.realRate10Y}/>
            <MacroTile label="10Y Yield"   value={m.tenYearYield} sub={m.breakeven10Y?"BE: "+m.breakeven10Y:null}/>
            <MacroTile label="10Y–2Y"      value={m.yieldCurve10Y2Y} trend={m.yieldCurve10Y2Y}/>
            <MacroTile label="DXY"         value={m.dxy}          sub={m.dxyTrend} trend={m.dxyTrend}/>
            <MacroTile label="WTI"         value={m.wtiCrude}/>
            <MacroTile label="Gold"        value={m.goldPrice}/>
            <MacroTile label="Cu/Au"       value={m.copperGoldRatio}/>
            <MacroTile label="Unemployment" value={m.unemployment}/>
            <MacroTile label="GDP"         value={m.gdpGrowth}/>
          </div>
        </div>

        {/* ── Performance & Heatmap row */}
        {reports.length >= 2 && (
          <div className="grid-2col">
            <Card>
              <SectionLabel>S&P 500 Daily Performance vs Primary Sector Score</SectionLabel>
              <PerformanceChart reports={reports}/>
            </Card>
            <Card>
              <SectionLabel>Sector Score Heatmap · {reports.length} Reports</SectionLabel>
              <SectorHeatmap reports={reports}/>
            </Card>
          </div>
        )}

        {/* ── Three-layer overview */}
        <div className="grid-3col">
          <Card>
            <SectionLabel>L1 · Macro Regime</SectionLabel>
            <MacroQuadrantWidget mr={r.macroRegime}/>
          </Card>
          <Card>
            <SectionLabel>L2 · Business Cycle</SectionLabel>
            <InvestmentClockWidget bc={r.businessCycle}/>
          </Card>
          <Card>
            <SectionLabel>L3 · Credit & Liquidity</SectionLabel>
            <CreditPanel cl={r.creditLiquidity}/>
          </Card>
        </div>

        {/* ── Strategist note */}
        {rec.strategistNote && (
          <div style={{background:"var(--bg2)",border:"1px solid var(--gold-dim)",
            borderLeft:"3px solid var(--gold)",borderRadius:8,padding:"14px 20px",marginBottom:16}}>
            <div style={{fontSize:14,color:"var(--gold)",fontFamily:"var(--font-data)",letterSpacing:"0.14em",marginBottom:8}}>
              CHIEF STRATEGIST NOTE
            </div>
            <div style={{fontSize:14,fontFamily:"var(--font-display)",fontStyle:"italic",color:"var(--text2)",lineHeight:1.7}}>
              "{rec.strategistNote}"
            </div>
            <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap",alignItems:"center"}}>
              {rec.overallRiskLevel && <span style={{fontSize:15,
                color:{HIGH:"var(--red)",MEDIUM:"var(--amber)",LOW:"var(--green)"}[rec.overallRiskLevel]||"var(--platinum)",
                fontFamily:"var(--font-data)"}}>RISK LEVEL: {rec.overallRiskLevel}</span>}
              {rec.defensivePivot && <span style={{fontSize:15,color:"var(--red)",fontFamily:"var(--font-data)",
                background:"var(--bg3)",border:"1px solid var(--red2)",borderRadius:3,padding:"1px 7px"}}>⚠ DEFENSIVE PIVOT ACTIVE</span>}
            </div>
          </div>
        )}

        {/* ── Rec cards + sector board + sector detail */}
        <div className="grid-4col">
          <RecCard rec={rec.primarySector} primary={true}/>
          <RecCard rec={rec.secondarySector} primary={false}/>
          {/* Sector board */}
          <Card style={{padding:14}}>
            <SectionLabel>Sector Signals</SectionLabel>
            {(r.sectorAnalysis||[]).map((s,i)=>(
              <SectorRow key={i} s={s} onSelect={setSelectedSector} selected={selectedSector?.ticker===s.ticker}/>
            ))}
            {rec.avoidSectors?.length>0 && (
              <div style={{marginTop:10,borderTop:"1px solid var(--border)",paddingTop:8}}>
                <div style={{fontSize:14,color:"var(--red)",fontFamily:"var(--font-data)",marginBottom:5}}>AVOID</div>
                {rec.avoidSectors.map((av,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
                    <span style={{fontSize:16,color:"var(--red)",fontFamily:"var(--font-data)",fontWeight:500}}>{av.ticker||av}</span>
                    {av.reason && <span style={{fontSize:15,color:"var(--text3)",flex:1,marginLeft:8,lineHeight:1.3}}>{av.reason}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
          {/* Sector detail */}
          <Card style={{padding:14}}>
            <SectionLabel>Sector Detail</SectionLabel>
            <SectorDetailPanel s={selectedSector}/>
          </Card>
        </div>

        {/* ── Tail risk + News + Events */}
        <div className="grid-tail">
          <Card>
            <SectionLabel>L6 · Tail Risk</SectionLabel>
            <TailRiskWidget tailRisk={r.tailRisk}/>
          </Card>
          <Card>
            <SectionLabel>News Flow</SectionLabel>
            {(r.topNews||[]).map((n,i)=><NewsItem key={i} item={n}/>)}
          </Card>
          <Card>
            <SectionLabel>Economic Calendar</SectionLabel>
            {(r.economicEvents||[]).map((e,i)=><EventItem key={i} item={e}/>)}
          </Card>
        </div>

        {/* ── Macro sparklines trend row */}
        {reports.length >= 3 && (
          <Card>
            <SectionLabel>Macro Trend Sparklines · {reports.length} Reports</SectionLabel>
            <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
              <MacroSparkline reports={reports} field="vix" label="VIX" color="var(--red)"/>
              <MacroSparkline reports={reports} field="tenYearYield" label="10Y Yield" color="var(--amber)"/>
              <MacroSparkline reports={reports} field="dxy" label="DXY" color="var(--platinum)"/>
              <MacroSparkline reports={reports} field="wtiCrude" label="WTI Crude" color="var(--amber)"/>
              <MacroSparkline reports={reports} field="unemployment" label="Unemployment" color="var(--platinum)"/>
            </div>
          </Card>
        )}
      </div>
    );
  };

  // ── FULL RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={{background:"var(--bg)",minHeight:"100vh",color:"var(--text)"}}>
      <style>{BRAND}</style>

      {/* HEADER */}
      <div style={{borderBottom:"1px solid var(--border)",padding:"12px clamp(12px,3vw,28px)",display:"flex",
        alignItems:"center",justifyContent:"space-between",background:"var(--bg2)",
        position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <BBLogo size={34}/>
          <div>
            <div style={{fontSize:14,fontFamily:"var(--font-display)",fontWeight:600,color:"var(--text)",letterSpacing:"0.02em"}}>
              BlackBridge
              <span style={{fontSize:14,color:"var(--gold)",fontFamily:"var(--font-data)",fontWeight:400,
                letterSpacing:"0.12em",marginLeft:8,verticalAlign:"middle"}}>EQUITY RESEARCH</span>
            </div>
            <div className="bb-header-sub" style={{fontSize:14,color:"var(--text3)",fontFamily:"var(--font-data)",letterSpacing:"0.12em",
              textTransform:"uppercase",marginTop:1}}>
              Bridgewater · AQR · BlackRock · Goldman · 6-Layer Institutional Analysis
            </div>
          </div>
        </div>
        {/* Gold rule */}
        <div className="bb-header-rule" style={{flex:1,height:1,background:"linear-gradient(90deg,var(--border),var(--gold-dim),var(--border))",margin:"0 24px"}}/>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:5,overflow:"hidden"}}>
            {[["dashboard","Dashboard"],["archive","Archive"]].map(([id,label])=>(
              <button key={id} onClick={()=>{setTab(id);if(id==="archive")setSelectedDate(null);}}
                style={{padding:"6px 16px",fontSize:16,fontFamily:"var(--font-data)",fontWeight:500,
                  letterSpacing:"0.08em",textTransform:"uppercase",border:"none",cursor:"pointer",
                  background:tab===id?"var(--gold)":"transparent",
                  color:tab===id?"var(--bg)":"var(--text3)",transition:"all 0.15s"}}>
                {label}
              </button>
            ))}
          </div>
          <a className="bb-logout" href="/api/logout" style={{background:"none",border:"1px solid var(--border)",borderRadius:4,
            color:"var(--text3)",padding:"5px 12px",fontSize:15,fontFamily:"var(--font-data)",
            cursor:"pointer",textDecoration:"none",letterSpacing:"0.08em",transition:"border-color 0.15s"}}>
            LOG OUT
          </a>
          <button onClick={runAnalysis}
            style={{padding:"8px 20px",background:"var(--gold)",border:"none",borderRadius:5,
              color:"var(--bg)",fontSize:16,fontFamily:"var(--font-data)",fontWeight:700,
              letterSpacing:"0.1em",cursor:"pointer",transition:"background 0.15s"}}>
            ▶ RUN ANALYSIS
          </button>
        </div>
      </div>

      {/* STATUS BAR */}
      {(error||currentReport) && (
        <div className="bb-status-bar" style={{background:"var(--bg)",borderBottom:"1px solid var(--border)",
          padding:"6px 20px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          {error
            ? <span style={{fontSize:16,color:"var(--red)",fontFamily:"var(--font-data)"}}>⚠ {error}</span>
            : <>
                <span style={{width:5,height:5,borderRadius:"50%",background:"var(--green)",
                  display:"inline-block",boxShadow:"0 0 5px var(--green)"}}/>
                <span style={{fontSize:15,color:"var(--text3)",fontFamily:"var(--font-data)",letterSpacing:"0.06em"}}>
                  LAST ANALYSIS: {currentReport?`${fmtDate(currentReport.reportDate)} ${currentReport.reportTime||""}`:"—"}
                  {reports.length>1?` · ${reports.length} reports in archive`:""}
                </span>
                {selectedDate && (
                  <span style={{fontSize:15,color:"var(--amber)",fontFamily:"var(--font-data)"}}>
                    VIEWING: {fmtDate(selectedDate)} &nbsp;
                    <button onClick={()=>setSelectedDate(null)} style={{background:"none",border:"none",
                      color:"var(--amber)",cursor:"pointer",fontSize:15,fontFamily:"var(--font-data)"}}>
                      × LATEST
                    </button>
                  </span>
                )}
              </>
          }
        </div>
      )}

      {/* MAIN */}
      <div style={{padding:"clamp(12px,3vw,22px) clamp(12px,3vw,28px)",maxWidth:1600,margin:"0 auto"}}>
        {tab==="dashboard" && renderDashboard()}
        {tab==="archive"   && renderArchive()}
      </div>
    </div>
  );
}
