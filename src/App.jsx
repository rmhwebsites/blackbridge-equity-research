import { useState, useEffect } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STORAGE_KEY   = "bb_market_reports_v3";
const API_KEY_STORE = "bb_anthropic_key";

const REGIME_COLORS = {
  RISK_ON:"#22d3a8", RISK_OFF:"#f87171", TRANSITIONING:"#f59e0b", NEUTRAL:"#94a3b8",
  GOLDILOCKS:"#22d3a8", REFLATION:"#f59e0b", STAGFLATION:"#f87171", DEFLATION:"#64748b",
};
const CONF_COLORS = { HIGH:"#22d3a8", MEDIUM:"#f59e0b", LOW:"#f87171" };
const TAIL_COLORS  = { LOW:"#22d3a8", NORMAL:"#64748b", ELEVATED:"#f59e0b", HIGH:"#f97316", CRISIS:"#f87171" };
const SIGNAL_STYLE = {
  OVERWEIGHT:  { bg:"#052e1e", text:"#22d3a8" },
  NEUTRAL:     { bg:"#1e293b", text:"#94a3b8" },
  UNDERWEIGHT: { bg:"#2e0505", text:"#f87171" },
};

// ─── MASTER SYSTEM PROMPT (6-Layer Institutional Framework) ───────────────────
const SYSTEM_PROMPT = `You are the Chief Investment Strategist at a bulge bracket investment bank, leading an elite multi-disciplinary research team. You run a six-layer institutional top-down analysis cascading from global macro to specific S&P 500 sector recommendations using methodologies from Bridgewater, AQR, BlackRock, Goldman Sachs, Fidelity, and MSCI.

TODAY: ${new Date().toISOString().split("T")[0]}

═══ SIX-LAYER ANALYTICAL MANDATE ═══

LAYER 1 — MACRO REGIME (Bridgewater Growth/Inflation Quadrant + AQR 5-Factor):
Search for: ISM Manufacturing PMI, CFNAI, OECD CLI, Core CPI YoY, 10-year breakeven inflation, PPI, DXY, commodity index. Classify the QUADRANT: GOLDILOCKS (growth rising, inflation falling), REFLATION (both rising), STAGFLATION (growth falling, inflation rising), DEFLATION (both falling). Score growth momentum and inflation momentum each as RISING/FALLING/STABLE. Assess Dalio debt cycle phase.

LAYER 2 — BUSINESS CYCLE (Fidelity AART + Merrill Lynch Investment Clock):
Search for: yield curve shape (2s10s), ISM New Orders minus Inventories, unemployment trend, leading indicators. Classify cycle: EARLY_EXPANSION, MID_EXPANSION, LATE_EXPANSION, RECESSION. Map to investment clock position 1-12. Identify sector rotation implications using the Fidelity cycle model: Early=Discretionary/Financials/Industrials; Late=Energy/Staples/Healthcare; Recession=Staples/Healthcare/Utilities.

LAYER 3 — CREDIT & LIQUIDITY CONDITIONS:
Search for: High-yield OAS (ICE BofA HY Master II), investment-grade OAS, Chicago Fed NFCI, TED spread proxy/FRA-OIS, 10Y-2Y yield curve, VIX term structure. Rate credit regime: TIGHT(<300bps HY), NORMAL(300-450), ELEVATED(450-500), STRESS(500-700), CRISIS(>700). A HY OAS >500bps is historically the critical "red line." Chicago Fed NFCI above 0 = tighter than average.

LAYER 4 — FUNDAMENTAL FACTOR SCORING per sector (BlackRock/AQR/MSCI):
For each of the 11 GICS sector ETFs (XLK, XLV, XLF, XLY, XLP, XLE, XLI, XLB, XLRE, XLU, XLC), search for and assess six factors:
• MOMENTUM: 12-1 month total return (skip last month), trend vs 200-day MA
• VALUE: Forward P/E relative to 10-yr historical average; EV/EBITDA; P/B
• QUALITY: ROE, earnings stability, debt levels (high ROE + low debt = quality)
• EARNINGS_REVISION_BREADTH: Analyst upgrades minus downgrades / total, direction
• LOW_VOLATILITY: Realized 252-day volatility vs SPX average
• CARRY: Dividend yield + net buyback yield

Score each factor STRONG/MODERATE/WEAK/NEGATIVE. Composite sector score = 0.20×Momentum + 0.20×Value + 0.20×Quality + 0.20×ERB + 0.10×LowVol + 0.10×Carry. Output as numeric -2.0 to +2.0.

LAYER 5 — TECHNICAL MOMENTUM OVERLAYS:
For each sector ETF assess:
• Moving average trend: price vs 200-DMA, 50-DMA, golden/death cross status
• RSI(14): <30=oversold, 30-45=weak, 45-55=neutral, 55-70=bullish, >70=overbought
• MACD signal line cross (12,26,9): BULLISH/BEARISH/NEUTRAL
• Relative strength vs SPX: OUTPERFORMING/INLINE/UNDERPERFORMING
• Breadth: % constituents above 200-DMA

LAYER 6 — TAIL RISK & BLACK SWAN (Bridgewater/BIS/Taleb):
Search for and score EACH sub-category 0-100:
• VOLATILITY_STRESS: VIX level (>30=elevated, >40=high), VIX/VIX3M ratio (>1=backwardation=stress), MOVE index (>150=elevated)
• CREDIT_STRESS: HY OAS rate-of-change (widening fast = alert), IG OAS, CDS indices
• FUNDING_LIQUIDITY: FRA-OIS spread, cross-currency basis, repo stress
• SYSTEMIC_RISK: Cross-asset correlation spike, ECB CISS, SRISK
• MACRO_VULNERABILITY: BIS credit-to-GDP gap signals, debt service ratios
• GEOPOLITICAL_TAIL: GPR index, geopolitical events, rare disaster signals
Composite tail risk score 0-100. Calculate tail risk dampener = max(0.25, 1.0 - max(0, (score-50)/100)). Score >70 = defensive tilt. Score >85 = emergency defensive.
Check: Dalio depression gauge (rates at ZLB + credit > income growth), Soros reflexivity alert (price acceleration + breadth divergence), BIS early warning (credit-to-GDP gap >10pp).

═══ FINAL COMPOSITE SCORING ═══
For each sector:
StrategicView = 0.50×Layer1RegimeTilt + 0.50×Layer2CycleTilt
TacticalView  = 0.25×Layer3CreditSignal + 0.45×Layer4Fundamentals + 0.30×Layer5Technicals
BaseScore     = 0.40×StrategicView + 0.60×TacticalView
FinalScore    = BaseScore × TailRiskDampener

Scores: >+1.0=STRONG_OVERWEIGHT, +0.5 to 1.0=OVERWEIGHT, -0.5 to 0.5=NEUTRAL, -1.0 to -0.5=UNDERWEIGHT, <-1.0=STRONG_UNDERWEIGHT
Confidence = 1 - (std of layer signals for this sector)/2. Round to 2dp.

═══ OUTPUT INSTRUCTIONS ═══
Respond with ONLY a single valid JSON object. No markdown fences, no text before or after. Use EXACTLY this schema:

{
  "reportDate": "YYYY-MM-DD",
  "reportTime": "HH:MM UTC",
  "schemaVersion": "3.0",

  "macroRegime": {
    "quadrant": "GOLDILOCKS",
    "growthMomentum": "RISING",
    "inflationMomentum": "FALLING",
    "growthZScore": 0.8,
    "inflationZScore": -0.4,
    "regimeConfidence": 0.72,
    "dalioDebtCyclePhase": "Mid Expansion",
    "regimeNarrative": "2-sentence description of current macro regime and key drivers"
  },

  "marketRegime": "RISK_ON",
  "cyclePhase": "Mid Expansion",

  "businessCycle": {
    "phase": "MID_EXPANSION",
    "yieldCurveSignal": "FLAT",
    "outputGapDirection": "POSITIVE_RISING",
    "ismPMI": "51.6",
    "ismNewOrdersInventoriesDiff": "+4.2",
    "clockPosition": 9,
    "cycleNarrative": "2-sentence description of cycle positioning and key indicators"
  },

  "creditLiquidity": {
    "hyOAS": "XXX bps",
    "hyOASRegime": "NORMAL",
    "igOAS": "XXX bps",
    "nfci": "X.XX",
    "nfciRegime": "NORMAL",
    "yieldCurve10Y2Y": "+XX bps",
    "vixLevel": "XX.X",
    "vixTermStructure": "CONTANGO",
    "moveIndex": "XXX",
    "creditSignal": "RISK_ON",
    "liquidityNarrative": "2-sentence description"
  },

  "macroIndicators": {
    "fedFundsRate": "X.XX%",
    "cpi": "X.X% YoY",
    "corePCE": "X.X% YoY",
    "unemployment": "X.X%",
    "gdpGrowth": "X.X% annualized",
    "yieldCurve10Y2Y": "+XX bps",
    "tenYearYield": "X.XX%",
    "twoYearYield": "X.XX%",
    "dxy": "XXX.XX",
    "dxyTrend": "RISING",
    "wtiCrude": "$XX.XX",
    "goldPrice": "$X,XXX",
    "copperGoldRatio": "X.XX",
    "vix": "XX.X",
    "moveIndex": "XXX",
    "spx": "X,XXX.XX",
    "spxChange": "+X.XX%",
    "spxVs200dma": "+X.X%",
    "breakeven10Y": "X.X%",
    "realRate10Y": "+X.XX%"
  },

  "economicEvents": [
    { "event": "Name", "date": "YYYY-MM-DD", "impact": "HIGH", "actual": "X.X", "expected": "X.X", "prior": "X.X", "surprise": "BEAT", "marketImplication": "text", "affectedSectors": ["XLF","XLK"] }
  ],

  "topNews": [
    { "headline": "text", "source": "name", "sentiment": "BULLISH", "sectorImpact": ["XLK"], "macroRelevance": "HIGH", "regime": "RISK_ON", "impact": "text" }
  ],

  "sectorAnalysis": [
    {
      "ticker": "XLK",
      "name": "Technology",
      "compositeScore": 1.2,
      "signal": "OVERWEIGHT",
      "confidence": 0.78,
      "primaryDriver": "MOMENTUM",
      "layerScores": {
        "l1MacroRegime": 0.8,
        "l2CycleTilt": 0.6,
        "l3CreditLiq": 0.4,
        "l4Fundamentals": 0.9,
        "l5Technicals": 1.1
      },
      "factorScores": {
        "momentum": "STRONG",
        "momentum12m1": "+XX.X%",
        "value": "NEUTRAL",
        "fwdPERelative": "EXPENSIVE",
        "quality": "HIGH",
        "earningsRevisionBreadth": "+0.XX",
        "erbTrend": "IMPROVING",
        "lowVol": "MODERATE",
        "carry": "LOW",
        "technicalTrend": "ABOVE_200DMA",
        "rsi14": "XX",
        "macdSignal": "BULLISH",
        "relStrengthVsSPX": "OUTPERFORMING"
      },
      "cycleAlignment": "STRONG",
      "catalyst": "text",
      "risk": "text",
      "conflictingSignals": []
    }
  ],

  "tailRisk": {
    "compositeScore": 35,
    "regime": "NORMAL",
    "dampener": 1.0,
    "subScores": {
      "volatilityStress": 20,
      "creditStress": 35,
      "fundingLiquidity": 25,
      "systemicRisk": 30,
      "macroVulnerability": 40,
      "geopoliticalTail": 35
    },
    "vixTermStructure": "CONTANGO",
    "activeAlerts": [],
    "blackSwanChecklist": {
      "dalioDepressionGauge": "LOW",
      "bisEarlyWarning": "GREEN",
      "reflexivityAlert": false,
      "breadthDivergence": false,
      "creditGapWarning": false,
      "yieldCurveInversion": false
    },
    "tailNarrative": "2-sentence tail risk assessment"
  },

  "recommendation": {
    "primarySector": {
      "ticker": "XLK",
      "name": "Technology",
      "conviction": "HIGH",
      "compositeScore": 1.4,
      "thesis": "2-3 sentence investment thesis grounded in cycle and factor analysis",
      "timeHorizon": "4-6 weeks",
      "entryRationale": "Specific entry reason",
      "catalysts": ["catalyst 1", "catalyst 2"],
      "keyRisks": ["risk 1", "risk 2"]
    },
    "secondarySector": {
      "ticker": "XLF",
      "name": "Financials",
      "conviction": "MEDIUM",
      "compositeScore": 0.8,
      "thesis": "2-3 sentence thesis",
      "timeHorizon": "4-8 weeks",
      "entryRationale": "Entry rationale",
      "catalysts": ["catalyst 1"],
      "keyRisks": ["risk 1"]
    },
    "avoidSectors": [
      { "ticker": "XLU", "reason": "Late-cycle proxy, expensive vs history" }
    ],
    "defensivePivot": false,
    "overallRiskLevel": "MEDIUM",
    "tailRiskAdjustment": "No dampener active - full conviction sizing",
    "strategistNote": "2-3 sentence overarching market narrative from the chief strategist"
  }
}`;

// ─── PARSE + STORAGE HELPERS ──────────────────────────────────────────────────
function parseReport(text) {
  const clean = text.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
  try { return JSON.parse(clean); } catch(_) {}
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error("Could not extract valid JSON from response");
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d+"T12:00:00Z").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}
function num(v,def="—") { return v!=null?v:def; }
function pct(v) { if(v==null) return "—"; const n=parseFloat(v); return isNaN(n)? String(v):`${n>0?"+":""}${n.toFixed(1)}%`; }
function scoreColor(s) {
  if(s==null) return "#64748b";
  if(s>=1.0) return "#22d3a8";
  if(s>=0.5) return "#4ade80";
  if(s>=-0.5) return "#94a3b8";
  if(s>=-1.0) return "#fb923c";
  return "#f87171";
}
function scoreBar(s) {
  // convert -2..+2 to 0..100%
  const pct = ((s+2)/4)*100;
  return Math.max(2, Math.min(98, pct));
}

// ─── MINI COMPONENTS ─────────────────────────────────────────────────────────
function Card({children, style={}}) {
  return <div style={{background:"#060f1a",border:"1px solid #0f2037",borderRadius:8,padding:16,...style}}>{children}</div>;
}
function CardTitle({children}) {
  return <div style={{fontSize:9,color:"#334155",letterSpacing:"0.14em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:12,paddingBottom:7,borderBottom:"1px solid #0d1a29"}}>{children}</div>;
}
function Badge({label, color="#94a3b8", small=false}) {
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,background:color+"18",border:`1px solid ${color}40`,borderRadius:3,padding:small?"1px 6px":"2px 9px",fontSize:small?9:10,color,fontFamily:"monospace",fontWeight:700,letterSpacing:"0.07em"}}>
      {label}
    </span>
  );
}
function RegimeBadge({regime}) {
  const c = REGIME_COLORS[regime]||"#94a3b8";
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,background:c+"18",border:`1px solid ${c}40`,borderRadius:4,padding:"3px 10px",fontSize:11,color:c,fontFamily:"monospace",fontWeight:700,letterSpacing:"0.08em"}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:c,boxShadow:`0 0 5px ${c}`}}/>
      {regime?.replace(/_/g," ")}
    </span>
  );
}
function MacroTile({label,value,sub,up=null}) {
  const vc = up===true?"#22d3a8":up===false?"#f87171":"#e2e8f0";
  return (
    <div style={{background:"#0a1628",borderRadius:6,padding:"9px 13px",minWidth:95,flexShrink:0}}>
      <div style={{fontSize:9,color:"#334155",letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:3}}>{label}</div>
      <div style={{fontSize:15,fontWeight:700,color:vc,fontFamily:"monospace"}}>{value||"—"}</div>
      {sub&&<div style={{fontSize:10,color:vc,fontFamily:"monospace",marginTop:1}}>{sub}</div>}
    </div>
  );
}
function FactorPill({label,value,signal}) {
  const c={STRONG:"#22d3a8",HIGH:"#22d3a8",OUTPERFORMING:"#22d3a8",BULLISH:"#22d3a8",ABOVE_200DMA:"#22d3a8",IMPROVING:"#22d3a8",
           MODERATE:"#f59e0b",NEUTRAL:"#f59e0b",INLINE:"#94a3b8",
           WEAK:"#f97316",EXPENSIVE:"#f97316",NEGATIVE:"#f87171",UNDERPERFORMING:"#f87171",
           BEARISH:"#f87171",BELOW_200DMA:"#f87171",LOW:"#f97316",DETERIORATING:"#f87171"}[signal]||"#64748b";
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid #0d1a29"}}>
      <div style={{fontSize:10,color:"#475569"}}>{label}</div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        {value&&<span style={{fontSize:9,color:"#334155",fontFamily:"monospace"}}>{value}</span>}
        <span style={{fontSize:9,color:c,fontFamily:"monospace",fontWeight:700}}>{signal||"—"}</span>
      </div>
    </div>
  );
}
function LayerBar({label,score}) {
  const c = scoreColor(score);
  const w = scoreBar(score);
  return (
    <div style={{marginBottom:5}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
        <span style={{fontSize:9,color:"#475569",fontFamily:"monospace"}}>{label}</span>
        <span style={{fontSize:9,color:c,fontFamily:"monospace",fontWeight:700}}>{score!=null?score.toFixed(2):"—"}</span>
      </div>
      <div style={{height:3,background:"#0a1628",borderRadius:2,overflow:"hidden"}}>
        <div style={{width:w+"%",height:"100%",background:c,borderRadius:2,transition:"width 0.3s"}}/>
      </div>
    </div>
  );
}
function ScoreMeter({score, size=36}) {
  const c = scoreColor(score);
  const label = score>=1?"S.OW":score>=0.5?"OW":score>-0.5?"N":score>-1?"UW":"S.UW";
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
      <div style={{width:size,height:size,borderRadius:"50%",border:`2px solid ${c}`,display:"flex",alignItems:"center",justifyContent:"center",background:c+"15"}}>
        <span style={{fontSize:size*0.22,color:c,fontFamily:"monospace",fontWeight:900}}>{label}</span>
      </div>
      <span style={{fontSize:9,color:c,fontFamily:"monospace"}}>{score!=null?score.toFixed(1):"—"}</span>
    </div>
  );
}

// ─── SECTOR ROW (enhanced) ────────────────────────────────────────────────────
function SectorRow({s, onSelect, selected}) {
  const ss = SIGNAL_STYLE[s.signal]||SIGNAL_STYLE.NEUTRAL;
  const sc = scoreColor(s.compositeScore);
  return (
    <div onClick={()=>onSelect(s)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px",borderBottom:"1px solid #0d1a29",cursor:"pointer",background:selected?"#0a1628":"transparent",borderRadius:4,transition:"background 0.1s"}}>
      <div style={{width:36,fontSize:10,color:"#64748b",fontFamily:"monospace"}}>{s.ticker}</div>
      <div style={{flex:1,fontSize:11,color:"#cbd5e1"}}>{s.name}</div>
      {/* mini score bar */}
      <div style={{width:50,height:4,background:"#0a1628",borderRadius:2,overflow:"hidden"}}>
        <div style={{width:scoreBar(s.compositeScore)+"%",height:"100%",background:sc,borderRadius:2}}/>
      </div>
      <div style={{width:28,textAlign:"right",fontSize:10,fontWeight:700,color:sc,fontFamily:"monospace"}}>{s.compositeScore!=null?s.compositeScore.toFixed(1):"—"}</div>
      <div style={{fontSize:9,fontWeight:700,color:ss.text,background:ss.bg,borderRadius:3,padding:"1px 5px",fontFamily:"monospace",minWidth:22,textAlign:"center"}}>
        {(s.signal||"N").replace("STRONG_OVERWEIGHT","S.OW").replace("OVERWEIGHT","OW").replace("UNDERWEIGHT","UW").replace("STRONG_UNDERWEIGHT","S.UW").replace("NEUTRAL","N")}
      </div>
    </div>
  );
}

// ─── SECTOR DETAIL PANEL ──────────────────────────────────────────────────────
function SectorDetailPanel({s}) {
  if(!s) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#1e3a5f",fontSize:11,fontFamily:"monospace"}}>Select a sector to see detail</div>
  );
  const f = s.factorScores||{};
  const ls = s.layerScores||{};
  const cc = scoreColor(s.compositeScore);
  return (
    <div style={{height:"100%",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:"#e2e8f0",letterSpacing:"-0.01em"}}>{s.name}</div>
          <div style={{fontSize:11,color:"#475569",fontFamily:"monospace"}}>{s.ticker}</div>
        </div>
        <ScoreMeter score={s.compositeScore} size={44}/>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {s.confidence!=null&&<Badge label={`${Math.round(s.confidence*100)}% CONF`} color={s.confidence>0.65?"#22d3a8":s.confidence>0.4?"#f59e0b":"#f87171"} small/>}
        {s.primaryDriver&&<Badge label={s.primaryDriver} color="#1d4ed8" small/>}
        {s.cycleAlignment&&<Badge label={`CYCLE: ${s.cycleAlignment}`} color={s.cycleAlignment==="STRONG"?"#22d3a8":s.cycleAlignment==="MODERATE"?"#f59e0b":"#f87171"} small/>}
      </div>
      {/* Layer scores */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:9,color:"#334155",letterSpacing:"0.12em",fontFamily:"monospace",marginBottom:8}}>LAYER SCORES</div>
        <LayerBar label="L1 Macro Regime" score={ls.l1MacroRegime}/>
        <LayerBar label="L2 Cycle Tilt" score={ls.l2CycleTilt}/>
        <LayerBar label="L3 Credit/Liq" score={ls.l3CreditLiq}/>
        <LayerBar label="L4 Fundamentals" score={ls.l4Fundamentals}/>
        <LayerBar label="L5 Technicals" score={ls.l5Technicals}/>
      </div>
      {/* Factor scores */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:9,color:"#334155",letterSpacing:"0.12em",fontFamily:"monospace",marginBottom:8}}>FACTOR SCORES</div>
        <FactorPill label="Momentum (12-1m)" value={f.momentum12m1} signal={f.momentum}/>
        <FactorPill label="Valuation (Fwd P/E)" value={f.fwdPERelative} signal={f.value}/>
        <FactorPill label="Quality (ROE/Debt)" signal={f.quality}/>
        <FactorPill label="Earnings Revisions" value={f.earningsRevisionBreadth} signal={f.erbTrend}/>
        <FactorPill label="Low Volatility" signal={f.lowVol}/>
        <FactorPill label="Carry / Yield" signal={f.carry}/>
        <FactorPill label="RSI(14)" value={f.rsi14} signal={parseFloat(f.rsi14)>70?"OVERBOUGHT":parseFloat(f.rsi14)<30?"OVERSOLD":parseFloat(f.rsi14)>55?"BULLISH":"NEUTRAL"}/>
        <FactorPill label="MACD Signal" signal={f.macdSignal}/>
        <FactorPill label="Price vs 200-DMA" signal={f.technicalTrend}/>
        <FactorPill label="Rel Strength vs SPX" signal={f.relStrengthVsSPX}/>
      </div>
      {/* Thesis */}
      {s.catalyst&&<div style={{marginBottom:8}}>
        <div style={{fontSize:9,color:"#334155",letterSpacing:"0.12em",fontFamily:"monospace",marginBottom:4}}>CATALYST</div>
        <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.5}}>{s.catalyst}</div>
      </div>}
      {s.risk&&<div>
        <div style={{fontSize:9,color:"#334155",letterSpacing:"0.12em",fontFamily:"monospace",marginBottom:4}}>KEY RISK</div>
        <div style={{fontSize:11,color:"#64748b",lineHeight:1.5}}>{s.risk}</div>
      </div>}
      {s.conflictingSignals?.length>0&&<div style={{marginTop:8,background:"#1a0505",borderRadius:4,padding:"6px 10px"}}>
        <div style={{fontSize:9,color:"#7f1d1d",fontFamily:"monospace",marginBottom:4}}>CONFLICTING SIGNALS</div>
        {s.conflictingSignals.map((cs,i)=><div key={i} style={{fontSize:10,color:"#f87171"}}>{cs}</div>)}
      </div>}
    </div>
  );
}

// ─── TAIL RISK PANEL ──────────────────────────────────────────────────────────
function TailRiskPanel({tailRisk}) {
  if(!tailRisk) return <Card><CardTitle>Tail Risk Monitor</CardTitle><div style={{color:"#1e3a5f",fontSize:11,fontFamily:"monospace"}}>No data</div></Card>;
  const sc = tailRisk.compositeScore||0;
  const c  = TAIL_COLORS[tailRisk.regime]||"#94a3b8";
  const ss = tailRisk.subScores||{};
  const bsc= tailRisk.blackSwanChecklist||{};
  const subKeys=[["volatilityStress","VOL STRESS"],["creditStress","CREDIT STRESS"],["fundingLiquidity","FUNDING LIQ"],["systemicRisk","SYSTEMIC"],["macroVulnerability","MACRO VULN"],["geopoliticalTail","GEO/TAIL"]];
  return (
    <Card>
      <CardTitle>Layer 6 — Tail Risk Monitor</CardTitle>
      {/* Composite */}
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
        <div style={{position:"relative",width:60,height:60,flexShrink:0}}>
          <svg viewBox="0 0 36 36" style={{width:"100%",height:"100%",transform:"rotate(-90deg)"}}>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0a1628" strokeWidth="3"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={c} strokeWidth="3"
              strokeDasharray={`${sc} ${100-sc}`} strokeLinecap="round"/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:13,fontWeight:900,color:c,fontFamily:"monospace"}}>{sc}</span>
            <span style={{fontSize:7,color:c,fontFamily:"monospace"}}>/ 100</span>
          </div>
        </div>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:c,fontFamily:"monospace",letterSpacing:"0.05em"}}>{tailRisk.regime}</div>
          <div style={{fontSize:10,color:"#64748b",marginTop:2}}>Dampener: <span style={{color:c,fontFamily:"monospace"}}>{tailRisk.dampener?.toFixed(2)||"1.00"}×</span></div>
          <div style={{fontSize:10,color:"#64748b"}}>VIX structure: <span style={{color:"#94a3b8",fontFamily:"monospace"}}>{tailRisk.vixTermStructure||"—"}</span></div>
        </div>
      </div>
      {/* Sub-scores */}
      <div style={{marginBottom:12}}>
        {subKeys.map(([k,label])=>{
          const v=ss[k]||0;
          const bc=v>=70?"#f87171":v>=50?"#f59e0b":"#334155";
          return (
            <div key={k} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:9,color:"#475569",fontFamily:"monospace"}}>{label}</span>
                <span style={{fontSize:9,color:bc,fontFamily:"monospace",fontWeight:700}}>{v}</span>
              </div>
              <div style={{height:3,background:"#0a1628",borderRadius:2,overflow:"hidden"}}>
                <div style={{width:v+"%",height:"100%",background:bc,borderRadius:2}}/>
              </div>
            </div>
          );
        })}
      </div>
      {/* Black swan checklist */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:9,color:"#334155",letterSpacing:"0.12em",fontFamily:"monospace",marginBottom:7}}>BLACK SWAN CHECKLIST</div>
        {[
          ["dalioDepressionGauge","Dalio Depression Gauge",bsc.dalioDepressionGauge==="LOW"?"✓":"⚠"],
          ["bisEarlyWarning","BIS Early Warning",bsc.bisEarlyWarning==="GREEN"?"✓":"⚠"],
          ["reflexivityAlert","Soros Reflexivity",!bsc.reflexivityAlert?"✓":"⚠"],
          ["breadthDivergence","Breadth Divergence",!bsc.breadthDivergence?"✓":"⚠"],
          ["creditGapWarning","Credit Gap (BIS >10pp)",!bsc.creditGapWarning?"✓":"⚠"],
          ["yieldCurveInversion","Yield Curve Inversion",!bsc.yieldCurveInversion?"✓":"⚠"],
        ].map(([k,label,icon])=>{
          const ok=icon==="✓";
          return <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid #0d1a29"}}>
            <span style={{fontSize:10,color:"#475569"}}>{label}</span>
            <span style={{fontSize:10,color:ok?"#22d3a8":"#f59e0b",fontFamily:"monospace"}}>{icon} {ok?"CLEAR":"ALERT"}</span>
          </div>;
        })}
      </div>
      {/* Active alerts */}
      {tailRisk.activeAlerts?.length>0&&<div style={{background:"#1a0a00",borderRadius:4,padding:"8px 10px"}}>
        <div style={{fontSize:9,color:"#7c3803",fontFamily:"monospace",marginBottom:4}}>ACTIVE ALERTS</div>
        {tailRisk.activeAlerts.map((a,i)=><div key={i} style={{fontSize:10,color:"#f97316",lineHeight:1.4}}>{a}</div>)}
      </div>}
      {tailRisk.tailNarrative&&<div style={{marginTop:10,fontSize:11,color:"#64748b",lineHeight:1.5,fontStyle:"italic"}}>{tailRisk.tailNarrative}</div>}
    </Card>
  );
}

// ─── MACRO QUADRANT WIDGET ────────────────────────────────────────────────────
function MacroQuadrant({macroRegime}) {
  if(!macroRegime) return null;
  const gz = macroRegime.growthZScore||0;
  const iz = macroRegime.inflationZScore||0;
  // dot position: x = inflation, y = -growth (because CSS y-axis is inverted)
  const dotX = ((iz+2)/4)*100;
  const dotY = ((gz+2)/4)*100;
  const qc   = REGIME_COLORS[macroRegime.quadrant]||"#94a3b8";
  return (
    <Card>
      <CardTitle>Layer 1 — Macro Regime · Bridgewater Quadrant</CardTitle>
      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        {/* quadrant plot */}
        <div style={{position:"relative",width:120,height:120,flexShrink:0,border:"1px solid #0f2037",borderRadius:6,overflow:"hidden",background:"#030d18"}}>
          {/* quadrant shading */}
          {[{x:0,y:0,label:"DEFL",c:"#94a3b820"},{x:50,y:0,label:"REFLAT",c:"#f59e0b18"},{x:0,y:50,label:"DEFLAT",c:"#64748b18"},{x:50,y:50,label:"GOLD",c:"#22d3a818"}].map(({x,y,label,c})=>(
            <div key={label} style={{position:"absolute",left:x+"%",top:y+"%",width:"50%",height:"50%",background:c,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:7,color:"#1e3a5f",fontFamily:"monospace"}}>{label}</span>
            </div>
          ))}
          {/* axes */}
          <div style={{position:"absolute",left:"50%",top:0,bottom:0,width:1,background:"#0f2037"}}/>
          <div style={{position:"absolute",top:"50%",left:0,right:0,height:1,background:"#0f2037"}}/>
          {/* dot - x=inflation, y inverted for growth */}
          <div style={{position:"absolute",left:`calc(${dotX}% - 6px)`,top:`calc(${100-dotY}% - 6px)`,width:12,height:12,borderRadius:"50%",background:qc,boxShadow:`0 0 8px ${qc}`,zIndex:10}}/>
          {/* axis labels */}
          <div style={{position:"absolute",bottom:2,left:"50%",transform:"translateX(-50%)",fontSize:6,color:"#1e3a5f",fontFamily:"monospace"}}>INFLATION →</div>
          <div style={{position:"absolute",left:2,top:"50%",transform:"translateY(-50%) rotate(-90deg)",fontSize:6,color:"#1e3a5f",fontFamily:"monospace",transformOrigin:"center"}}>GROWTH</div>
        </div>
        {/* regime details */}
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <RegimeBadge regime={macroRegime.quadrant}/>
            {macroRegime.regimeConfidence!=null&&<Badge label={`${Math.round(macroRegime.regimeConfidence*100)}% CONF`} color={macroRegime.regimeConfidence>0.6?"#22d3a8":"#f59e0b"} small/>}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:6}}>
            <div style={{fontSize:10,color:"#475569"}}>Growth: <span style={{color:{RISING:"#22d3a8",FALLING:"#f87171",STABLE:"#94a3b8"}[macroRegime.growthMomentum]||"#94a3b8",fontFamily:"monospace",fontWeight:700}}>{macroRegime.growthMomentum||"—"}</span></div>
            <div style={{fontSize:10,color:"#475569"}}>Inflation: <span style={{color:{RISING:"#f87171",FALLING:"#22d3a8",STABLE:"#94a3b8"}[macroRegime.inflationMomentum]||"#94a3b8",fontFamily:"monospace",fontWeight:700}}>{macroRegime.inflationMomentum||"—"}</span></div>
          </div>
          <div style={{fontSize:10,color:"#475569",marginBottom:4}}>Dalio Cycle: <span style={{color:"#94a3b8"}}>{macroRegime.dalioDebtCyclePhase||"—"}</span></div>
          {macroRegime.regimeNarrative&&<div style={{fontSize:11,color:"#64748b",lineHeight:1.5}}>{macroRegime.regimeNarrative}</div>}
        </div>
      </div>
    </Card>
  );
}

// ─── INVESTMENT CLOCK WIDGET ──────────────────────────────────────────────────
function InvestmentClock({businessCycle}) {
  if(!businessCycle) return null;
  const pos   = businessCycle.clockPosition||9;
  const angle = ((pos-3)/12)*360; // 3 o'clock = 0deg, 12 o'clock = 270deg
  const rad   = (angle-90)*(Math.PI/180);
  const cx=50,cy=50,r=35;
  const hx = cx + r*Math.cos(rad);
  const hy = cy + r*Math.sin(rad);
  const phases=[{label:"RECOVERY",pos:7.5},{label:"EXPANSION",pos:10.5},{label:"SLOWDOWN",pos:1.5},{label:"CONTRACTION",pos:4.5}];
  return (
    <Card>
      <CardTitle>Layer 2 — Business Cycle · Investment Clock</CardTitle>
      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        <div style={{width:110,height:110,flexShrink:0,position:"relative"}}>
          <svg viewBox="0 0 100 100" style={{width:"100%",height:"100%"}}>
            {/* Quadrant arcs */}
            {[{d:"M50,50 L50,10 A40,40 0 0,1 90,50 Z",c:"#22d3a818",l:"EARLY",lx:72,ly:28},
              {d:"M50,50 L90,50 A40,40 0 0,1 50,90 Z",c:"#f59e0b18",l:"LATE",lx:72,ly:72},
              {d:"M50,50 L50,90 A40,40 0 0,1 10,50 Z",c:"#f87171 18",l:"RECESS",lx:16,ly:72},
              {d:"M50,50 L10,50 A40,40 0 0,1 50,10 Z",c:"#64748b18",l:"RECOV",lx:20,ly:28}
            ].map(({d,c,l,lx,ly})=>(
              <g key={l}><path d={d} fill={c}/><text x={lx} y={ly} textAnchor="middle" fill="#1e3a5f" fontSize="5" fontFamily="monospace">{l}</text></g>
            ))}
            <circle cx="50" cy="50" r="40" fill="none" stroke="#0f2037" strokeWidth="1"/>
            <circle cx="50" cy="50" r="3" fill="#334155"/>
            {/* Hour marks */}
            {Array.from({length:12},(_,i)=>{
              const a=(i/12)*360; const ar=(a-90)*Math.PI/180;
              return <line key={i} x1={50+33*Math.cos(ar)} y1={50+33*Math.sin(ar)} x2={50+38*Math.cos(ar)} y2={50+38*Math.sin(ar)} stroke="#0f2037" strokeWidth="0.8"/>;
            })}
            {/* Hand */}
            <line x1="50" y1="50" x2={hx} y2={hy} stroke="#22d3a8" strokeWidth="2" strokeLinecap="round"/>
            <circle cx={hx} cy={hy} r="3" fill="#22d3a8" style={{filter:"drop-shadow(0 0 4px #22d3a8)"}}/>
            {/* Position label */}
            <text x="50" y="53" textAnchor="middle" fill="#22d3a8" fontSize="6" fontFamily="monospace">{pos}:00</text>
          </svg>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:4}}>{businessCycle.phase?.replace(/_/g," ")||"—"}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
            <Badge label={`YIELD CURVE: ${businessCycle.yieldCurveSignal||"—"}`} color={businessCycle.yieldCurveSignal==="STEEPENING"?"#22d3a8":businessCycle.yieldCurveSignal==="INVERTED"?"#f87171":"#f59e0b"} small/>
            {businessCycle.ismPMI&&<Badge label={`PMI: ${businessCycle.ismPMI}`} color={parseFloat(businessCycle.ismPMI)>50?"#22d3a8":"#f87171"} small/>}
          </div>
          {businessCycle.ismNewOrdersInventoriesDiff&&<div style={{fontSize:10,color:"#475569",marginBottom:4}}>New Orders − Inventories: <span style={{color:parseFloat(businessCycle.ismNewOrdersInventoriesDiff)>0?"#22d3a8":"#f87171",fontFamily:"monospace",fontWeight:700}}>{businessCycle.ismNewOrdersInventoriesDiff}</span></div>}
          {businessCycle.cycleNarrative&&<div style={{fontSize:11,color:"#64748b",lineHeight:1.5}}>{businessCycle.cycleNarrative}</div>}
        </div>
      </div>
    </Card>
  );
}

// ─── CREDIT & LIQUIDITY PANEL ─────────────────────────────────────────────────
function CreditLiquidityPanel({cl}) {
  if(!cl) return null;
  const hyN = parseInt(cl.hyOAS)||0;
  const hyC = hyN>700?"#f87171":hyN>500?"#f97316":hyN>450?"#f59e0b":hyN>300?"#94a3b8":"#22d3a8";
  return (
    <Card>
      <CardTitle>Layer 3 — Credit & Liquidity</CardTitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        {[
          {label:"HY OAS",value:cl.hyOAS,color:hyC,sub:cl.hyOASRegime},
          {label:"IG OAS",value:cl.igOAS,color:"#94a3b8"},
          {label:"NFCI",value:cl.nfci,color:parseFloat(cl.nfci)>0?"#f59e0b":"#22d3a8",sub:cl.nfciRegime},
          {label:"MOVE Index",value:cl.moveIndex,color:parseInt(cl.moveIndex)>150?"#f87171":"#94a3b8"},
        ].map(({label,value,color,sub})=>(
          <div key={label} style={{background:"#0a1628",borderRadius:5,padding:"8px 10px"}}>
            <div style={{fontSize:9,color:"#334155",letterSpacing:"0.1em",fontFamily:"monospace",textTransform:"uppercase",marginBottom:2}}>{label}</div>
            <div style={{fontSize:14,fontWeight:700,color:color||"#e2e8f0",fontFamily:"monospace"}}>{value||"—"}</div>
            {sub&&<div style={{fontSize:9,color:color,fontFamily:"monospace",marginTop:1}}>{sub}</div>}
          </div>
        ))}
      </div>
      {/* HY OAS threshold bar */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:9,color:"#334155",fontFamily:"monospace",marginBottom:4}}>HY OAS REGIME THRESHOLDS</div>
        <div style={{display:"flex",height:6,borderRadius:3,overflow:"hidden",gap:1}}>
          {[{label:"TIGHT",w:20,c:"#22d3a8"},{label:"NORMAL",w:30,c:"#4ade80"},{label:"ELEV",w:15,c:"#f59e0b"},{label:"STRESS",w:20,c:"#f97316"},{label:"CRISIS",w:15,c:"#f87171"}].map(({label,w,c})=>(
            <div key={label} style={{flex:w,background:c,opacity:cl.hyOASRegime===label.split(" ")[0]||cl.hyOASRegime===label?1:0.25,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:6,color:"#020b14",fontFamily:"monospace",fontWeight:700}}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
          {["<300","450","500","700","700+"].map(v=><span key={v} style={{fontSize:8,color:"#1e3a5f",fontFamily:"monospace"}}>{v}</span>)}
        </div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
        <Badge label={`CREDIT SIGNAL: ${cl.creditSignal||"—"}`} color={REGIME_COLORS[cl.creditSignal]||"#94a3b8"} small/>
        <Badge label={`VIX: ${cl.vixTermStructure||"—"}`} color={cl.vixTermStructure==="BACKWARDATION"?"#f87171":"#22d3a8"} small/>
      </div>
      {cl.liquidityNarrative&&<div style={{fontSize:11,color:"#64748b",lineHeight:1.5,fontStyle:"italic"}}>{cl.liquidityNarrative}</div>}
    </Card>
  );
}

// ─── REC CARD (enhanced) ─────────────────────────────────────────────────────
function RecCard({rec, primary}) {
  if(!rec) return null;
  const cc=CONF_COLORS[rec.conviction]||"#94a3b8";
  const sc=scoreColor(rec.compositeScore);
  return (
    <div style={{background:primary?"#08142a":"#060f1a",border:`1px solid ${primary?"#1a3566":"#0f2037"}`,borderRadius:8,padding:18,position:"relative",overflow:"hidden"}}>
      {primary&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#1d4ed8,#22d3a8)"}}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{fontSize:9,color:"#334155",letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:4}}>{primary?"PRIMARY OVERWEIGHT":"SECONDARY OVERWEIGHT"}</div>
          <div style={{fontSize:20,fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.02em"}}>{rec.name}</div>
          <div style={{fontSize:12,color:"#475569",fontFamily:"monospace"}}>{rec.ticker}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
          <ScoreMeter score={rec.compositeScore} size={38}/>
          <Badge label={`${rec.conviction} CONV`} color={cc} small/>
        </div>
      </div>
      <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.65,marginBottom:10}}>{rec.thesis}</div>
      {/* Catalysts */}
      {rec.catalysts?.length>0&&<div style={{marginBottom:8}}>
        <div style={{fontSize:9,color:"#22d3a8",fontFamily:"monospace",marginBottom:4}}>▲ CATALYSTS</div>
        {rec.catalysts.map((c,i)=><div key={i} style={{fontSize:10,color:"#64748b",marginBottom:2}}>• {c}</div>)}
      </div>}
      {/* Risks */}
      {rec.keyRisks?.length>0&&<div style={{marginBottom:10}}>
        <div style={{fontSize:9,color:"#f87171",fontFamily:"monospace",marginBottom:4}}>▼ KEY RISKS</div>
        {rec.keyRisks.map((r,i)=><div key={i} style={{fontSize:10,color:"#64748b",marginBottom:2}}>• {r}</div>)}
      </div>}
      <div style={{background:"#0a1628",borderRadius:4,padding:"7px 12px",fontSize:11,color:"#64748b",borderLeft:`2px solid ${cc}`}}>
        <span style={{color:cc,fontWeight:700}}>ENTRY: </span>{rec.entryRationale}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
        <Badge label={`HORIZON: ${rec.timeHorizon}`} color="#1d4ed8" small/>
      </div>
    </div>
  );
}

// ─── NEWS + EVENTS ────────────────────────────────────────────────────────────
function NewsItem({item}) {
  const c=item.sentiment==="BULLISH"?"#22d3a8":item.sentiment==="BEARISH"?"#f87171":"#94a3b8";
  const mr=item.macroRelevance;
  return (
    <div style={{padding:"9px 0",borderBottom:"1px solid #0d1a29",display:"flex",gap:10}}>
      <div style={{width:3,background:c,borderRadius:2,flexShrink:0}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:12,color:"#e2e8f0",lineHeight:1.5,marginBottom:3}}>{item.headline}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:10,color:"#475569"}}>{item.source}</span>
          {item.sectorImpact?.slice(0,3).map(t=><span key={t} style={{fontSize:9,color:"#334155",fontFamily:"monospace",background:"#0a1628",borderRadius:2,padding:"0 4px"}}>{t}</span>)}
          <span style={{fontSize:9,color:c,fontFamily:"monospace",fontWeight:700}}>{item.sentiment}</span>
          {mr==="HIGH"&&<span style={{fontSize:9,color:"#f59e0b",fontFamily:"monospace"}}>MACRO-HIGH</span>}
        </div>
        {item.impact&&<div style={{fontSize:11,color:"#64748b",marginTop:2,lineHeight:1.4}}>{item.impact}</div>}
      </div>
    </div>
  );
}
function EventItem({item}) {
  const ic={HIGH:"#f87171",MEDIUM:"#f59e0b",LOW:"#22d3a8"}[item.impact]||"#94a3b8";
  const surpriseC=item.surprise==="BEAT"?"#22d3a8":item.surprise==="MISS"?"#f87171":"#94a3b8";
  return (
    <div style={{padding:"8px 0",borderBottom:"1px solid #0d1a29",display:"flex",gap:10}}>
      <div style={{width:8,height:8,borderRadius:"50%",background:ic,marginTop:4,flexShrink:0,boxShadow:`0 0 5px ${ic}80`}}/>
      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
          <div style={{fontSize:12,color:"#e2e8f0",fontWeight:500}}>{item.event}</div>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            {item.surprise&&<span style={{fontSize:9,color:surpriseC,fontFamily:"monospace",fontWeight:700}}>{item.surprise}</span>}
            <span style={{fontSize:10,color:"#475569",fontFamily:"monospace"}}>{item.date}</span>
          </div>
        </div>
        {(item.actual||item.expected||item.prior)&&<div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace",marginTop:2}}>
          {item.actual&&`A: ${item.actual}`}{item.expected&&` · E: ${item.expected}`}{item.prior&&` · P: ${item.prior}`}
        </div>}
        {item.marketImplication&&<div style={{fontSize:11,color:"#64748b",marginTop:2,lineHeight:1.4}}>{item.marketImplication}</div>}
      </div>
    </div>
  );
}

// ─── TREND CHART ──────────────────────────────────────────────────────────────
function TrendChart({reports}) {
  const last8=[...reports].slice(-8);
  return (
    <div>
      <div style={{fontSize:9,color:"#334155",letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:10}}>SECTOR ROTATION HISTORY ({last8.length} REPORTS)</div>
      <div style={{display:"flex",gap:5}}>
        {last8.map((rp,i)=>{
          const q=rp.macroRegime?.quadrant||rp.marketRegime;
          const c=REGIME_COLORS[q]||"#94a3b8";
          const ts=rp.tailRisk?.compositeScore||0;
          const tc=TAIL_COLORS[rp.tailRisk?.regime]||"#64748b";
          return (
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
              <div style={{width:"100%",height:46,background:c+"18",border:`1px solid ${c}30`,borderRadius:5,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
                <span style={{fontSize:11,color:c,fontFamily:"monospace",fontWeight:700}}>{rp.recommendation?.primarySector?.ticker||"—"}</span>
                <span style={{fontSize:8,color:c+"80",fontFamily:"monospace"}}>{rp.recommendation?.secondarySector?.ticker||""}</span>
              </div>
              {/* tail risk mini */}
              <div style={{width:"100%",height:3,background:"#0a1628",borderRadius:1,overflow:"hidden"}}>
                <div style={{width:ts+"%",height:"100%",background:tc,borderRadius:1}}/>
              </div>
              <div style={{width:6,height:6,borderRadius:"50%",background:c}}/>
              <div style={{fontSize:8,color:"#334155",fontFamily:"monospace"}}>
                {new Date(rp.reportDate+"T12:00:00Z").toLocaleDateString("en-US",{month:"numeric",day:"numeric"})}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        <span style={{fontSize:8,color:"#1e3a5f",fontFamily:"monospace"}}>← OLDER</span>
        <span style={{fontSize:8,color:"#1e3a5f",fontFamily:"monospace"}}>LATEST →</span>
      </div>
    </div>
  );
}

// ─── API KEY GATE ─────────────────────────────────────────────────────────────
function ApiKeyGate({onSave}) {
  const [val,setVal]=useState("");
  return (
    <div style={{minHeight:"100vh",background:"#020b14",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:440,background:"#060f1a",border:"1px solid #0f2037",borderRadius:10,padding:36}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28}}>
          <div style={{width:36,height:36,background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff",fontFamily:"monospace"}}>BB</div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",letterSpacing:"0.05em",fontFamily:"monospace"}}>BLACKBRIDGE RESEARCH</div>
            <div style={{fontSize:10,color:"#334155",letterSpacing:"0.1em",fontFamily:"monospace"}}>6-LAYER INSTITUTIONAL MARKET ANALYSIS</div>
          </div>
        </div>
        <p style={{fontSize:12,color:"#64748b",lineHeight:1.7,marginBottom:20}}>Enter your Anthropic API key to power the daily institutional-grade market analysis agent (Bridgewater · AQR · BlackRock · Goldman frameworks). Stored only in your browser.</p>
        <div style={{fontSize:10,color:"#334155",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:8}}>ANTHROPIC API KEY</div>
        <input type="password" value={val} onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&val&&onSave(val.trim())}
          placeholder="sk-ant-..."
          style={{width:"100%",background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:5,padding:"10px 14px",color:"#e2e8f0",fontSize:13,fontFamily:"monospace",outline:"none",marginBottom:16,boxSizing:"border-box"}}/>
        <button onClick={()=>val.trim()&&onSave(val.trim())}
          style={{width:"100%",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:5,color:"#fff",padding:"10px",fontSize:12,fontFamily:"monospace",fontWeight:700,letterSpacing:"0.08em",cursor:"pointer"}}>
          ENTER DASHBOARD →
        </button>
        <div style={{marginTop:14,fontSize:10,color:"#1e3a5f",textAlign:"center"}}>
          Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{color:"#1d4ed8"}}>console.anthropic.com</a>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [apiKey,setApiKey]=useState(()=>localStorage.getItem(API_KEY_STORE)||"");
  const [reports,setReports]=useState([]);
  const [currentReport,setCurrentReport]=useState(null);
  const [loading,setLoading]=useState(false);
  const [loadingStep,setLoadingStep]=useState("");
  const [error,setError]=useState(null);
  const [tab,setTab]=useState("dashboard");
  const [selectedDate,setSelectedDate]=useState(null);
  const [selectedSector,setSelectedSector]=useState(null);

  useEffect(()=>{
    try {
      const s=localStorage.getItem(STORAGE_KEY);
      if(s){ const a=JSON.parse(s); setReports(a); if(a.length) setCurrentReport(a[a.length-1]); }
    } catch(_){}
  },[]);

  const saveReports=(arr)=>{ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(arr));}catch(_){} setReports(arr); };
  const handleSaveKey=(k)=>{ localStorage.setItem(API_KEY_STORE,k); setApiKey(k); };

  if(!apiKey) return <ApiKeyGate onSave={handleSaveKey}/>;

  const runAnalysis=async()=>{
    setLoading(true); setError(null); setTab("dashboard"); setSelectedDate(null); setSelectedSector(null);
    const STEPS=["🔍 L1: Scanning macro regime (Bridgewater quadrant)…","📊 L2: Mapping business cycle (Investment Clock)…","💳 L3: Assessing credit & liquidity conditions…","📈 L4: Scoring 11 sectors on 6 factors (AQR/BlackRock)…","🕯 L5: Running technical momentum overlays…","🛡 L6: Computing tail risk & black swan indicators…","⚖️ Applying composite scoring & dampener…","💼 Generating institutional sector recommendation…"];
    let si=0; setLoadingStep(STEPS[0]);
    const timer=setInterval(()=>{ si++; if(si<STEPS.length) setLoadingStep(STEPS[si]); },2500);
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({
          model:"claude-sonnet-4-5",
          max_tokens:6000,
          system:SYSTEM_PROMPT,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{role:"user",content:`Today is ${new Date().toISOString().split("T")[0]}. Execute the full six-layer institutional market analysis. Use web search extensively to retrieve all current data for every layer. Score all 11 S&P 500 sector ETFs individually. Output ONLY the JSON report object — no text before or after.`}]
        })
      });
      clearInterval(timer); setLoadingStep("✅ Processing institutional report…");
      const data=await res.json();
      if(!res.ok) throw new Error(data.error?.message||`API error ${res.status}`);
      const texts=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
      if(!texts) throw new Error("No text content returned from API");
      const report=parseReport(texts);
      const updated=[...reports.filter(r=>r.reportDate!==report.reportDate),report];
      saveReports(updated); setCurrentReport(report);
    } catch(err) {
      clearInterval(timer);
      setError(err.message||"Analysis failed. Check API key and try again.");
    } finally { setLoading(false); setLoadingStep(""); }
  };

  const displayReport=selectedDate?reports.find(r=>r.reportDate===selectedDate):currentReport;
  const clearHistory=()=>{ if(window.confirm("Clear all saved reports?")){ saveReports([]); setCurrentReport(null); setSelectedDate(null); }};

  // ── LOADING SCREEN ─────────────────────────────────────────────────────────
  if(loading) return (
    <div style={{minHeight:"100vh",background:"#020b14",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:52,height:52,border:"2px solid #0f2037",borderTop:"2px solid #1d4ed8",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:13,color:"#e2e8f0",fontFamily:"monospace",fontWeight:700,letterSpacing:"0.06em",marginBottom:8}}>RUNNING 6-LAYER INSTITUTIONAL ANALYSIS</div>
        <div style={{fontSize:12,color:"#22d3a8",fontFamily:"monospace"}}>{loadingStep}</div>
      </div>
      <div style={{background:"#060f1a",border:"1px solid #0f2037",borderRadius:8,padding:"14px 24px",minWidth:360}}>
        {["L1: Macro Regime Detection","L2: Business Cycle Mapping","L3: Credit & Liquidity Scan","L4: Fundamental Factor Scoring","L5: Technical Momentum Overlays","L6: Tail Risk & Black Swan"].map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"4px 0"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#0f2037"}}/>
            <div style={{fontSize:11,color:"#334155",fontFamily:"monospace"}}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const r=displayReport;
  const m=r?.macroIndicators||{};
  const rec=r?.recommendation||{};

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  const renderDashboard=()=>{
    if(!r) return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:420,gap:14}}>
        <div style={{fontSize:56,opacity:0.15,color:"#22d3a8"}}>◈</div>
        <div style={{fontSize:13,color:"#1e3a5f",fontFamily:"monospace",textAlign:"center",lineHeight:1.8}}>NO REPORTS YET<br/><span style={{fontSize:11,color:"#0f2037"}}>Click ▶ RUN ANALYSIS for a full 6-layer institutional scan</span></div>
      </div>
    );

    return (
      <div>
        {/* ── ROW 0: Date/Regime header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:22,fontStyle:"italic",color:"#e2e8f0"}}>{fmtDate(r.reportDate)}</div>
            <RegimeBadge regime={r.macroRegime?.quadrant||r.marketRegime}/>
            <span style={{fontSize:11,color:"#475569",fontFamily:"monospace"}}>{r.businessCycle?.phase?.replace(/_/g," ")||r.cyclePhase}</span>
            {r.tailRisk&&<Badge label={`TAIL: ${r.tailRisk.regime} (${r.tailRisk.compositeScore})`} color={TAIL_COLORS[r.tailRisk.regime]||"#94a3b8"} small/>}
          </div>
          <div style={{fontSize:11,color:"#334155",fontFamily:"monospace"}}>{r.reportTime} · v{r.schemaVersion||"3.0"}</div>
        </div>

        {/* ── ROW 1: Macro strip */}
        <div style={{background:"#060f1a",border:"1px solid #0f2037",borderRadius:8,padding:"10px 14px",marginBottom:14,overflowX:"auto"}}>
          <div style={{display:"flex",gap:8,minWidth:"fit-content"}}>
            <MacroTile label="S&P 500" value={m.spx} sub={m.spxChange} up={m.spxChange?.startsWith("+")}/>
            <MacroTile label="VIX" value={m.vix} sub={m.moveIndex?"MOVE:"+m.moveIndex:null}/>
            <MacroTile label="Fed Rate" value={m.fedFundsRate}/>
            <MacroTile label="CPI" value={m.cpi} sub={m.corePCE?"PCE:"+m.corePCE:null}/>
            <MacroTile label="Real Rate" value={m.realRate10Y}/>
            <MacroTile label="10Y Yield" value={m.tenYearYield} sub={m.breakeven10Y?"BE:"+m.breakeven10Y:null}/>
            <MacroTile label="10Y-2Y" value={m.yieldCurve10Y2Y} up={m.yieldCurve10Y2Y?.startsWith("+")}/>
            <MacroTile label="DXY" value={m.dxy} sub={m.dxyTrend}/>
            <MacroTile label="WTI Crude" value={m.wtiCrude}/>
            <MacroTile label="Gold" value={m.goldPrice}/>
            <MacroTile label="Cu/Au Ratio" value={m.copperGoldRatio}/>
            <MacroTile label="Unemployment" value={m.unemployment}/>
            <MacroTile label="GDP" value={m.gdpGrowth}/>
          </div>
        </div>

        {/* ── ROW 2: Trend chart (if history) */}
        {reports.length>=2&&<div style={{background:"#060f1a",border:"1px solid #0f2037",borderRadius:8,padding:14,marginBottom:14}}><TrendChart reports={reports}/></div>}

        {/* ── ROW 3: Three-column layer overview: Macro Quadrant | Investment Clock | Credit/Liq */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:14}}>
          <MacroQuadrant macroRegime={r.macroRegime}/>
          <InvestmentClock businessCycle={r.businessCycle}/>
          <CreditLiquidityPanel cl={r.creditLiquidity}/>
        </div>

        {/* ── ROW 4: Strategist note */}
        {rec.strategistNote&&<div style={{background:"#060f1a",border:"1px solid #0f2037",borderLeft:"3px solid #1d4ed8",borderRadius:8,padding:"13px 18px",marginBottom:14}}>
          <div style={{fontSize:9,color:"#1e3a5f",letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:6}}>Chief Strategist Note</div>
          <div style={{fontSize:14,color:"#94a3b8",lineHeight:1.7,fontStyle:"italic"}}>"{rec.strategistNote}"</div>
          <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
            <Badge label={`RISK: ${rec.overallRiskLevel||"—"}`} color={CONF_COLORS[rec.overallRiskLevel]||"#94a3b8"} small/>
            {rec.defensivePivot&&<Badge label="⚠ DEFENSIVE PIVOT ACTIVE" color="#f87171" small/>}
            {rec.tailRiskAdjustment&&<span style={{fontSize:10,color:"#475569"}}>{rec.tailRiskAdjustment}</span>}
          </div>
        </div>}

        {/* ── ROW 5: Rec cards + Sector board + Sector detail */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 220px 220px",gap:14,marginBottom:14}}>
          <RecCard rec={rec.primarySector} primary={true}/>
          <RecCard rec={rec.secondarySector} primary={false}/>
          {/* Sector board */}
          <div style={{background:"#060f1a",border:"1px solid #0f2037",borderRadius:8,padding:14}}>
            <CardTitle>Sector Signals</CardTitle>
            {(r.sectorAnalysis||[]).map((s,i)=>(
              <SectorRow key={i} s={s} onSelect={setSelectedSector} selected={selectedSector?.ticker===s.ticker}/>
            ))}
            {rec.avoidSectors?.length>0&&<div style={{marginTop:8,borderTop:"1px solid #0d1a29",paddingTop:8}}>
              <div style={{fontSize:9,color:"#7f1d1d",fontFamily:"monospace",marginBottom:5}}>AVOID</div>
              {rec.avoidSectors.map((av,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
                  <span style={{fontSize:10,color:"#f87171",fontFamily:"monospace",fontWeight:700}}>{av.ticker||av}</span>
                  {av.reason&&<span style={{fontSize:9,color:"#7f1d1d",flex:1,marginLeft:8,lineHeight:1.3}}>{av.reason}</span>}
                </div>
              ))}
            </div>}
          </div>
          {/* Sector detail */}
          <div style={{background:"#060f1a",border:"1px solid #0f2037",borderRadius:8,padding:14}}>
            <CardTitle>Sector Detail</CardTitle>
            <SectorDetailPanel s={selectedSector}/>
          </div>
        </div>

        {/* ── ROW 6: Tail risk + News + Events */}
        <div style={{display:"grid",gridTemplateColumns:"280px 1fr 1fr",gap:14}}>
          <TailRiskPanel tailRisk={r.tailRisk}/>
          <Card>
            <CardTitle>News Flow</CardTitle>
            {(r.topNews||[]).map((n,i)=><NewsItem key={i} item={n}/>)}
          </Card>
          <Card>
            <CardTitle>Economic Calendar</CardTitle>
            {(r.economicEvents||[]).map((e,i)=><EventItem key={i} item={e}/>)}
          </Card>
        </div>
      </div>
    );
  };

  // ── ARCHIVE ────────────────────────────────────────────────────────────────
  const renderArchive=()=>(
    <div>
      <Card style={{marginBottom:14}}>
        <CardTitle>Report Archive</CardTitle>
        {reports.length===0
          ? <div style={{color:"#1e3a5f",fontSize:12,fontFamily:"monospace",padding:"24px 0",textAlign:"center"}}>NO REPORTS SAVED YET</div>
          : [...reports].reverse().map((rp,i)=>{
              const cc=CONF_COLORS[rp.recommendation?.primarySector?.conviction]||"#94a3b8";
              const active=selectedDate===rp.reportDate;
              const tailC=TAIL_COLORS[rp.tailRisk?.regime]||"#64748b";
              return <div key={i} onClick={()=>{setSelectedDate(rp.reportDate);setTab("dashboard");}} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 14px",borderRadius:6,cursor:"pointer",marginBottom:4,background:active?"#0a1628":"transparent",border:`1px solid ${active?"#1e3a5f":"transparent"}`,transition:"all 0.15s"}}>
                <div style={{fontSize:12,color:"#e2e8f0",fontFamily:"monospace",width:115}}>{fmtDate(rp.reportDate)}</div>
                <RegimeBadge regime={rp.macroRegime?.quadrant||rp.marketRegime}/>
                <div style={{fontSize:11,color:"#475569",flex:1}}>{rp.businessCycle?.phase?.replace(/_/g," ")||rp.cyclePhase}</div>
                {rp.tailRisk&&<Badge label={`TAIL: ${rp.tailRisk.compositeScore}`} color={tailC} small/>}
                {rp.recommendation?.primarySector&&<div style={{fontSize:11,color:cc,fontFamily:"monospace",fontWeight:700}}>↑ {rp.recommendation.primarySector.ticker}</div>}
                {rp.recommendation?.secondarySector&&<div style={{fontSize:11,color:"#334155",fontFamily:"monospace"}}>+ {rp.recommendation.secondarySector.ticker}</div>}
                <div style={{fontSize:11,color:"#1e3a5f"}}>→</div>
              </div>;
            })
        }
      </Card>
      {reports.length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:11,color:"#1e3a5f",fontFamily:"monospace"}}>{reports.length} REPORT{reports.length!==1?"S":""} STORED · v3 schema</div>
        <button onClick={clearHistory} style={{background:"none",border:"1px solid #7f1d1d",color:"#f87171",borderRadius:4,padding:"5px 14px",fontSize:10,fontFamily:"monospace",cursor:"pointer",letterSpacing:"0.08em"}}>CLEAR ARCHIVE</button>
      </div>}
    </div>
  );

  // ── FULL RENDER ────────────────────────────────────────────────────────────
  return (
    <div style={{background:"#020b14",minHeight:"100vh",color:"#e2e8f0"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:2px}`}</style>
      {/* HEADER */}
      <div style={{borderBottom:"1px solid #0f2037",padding:"11px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#020b14",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:32,height:32,background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff",fontFamily:"monospace"}}>BB</div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"monospace"}}>BlackBridge Equity Research</div>
            <div style={{fontSize:9,color:"#1e3a5f",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace"}}>Bridgewater · AQR · BlackRock · Goldman · 6-Layer Institutional Analysis</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",background:"#060f1a",border:"1px solid #0f2037",borderRadius:5,overflow:"hidden"}}>
            {[["dashboard","Dashboard"],["archive","Archive"]].map(([id,label])=>(
              <button key={id} onClick={()=>{setTab(id);if(id==="archive")setSelectedDate(null);}} style={{padding:"6px 16px",fontSize:11,fontFamily:"monospace",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",border:"none",cursor:"pointer",background:tab===id?"#1d4ed8":"transparent",color:tab===id?"#fff":"#334155",transition:"all 0.15s"}}>{label}</button>
            ))}
          </div>
          <button onClick={()=>{setApiKey("");localStorage.removeItem(API_KEY_STORE);}} title="Change API Key" style={{background:"none",border:"1px solid #1e3a5f",borderRadius:4,color:"#334155",padding:"5px 10px",fontSize:10,fontFamily:"monospace",cursor:"pointer"}}>⚙ KEY</button>
          <button onClick={runAnalysis} style={{padding:"8px 18px",background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontFamily:"monospace",fontWeight:700,letterSpacing:"0.08em",cursor:"pointer"}}>▶ RUN ANALYSIS</button>
        </div>
      </div>
      {/* STATUS */}
      {(error||currentReport)&&<div style={{background:"#060f1a",borderBottom:"1px solid #0a1628",padding:"5px 24px",display:"flex",alignItems:"center",gap:14}}>
        {error
          ? <span style={{fontSize:11,color:"#f87171",fontFamily:"monospace"}}>⚠ {error}</span>
          : <>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#22d3a8",display:"inline-block",boxShadow:"0 0 5px #22d3a8"}}/>
              <span style={{fontSize:10,color:"#1e3a5f",fontFamily:"monospace",letterSpacing:"0.06em"}}>
                LAST REPORT: {currentReport?`${fmtDate(currentReport.reportDate)} ${currentReport.reportTime||""}`:"—"}{reports.length>1?` · ${reports.length} REPORTS`:""}
              </span>
              {selectedDate&&<span style={{fontSize:10,color:"#f59e0b",fontFamily:"monospace"}}>
                VIEWING: {fmtDate(selectedDate)} &nbsp;
                <button onClick={()=>setSelectedDate(null)} style={{background:"none",border:"none",color:"#f59e0b",cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>× LATEST</button>
              </span>}
            </>
        }
      </div>}
      {/* MAIN */}
      <div style={{padding:"18px 24px",maxWidth:1600,margin:"0 auto"}}>
        {tab==="dashboard"&&renderDashboard()}
        {tab==="archive"&&renderArchive()}
      </div>
    </div>
  );
}
