# BlackBridge Daily Market Analysis Skill

## Purpose
Run and interpret the BlackBridge 6-layer institutional equity research analysis. This skill teaches Claude how to execute, parse, diagnose, and act on the daily morning report.

---

## 1. Deployment Context

- **Dashboard**: https://blackbridge-equity-research.vercel.app
- **Stack**: Vercel Edge Functions + Supabase (`bb_reports` table) + Anthropic Claude claude-sonnet-4-5 with `web_search_20250305`
- **Auth**: `bb_session` HMAC-SHA256 HttpOnly cookie (browser) or `X-Trigger-Secret` header (automated)
- **Daily trigger**: GitHub Actions cron at `0 14 * * 1-5` (9am ET, weekdays)

---

## 2. The Six-Layer Framework

Every analysis cascades top-down through these layers. Each feeds into the composite score.

### Layer 1 — Macro Regime (Bridgewater Growth/Inflation Quadrant)
**What it measures**: Are growth and inflation rising or falling?
**Key data**: ISM Manufacturing PMI, Core CPI YoY, 10Y breakeven inflation, CFNAI, DXY, commodity index
**Output**: One of four quadrants:
- `GOLDILOCKS`: Growth↑ Inflation↓ → Risk assets, growth sectors, long duration
- `REFLATION`: Growth↑ Inflation↑ → Cyclicals, energy, real assets, short duration
- `STAGFLATION`: Growth↓ Inflation↑ → Commodities, TIPS, defensive value
- `DEFLATION`: Growth↓ Inflation↓ → Quality bonds, defensives, cash
**Weight in final score**: 25% (via Strategic View)

### Layer 2 — Business Cycle (Fidelity AART + Merrill Lynch Investment Clock)
**What it measures**: Where are we in the economic cycle?
**Key data**: Yield curve 2s10s, ISM New Orders minus Inventories spread, unemployment trend, leading indicators
**Output**: Cycle phase + clock position 1–12:
- `EARLY_EXPANSION` (clock 1–3): Discretionary, Financials, Industrials
- `MID_EXPANSION` (clock 4–6): Technology, Industrials, Energy
- `LATE_EXPANSION` (clock 7–9): Energy, Materials, Staples
- `RECESSION` (clock 10–12): Staples, Healthcare, Utilities
**Weight in final score**: 25% (via Strategic View)

### Layer 3 — Credit & Liquidity Conditions
**What it measures**: How tight or loose is financial liquidity?
**Key data**: HY OAS (ICE BofA HY Master II), IG OAS, Chicago Fed NFCI, VIX term structure
**Regime thresholds**:
- `TIGHT` < 300 bps HY OAS → very loose, risk-on
- `NORMAL` 300–450 bps
- `ELEVATED` 450–500 bps
- `STRESS` 500–700 bps → defensive tilt warranted
- `CRISIS` > 700 bps → maximum defence
**Weight in final score**: 15% (via Tactical View)

### Layer 4 — Fundamental Factor Scoring (BlackRock/AQR/MSCI)
**What it measures**: Bottom-up factor quality of each sector's ETF
**Six factors per sector**:
1. **Momentum**: 12-1 month total return (skip last month to avoid reversal)
2. **Value**: Forward P/E vs 10-year historical average
3. **Quality**: ROE, earnings stability, net debt/EBITDA
4. **Earnings Revision Breadth (ERB)**: Analyst upgrades minus downgrades
5. **Low Volatility**: Realised 252-day vol vs SPX average
6. **Carry**: Dividend yield + net buyback yield
**Composite**: 0.20×Mom + 0.20×Val + 0.20×Qual + 0.20×ERB + 0.10×LowVol + 0.10×Carry
**Score range**: –2.0 (worst) to +2.0 (best)
**Weight in final score**: 27% (via Tactical View)

### Layer 5 — Technical Momentum Overlays
**What it measures**: Price trend and momentum confirmation
**Key signals per sector ETF**:
- 200-DMA position (above/below, % distance)
- RSI(14): <30 oversold, 30–45 weak, 45–55 neutral, 55–70 bullish, >70 overbought
- MACD(12,26,9): bullish/bearish crossover
- Relative strength vs SPX: outperforming/inline/underperforming
- Breadth: % constituents above 200-DMA
**Weight in final score**: 18% (via Tactical View)

### Layer 6 — Tail Risk & Black Swan Assessment
**What it measures**: Probability and severity of adverse tail events
**Six sub-scores (0–100 each)**:
- `volatilityStress`: VIX level, VIX/VIX3M ratio (backwardation = stress), MOVE index
- `creditStress`: HY OAS rate-of-change, IG OAS, CDS indices
- `fundingLiquidity`: FRA-OIS spread, cross-currency basis, repo stress
- `systemicRisk`: Cross-asset correlation spikes, ECB CISS, SRISK
- `macroVulnerability`: BIS credit-to-GDP gap, debt service ratios
- `geopoliticalTail`: GPR index, geopolitical events
**Composite dampener**: `max(0.25, 1.0 – max(0, (score–50)/100))`
- Score 0–50: dampener = 1.00 (no reduction)
- Score 51–100: dampener scales from 1.00 → 0.50
- Override: score > 85 → emergency defensive tilt
**Black Swan Checklist**:
- Dalio Depression Gauge: rates at ZLB + credit growth > income growth
- BIS Early Warning: credit-to-GDP gap > 10pp (amber) or > 15pp (red)
- Soros Reflexivity Alert: price acceleration + breadth divergence
- Yield Curve Inversion: 2s10s < 0

---

## 3. Composite Scoring Formula

```
StrategicView  = 0.50 × L1_RegimeTilt + 0.50 × L2_CycleTilt
TacticalView   = 0.25 × L3_CreditSignal + 0.45 × L4_Fundamentals + 0.30 × L5_Technicals
BaseScore      = 0.40 × StrategicView + 0.60 × TacticalView
FinalScore     = BaseScore × TailRiskDampener
```

**Signal thresholds**:
| Score | Signal |
|---|---|
| > +1.0 | `STRONG_OVERWEIGHT` |
| +0.5 to +1.0 | `OVERWEIGHT` |
| –0.5 to +0.5 | `NEUTRAL` |
| –1.0 to –0.5 | `UNDERWEIGHT` |
| < –1.0 | `STRONG_UNDERWEIGHT` |

---

## 4. Interpreting the Report

### 4a. Reading the Macro Context
When you receive a report, check these first:
1. **Quadrant** (`macroRegime.quadrant`): Determines which sectors structurally benefit
2. **Cycle phase** (`businessCycle.phase`): Confirms or challenges the quadrant signal
3. **HY OAS regime** (`creditLiquidity.hyOASRegime`): If STRESS or CRISIS, discount all overweight calls
4. **Tail risk score** (`tailRisk.compositeScore`): If > 70, treat all signals with scepticism
5. **Dampener** (`tailRisk.dampener`): A dampener < 0.75 means significant reduction already applied

### 4b. Evaluating the Primary Recommendation
Strong conviction requires all three to align:
- ✅ Layer 1 regime favours the sector
- ✅ Layer 2 cycle phase favours the sector
- ✅ Layer 4 composite factor score > +0.8

Red flags that weaken the call:
- ⚠️ Technical trend below 200-DMA despite strong fundamentals
- ⚠️ RSI > 70 (overbought, poor entry)
- ⚠️ Deteriorating ERB (analyst downgrades accelerating)
- ⚠️ conflictingSignals array not empty
- ⚠️ Tail risk > 60 (apply haircut to position sizing)

### 4c. Sector Rotation Signals by Quadrant
| Quadrant | Overweight | Underweight |
|---|---|---|
| GOLDILOCKS | XLK, XLC, XLY, XLI | XLE, XLU, XLP |
| REFLATION | XLE, XLB, XLF, XLI | XLU, XLP, XLRE |
| STAGFLATION | XLE, XLP, XLV | XLK, XLC, XLY, XLRE |
| DEFLATION | XLU, XLP, XLV, XLRE | XLE, XLF, XLB |

---

## 5. Running the Analysis Manually

### Via the Dashboard (browser)
1. Go to https://blackbridge-equity-research.vercel.app
2. Log in with the dashboard password
3. Click **▶ RUN ANALYSIS**
4. Wait 60–90 seconds for the 6-layer analysis to complete
5. Report saves automatically to Supabase and localStorage

### Via Claude directly (this skill)
You can ask Claude to interpret the latest saved report:
> "Read my latest BlackBridge report and give me today's trade recommendation"

Claude will use the report data already in context or ask you to paste it.

### Via the API (automated trigger)
```bash
curl -X POST https://blackbridge-equity-research.vercel.app/api/trigger-daily \
  -H "Content-Type: application/json" \
  -H "X-Trigger-Secret: YOUR_TRIGGER_SECRET" \
  -d '{"force": false}'
```

Response includes the full report JSON + Supabase save status.

---

## 6. Daily 9am Automation Setup

### Step 1 — Add GitHub Secrets
In your repo (`rmhwebsites/blackbridge-equity-research`) → Settings → Secrets → Actions:

| Secret name | Value |
|---|---|
| `BLACKBRIDGE_URL` | `https://blackbridge-equity-research.vercel.app` |
| `BLACKBRIDGE_TRIGGER_SECRET` | A random 32+ char string (generate one below) |

Generate a secret:
```bash
openssl rand -hex 32
```

### Step 2 — Add Vercel Environment Variable
In Vercel → Project → Settings → Environment Variables:
- Name: `TRIGGER_SECRET`
- Value: Same string you used for `BLACKBRIDGE_TRIGGER_SECRET` above

### Step 3 — Verify the Cron Schedule
The workflow runs at `0 14 * * 1-5` (9:00am ET, Mon–Fri).
To change the timezone, update the cron hour:
- 9am London (GMT): `0 9 * * 1-5`
- 9am London (BST summer): `0 8 * * 1-5`
- 9am Hong Kong: `0 1 * * 1-5`
- 9am Sydney: `0 23 * * 0-4` (previous day UTC)

### Step 4 — Test Manually
Go to your GitHub repo → Actions → Daily Market Analysis → Run workflow

---

## 7. Common Issues & Fixes

### "Parse failed: Could not parse report JSON"
The model returned prose before the JSON. The app now handles this (finds the `{`-starting block). If it still fails:
- The model hit its context limit mid-JSON → try again (it's stochastic)
- The report is malformed beyond repair → check the Preview in the error message

### "No response received from analysis"
The SSE stream closed without a `data:` event:
- Anthropic API was overloaded → retry
- Edge Function timed out (>5min) → check Vercel logs

### "Supabase error" on save
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel
- Confirm `bb_reports` table exists with correct schema
- RLS is enabled — service role key bypasses it (ensure you're using service role, not anon key)

### Report populates but charts show "—"
The model returned numeric fields as strings. The app converts them via `num()` helper. If a field still shows `—`, the model omitted it entirely — acceptable for optional fields.

### Signal badges all show "N" (Neutral)
The model returned signal strings in wrong case (e.g. "Overweight" not "OVERWEIGHT"). The app normalises to uppercase before lookup. If you still see this, check `signalStyle()` in App.jsx.

---

## 8. Report JSON Schema Reference

```
{
  reportDate:      "YYYY-MM-DD"
  reportTime:      "HH:MM UTC"
  schemaVersion:   "3.0"

  macroRegime: {
    quadrant:           GOLDILOCKS | REFLATION | STAGFLATION | DEFLATION
    growthMomentum:     RISING | FALLING | STABLE
    inflationMomentum:  RISING | FALLING | STABLE
    growthZScore:       number  (-2 to +2)
    inflationZScore:    number  (-2 to +2)
    regimeConfidence:   number  (0 to 1)
    dalioDebtCyclePhase: string
    regimeNarrative:    string  (2 sentences)
  }

  marketRegime:    RISK_ON | RISK_OFF | TRANSITIONING | NEUTRAL
  cyclePhase:      string  (human-readable)

  businessCycle: {
    phase:                    EARLY_EXPANSION | MID_EXPANSION | LATE_EXPANSION | RECESSION
    yieldCurveSignal:         STEEPENING | FLAT | INVERTED
    ismPMI:                   string  ("52.1")
    ismNewOrdersInventoriesDiff: string  ("+4.2")
    clockPosition:            number  (1–12)
    cycleNarrative:           string
  }

  creditLiquidity: {
    hyOAS:            string  ("342 bps")
    hyOASRegime:      TIGHT | NORMAL | ELEVATED | STRESS | CRISIS
    igOAS:            string
    nfci:             string  ("-0.12")
    nfciRegime:       NORMAL | TIGHT | LOOSE
    vixLevel:         string  ("18.4")
    vixTermStructure: CONTANGO | BACKWARDATION | FLAT
    moveIndex:        string  ("98")
    creditSignal:     RISK_ON | NEUTRAL | RISK_OFF
    liquidityNarrative: string
  }

  macroIndicators: {
    fedFundsRate, cpi, corePCE, unemployment, gdpGrowth,
    yieldCurve10Y2Y, tenYearYield, twoYearYield,
    dxy, dxyTrend, wtiCrude, goldPrice, copperGoldRatio,
    vix, moveIndex, spx, spxChange, spxVs200dma,
    breakeven10Y, realRate10Y
  }

  economicEvents: [{
    event, date, impact (HIGH|MEDIUM|LOW),
    actual, expected, prior, surprise (BEAT|MISS|IN_LINE),
    marketImplication, affectedSectors
  }]

  topNews: [{
    headline, source, sentiment (BULLISH|BEARISH|NEUTRAL),
    sectorImpact, macroRelevance (HIGH|MEDIUM|LOW), impact
  }]

  sectorAnalysis: [{          — 11 entries, one per GICS sector ETF
    ticker:         XLK | XLV | XLF | XLY | XLP | XLE | XLI | XLB | XLRE | XLU | XLC
    name:           string
    compositeScore: number  (-2.0 to +2.0)
    signal:         STRONG_OVERWEIGHT | OVERWEIGHT | NEUTRAL | UNDERWEIGHT | STRONG_UNDERWEIGHT
    confidence:     number  (0 to 1)
    primaryDriver:  MOMENTUM | VALUE | QUALITY | TECHNICALS | MACRO
    layerScores: {
      l1MacroRegime, l2CycleTilt, l3CreditLiq, l4Fundamentals, l5Technicals
    }
    factorScores: {
      momentum, momentum12m1, value, fwdPERelative, quality,
      earningsRevisionBreadth, erbTrend, lowVol, carry,
      technicalTrend, rsi14, macdSignal, relStrengthVsSPX
    }
    cycleAlignment: STRONG | MODERATE | WEAK | CONFLICTING
    catalyst:       string
    risk:           string
    conflictingSignals: string[]
  }]

  tailRisk: {
    compositeScore: number  (0–100)
    regime:         LOW | NORMAL | ELEVATED | HIGH | CRISIS
    dampener:       number  (0.25–1.0)
    subScores: {
      volatilityStress, creditStress, fundingLiquidity,
      systemicRisk, macroVulnerability, geopoliticalTail
    }
    vixTermStructure: string
    activeAlerts:   string[]
    blackSwanChecklist: {
      dalioDepressionGauge: LOW | MEDIUM | HIGH
      bisEarlyWarning:      GREEN | AMBER | RED
      reflexivityAlert:     boolean
      breadthDivergence:    boolean
      creditGapWarning:     boolean
      yieldCurveInversion:  boolean
    }
    tailNarrative:  string
  }

  recommendation: {
    primarySector: {
      ticker, name, conviction (HIGH|MEDIUM|LOW),
      compositeScore, thesis, timeHorizon, entryRationale,
      catalysts: string[], keyRisks: string[]
    }
    secondarySector: { same structure }
    avoidSectors:   [{ ticker, reason }]
    defensivePivot: boolean
    overallRiskLevel: HIGH | MEDIUM | LOW
    tailRiskAdjustment: string
    strategistNote: string  (chief strategist summary)
  }
}
```

---

## 9. Claude Interpretation Template

When a user shares a BlackBridge report or asks about today's analysis, follow this structure:

### Quick summary (always lead with this)
1. **Regime**: [quadrant] — [1-line implication for equities]
2. **Top pick**: [ticker] ([signal]) — [compositeScore] | [conviction] conviction
3. **Thesis in one line**: [strategistNote or primary thesis, truncated]
4. **Risk level**: [overallRiskLevel] | Tail score [compositeScore]/100 | Dampener [dampener]×

### If asked for full analysis
Walk through each layer:
- L1: Quadrant + narrative + what it means for sector rotation
- L2: Cycle phase + clock position + which sectors it historically favours
- L3: HY OAS level + credit regime + whether liquidity is supportive
- L4: Top 3 sectors by composite score + their factor drivers
- L5: Technical confirmation or divergence vs fundamentals
- L6: Tail risk breakdown + any active alerts + black swan status
- ∑: How the composite score was reached + what the dampener is doing

### If asked for a trade idea
Use this structure:
> **[TICKER] — [SIGNAL]**
> Entry: [entryRationale]
> Thesis: [thesis]
> Catalysts: [catalysts]
> Risks: [keyRisks]
> Horizon: [timeHorizon]
> Conviction: [conviction] | Score: [compositeScore]

### If tail risk is elevated (score > 60)
Always flag: "Note: tail risk at [score]/100 — consider reduced position sizing. Dampener already applied ([dampener]×)."

### If regime and cycle conflict
Explain the tension: "L1 [quadrant] favours [sectors] but L2 [phase] typically prefers [other sectors]. The model resolves this conflict by weighting [reason]."
