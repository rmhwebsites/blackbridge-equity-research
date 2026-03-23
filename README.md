# BlackBridge Equity Research
### Daily AI-Driven Macro Analysis & S&P 500 Sector Rotation

A bulge-bracket-style research dashboard that runs a daily AI agent to scan macro indicators, economic events, market news, and sector performance — then recommends which S&P 500 sector to overweight using the Fidelity business cycle rotation framework.

## Live Demo
👉 [blackbridge-equity-research on GitHub Pages](https://YOUR_USERNAME.github.io/blackbridge-equity-research/)

## Features
- **AI Research Agent** — Uses Claude claude-sonnet-4-5 with live web search to pull real market data daily
- **Standardized Daily Report** — Uniform JSON schema every day: macro indicators, news flow, economic calendar, sector signals, and investment recommendation
- **Sector Rotation Dashboard** — Visual trend chart showing regime and top sector picks over time
- **Archive** — Every report persisted in localStorage; drill into any historical date
- **Business Cycle Framework** — Applies the Fidelity sector rotation model (Early/Mid/Late Expansion, Contraction)

## Setup (Local Dev)
```bash
git clone https://github.com/YOUR_USERNAME/blackbridge-equity-research
cd blackbridge-equity-research
npm install
npm run dev
```
Open http://localhost:5173/blackbridge-equity-research/ and enter your Anthropic API key.

## Deploy to GitHub Pages (Automatic)
1. Fork / push this repo to GitHub
2. Go to **Settings → Pages → Source → GitHub Actions**
3. Push to `main` — the workflow builds and deploys automatically
4. Your live URL: `https://YOUR_USERNAME.github.io/blackbridge-equity-research/`

## API Key
You need an [Anthropic API key](https://console.anthropic.com). It is stored only in your browser's localStorage — never sent to any server other than `api.anthropic.com` directly.

## Report Schema
Each daily report follows this standardized structure:
```json
{
  "reportDate": "YYYY-MM-DD",
  "reportTime": "HH:MM UTC",
  "marketRegime": "RISK_ON | RISK_OFF | TRANSITIONING | NEUTRAL",
  "cyclePhase": "Early/Mid/Late Expansion | Contraction | Uncertain",
  "macroIndicators": { "spx", "vix", "fedFundsRate", "cpi", "unemployment", "gdpGrowth", "yieldCurve10Y2Y", "dxy", "wtiCrude" },
  "economicEvents": [...],
  "topNews": [...],
  "sectorAnalysis": [...],
  "recommendation": {
    "primarySector": { "ticker", "conviction", "thesis", "timeHorizon", "entryRationale" },
    "secondarySector": { ... },
    "avoidSectors": [...],
    "strategistNote": "..."
  }
}
```

## Tech Stack
- React 19 + Vite
- Claude claude-sonnet-4-5 via Anthropic API with web_search tool
- localStorage for report persistence
- GitHub Actions + GitHub Pages for deployment
