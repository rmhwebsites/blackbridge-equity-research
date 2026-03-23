import { useState, useEffect } from "react";

const CONFIDENCE_COLORS = { HIGH: "#22d3a8", MEDIUM: "#f59e0b", LOW: "#f87171" };
const REGIME_COLORS = { RISK_ON: "#22d3a8", RISK_OFF: "#f87171", TRANSITIONING: "#f59e0b", NEUTRAL: "#94a3b8" };
const STORAGE_KEY = "bb_market_reports_v2";
const API_KEY_STORAGE = "bb_anthropic_key";

const SP500_SECTORS = [
  { id: "XLK", name: "Technology" },{ id: "XLV", name: "Health Care" },{ id: "XLF", name: "Financials" },
  { id: "XLY", name: "Consumer Disc." },{ id: "XLP", name: "Consumer Staples" },{ id: "XLE", name: "Energy" },
  { id: "XLI", name: "Industrials" },{ id: "XLB", name: "Materials" },{ id: "XLRE", name: "Real Estate" },
  { id: "XLU", name: "Utilities" },{ id: "XLC", name: "Comm. Services" },
];

const SYSTEM_PROMPT = `You are the Chief Investment Strategist at a bulge bracket investment bank. Your team identifies macroeconomic cycles and positions into the optimal S&P 500 sector.

Daily mandate:
1. MACRO SCAN: Search for Fed Funds Rate, CPI, unemployment, GDP growth, 10Y-2Y yield curve spread, DXY, WTI crude, VIX, S&P 500 level and daily change.
2. ECONOMIC EVENTS: Search for today's and upcoming economic data releases.
3. MARKET NEWS: Search for the top 5 market-moving news stories today.
4. SECTOR PERFORMANCE: Search for current S&P 500 sector ETF momentum (XLK XLV XLF XLY XLP XLE XLI XLB XLRE XLU XLC).
5. CYCLE ANALYSIS: Determine economic cycle phase and market regime.
6. RECOMMENDATION: Use the Fidelity sector rotation model to recommend PRIMARY and SECONDARY sectors to overweight.

Respond ONLY with a single valid JSON object. No markdown, no backticks, no explanation text before or after. The JSON must match this schema exactly:
{"reportDate":"YYYY-MM-DD","reportTime":"HH:MM UTC","marketRegime":"RISK_ON","cyclePhase":"Mid Expansion","macroIndicators":{"fedFundsRate":"X.XX%","cpi":"X.X% YoY","unemployment":"X.X%","gdpGrowth":"X.X% annualized","yieldCurve10Y2Y":"+XX bps","dxy":"XXX.XX","wtiCrude":"$XX.XX","vix":"XX.X","spx":"X,XXX.XX","spxChange":"+X.XX%"},"economicEvents":[{"event":"name","date":"YYYY-MM-DD","impact":"HIGH","reading":"X.X vs X.X est","marketImplication":"text"}],"topNews":[{"headline":"text","source":"name","sentiment":"BULLISH","sector":"sector","impact":"text"}],"sectorAnalysis":[{"ticker":"XLK","name":"Technology","signal":"OVERWEIGHT","momentum":"STRONG","catalyst":"text","risk":"text"}],"recommendation":{"primarySector":{"ticker":"XLK","name":"Technology","conviction":"HIGH","thesis":"text","timeHorizon":"4-6 weeks","entryRationale":"text"},"secondarySector":{"ticker":"XLF","name":"Financials","conviction":"MEDIUM","thesis":"text","timeHorizon":"4-8 weeks","entryRationale":"text"},"avoidSectors":["XLU","XLRE"],"overallRiskLevel":"MEDIUM","strategistNote":"text"}}`;

function parseReport(text) {
  const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(clean); } catch (_) {}
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error("Could not parse JSON from response");
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function RegimeBadge({ regime }) {
  const c = REGIME_COLORS[regime] || "#94a3b8";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:c+"18", border:`1px solid ${c}40`, borderRadius:4, padding:"3px 10px", fontSize:11, color:c, fontFamily:"monospace", fontWeight:700, letterSpacing:"0.08em" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:c, boxShadow:`0 0 6px ${c}` }}/>
      {regime?.replace("_"," ")}
    </span>
  );
}

function MacroTile({ label, value, change }) {
  const isUp = change ? change.startsWith("+") : null;
  return (
    <div style={{ background:"#0a1628", borderRadius:6, padding:"10px 14px", minWidth:100 }}>
      <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"monospace", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color:"#e2e8f0", fontFamily:"monospace" }}>{value||"—"}</div>
      {change && <div style={{ fontSize:11, color:isUp?"#22d3a8":"#f87171", fontFamily:"monospace" }}>{change}</div>}
    </div>
  );
}

function SectorRow({ ticker, name, signal, momentum }) {
  const ss = {OVERWEIGHT:{bg:"#052e1e",text:"#22d3a8"},NEUTRAL:{bg:"#1e293b",text:"#94a3b8"},UNDERWEIGHT:{bg:"#2e0505",text:"#f87171"}}[signal]||{bg:"#1e293b",text:"#94a3b8"};
  const mc = {STRONG:"#22d3a8",MODERATE:"#f59e0b",WEAK:"#94a3b8",NEGATIVE:"#f87171"}[momentum]||"#94a3b8";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:"1px solid #0d1a29" }}>
      <div style={{ width:38, fontSize:10, color:"#64748b", fontFamily:"monospace" }}>{ticker}</div>
      <div style={{ flex:1, fontSize:12, color:"#cbd5e1" }}>{name}</div>
      <div style={{ fontSize:9, color:mc, fontFamily:"monospace" }}>{momentum}</div>
      <div style={{ fontSize:10, fontWeight:700, color:ss.text, background:ss.bg, borderRadius:3, padding:"1px 6px", fontFamily:"monospace" }}>
        {(signal||"—").replace("OVERWEIGHT","OW").replace("UNDERWEIGHT","UW")}
      </div>
    </div>
  );
}

function NewsItem({ item }) {
  const c = item.sentiment==="BULLISH"?"#22d3a8":item.sentiment==="BEARISH"?"#f87171":"#94a3b8";
  return (
    <div style={{ padding:"9px 0", borderBottom:"1px solid #0d1a29", display:"flex", gap:10 }}>
      <div style={{ width:3, background:c, borderRadius:2, flexShrink:0 }}/>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, color:"#e2e8f0", lineHeight:1.5, marginBottom:3 }}>{item.headline}</div>
        <div style={{ display:"flex", gap:8 }}>
          <span style={{ fontSize:10, color:"#475569" }}>{item.source}</span>
          {item.sector&&<span style={{ fontSize:10, color:"#334155" }}>· {item.sector}</span>}
          <span style={{ fontSize:10, color:c, fontFamily:"monospace", fontWeight:700 }}>{item.sentiment}</span>
        </div>
        {item.impact&&<div style={{ fontSize:11, color:"#64748b", marginTop:2, lineHeight:1.4 }}>{item.impact}</div>}
      </div>
    </div>
  );
}

function EventItem({ item }) {
  const ic = {HIGH:"#f87171",MEDIUM:"#f59e0b",LOW:"#22d3a8"}[item.impact]||"#94a3b8";
  return (
    <div style={{ padding:"8px 0", borderBottom:"1px solid #0d1a29", display:"flex", gap:10 }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:ic, marginTop:4, flexShrink:0, boxShadow:`0 0 5px ${ic}80` }}/>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <div style={{ fontSize:12, color:"#e2e8f0", fontWeight:500 }}>{item.event}</div>
          <div style={{ fontSize:10, color:"#475569", fontFamily:"monospace" }}>{item.date}</div>
        </div>
        {item.reading&&<div style={{ fontSize:11, color:"#94a3b8", fontFamily:"monospace", marginTop:2 }}>{item.reading}</div>}
        {item.marketImplication&&<div style={{ fontSize:11, color:"#64748b", marginTop:2, lineHeight:1.4 }}>{item.marketImplication}</div>}
      </div>
    </div>
  );
}

function RecCard({ rec, primary }) {
  if (!rec) return null;
  const cc = CONFIDENCE_COLORS[rec.conviction]||"#94a3b8";
  return (
    <div style={{ background:primary?"#08142a":"#060f1a", border:`1px solid ${primary?"#1a3566":"#0f2037"}`, borderRadius:8, padding:18, position:"relative", overflow:"hidden" }}>
      {primary&&<div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,#1d4ed8,#22d3a8)" }}/>}
      <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"monospace", marginBottom:6 }}>{primary?"PRIMARY OVERWEIGHT":"SECONDARY OVERWEIGHT"}</div>
      <div style={{ fontSize:22, fontWeight:800, color:"#f1f5f9", letterSpacing:"-0.02em", marginBottom:2 }}>{rec.name}</div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ fontSize:13, color:"#475569", fontFamily:"monospace" }}>{rec.ticker}</div>
        <div style={{ fontSize:10, color:cc, fontFamily:"monospace", fontWeight:700 }}>{rec.conviction} · {rec.timeHorizon}</div>
      </div>
      <div style={{ fontSize:13, color:"#94a3b8", lineHeight:1.65, marginBottom:10 }}>{rec.thesis}</div>
      {rec.entryRationale&&<div style={{ background:"#0a1628", borderRadius:4, padding:"7px 12px", fontSize:11, color:"#64748b", borderLeft:`2px solid ${cc}` }}><span style={{ color:cc, fontWeight:700 }}>ENTRY: </span>{rec.entryRationale}</div>}
    </div>
  );
}

function TrendChart({ reports }) {
  const last8 = reports.slice(-8);
  return (
    <div>
      <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"monospace", marginBottom:10 }}>SECTOR ROTATION HISTORY ({last8.length} REPORTS)</div>
      <div style={{ display:"flex", gap:6 }}>
        {last8.map((r,i)=>{
          const c = REGIME_COLORS[r.marketRegime]||"#94a3b8";
          return (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{ width:"100%", height:44, background:c+"18", border:`1px solid ${c}30`, borderRadius:5, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2 }}>
                <span style={{ fontSize:11, color:c, fontFamily:"monospace", fontWeight:700 }}>{r.recommendation?.primarySector?.ticker||"—"}</span>
                <span style={{ fontSize:9, color:c+"80", fontFamily:"monospace" }}>{r.recommendation?.secondarySector?.ticker||""}</span>
              </div>
              <div style={{ width:6, height:6, borderRadius:"50%", background:c }}/>
              <div style={{ fontSize:9, color:"#334155", fontFamily:"monospace" }}>
                {new Date(r.reportDate+"T12:00:00Z").toLocaleDateString("en-US",{month:"numeric",day:"numeric"})}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApiKeyGate({ onSave }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ minHeight:"100vh", background:"#020b14", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:420, background:"#060f1a", border:"1px solid #0f2037", borderRadius:10, padding:36 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
          <div style={{ width:36, height:36, background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)", borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:"#fff", fontFamily:"monospace" }}>BB</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#e2e8f0", letterSpacing:"0.05em", fontFamily:"monospace" }}>BLACKBRIDGE RESEARCH</div>
            <div style={{ fontSize:10, color:"#334155", letterSpacing:"0.1em", fontFamily:"monospace" }}>DAILY MARKET INTELLIGENCE</div>
          </div>
        </div>
        <p style={{ fontSize:13, color:"#64748b", lineHeight:1.7, marginBottom:20 }}>Enter your Anthropic API key to power the daily AI-driven market analysis. The key is saved only in your browser.</p>
        <div style={{ fontSize:10, color:"#334155", letterSpacing:"0.1em", fontFamily:"monospace", marginBottom:8 }}>ANTHROPIC API KEY</div>
        <input type="password" value={val} onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&val&&onSave(val.trim())}
          placeholder="sk-ant-..." style={{ width:"100%", background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:5, padding:"10px 14px", color:"#e2e8f0", fontSize:13, fontFamily:"monospace", outline:"none", marginBottom:16, boxSizing:"border-box" }}/>
        <button onClick={()=>val.trim()&&onSave(val.trim())} style={{ width:"100%", background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)", border:"none", borderRadius:5, color:"#fff", padding:"10px", fontSize:12, fontFamily:"monospace", fontWeight:700, letterSpacing:"0.08em", cursor:"pointer" }}>
          ENTER DASHBOARD →
        </button>
        <div style={{ marginTop:14, fontSize:10, color:"#1e3a5f", textAlign:"center" }}>
          Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color:"#1d4ed8" }}>console.anthropic.com</a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(()=>localStorage.getItem(API_KEY_STORAGE)||"");
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(()=>{
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) { const a=JSON.parse(s); setReports(a); if(a.length) setCurrentReport(a[a.length-1]); }
    } catch(_){}
  },[]);

  const saveReports = (arr) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch(_){}
    setReports(arr);
  };

  const handleSaveKey = (k) => { localStorage.setItem(API_KEY_STORAGE,k); setApiKey(k); };

  if (!apiKey) return <ApiKeyGate onSave={handleSaveKey}/>;

  const runAnalysis = async () => {
    setLoading(true); setError(null); setTab("dashboard"); setSelectedDate(null);
    const STEPS=["🔍 Scanning macro indicators…","📊 Pulling live market data…","📰 Aggregating news flow…","📅 Checking economic calendar…","📈 Analysing sector ETFs…","🧠 Running cycle analysis…","💼 Generating recommendation…"];
    let si=0; setLoadingStep(STEPS[0]);
    const timer=setInterval(()=>{ si++; if(si<STEPS.length) setLoadingStep(STEPS[si]); },2800);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({
          model:"claude-sonnet-4-5",
          max_tokens:4000,
          system:SYSTEM_PROMPT,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{role:"user",content:`Today is ${new Date().toISOString().split("T")[0]}. Run the complete daily market analysis using web search to retrieve all current data. Output ONLY the JSON report object with no surrounding text.`}]
        })
      });
      clearInterval(timer); setLoadingStep("✅ Processing report…");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message||`API error ${res.status}`);
      const texts = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
      if (!texts) throw new Error("No text content returned from API.");
      const report = parseReport(texts);
      const updated = [...reports.filter(r=>r.reportDate!==report.reportDate), report];
      saveReports(updated);
      setCurrentReport(report);
    } catch(err) {
      clearInterval(timer);
      setError(err.message||"Analysis failed. Check API key and try again.");
    } finally { setLoading(false); setLoadingStep(""); }
  };

  const displayReport = selectedDate ? reports.find(r=>r.reportDate===selectedDate) : currentReport;
  const clearHistory = ()=>{ if(window.confirm("Clear all saved reports?")){ saveReports([]); setCurrentReport(null); setSelectedDate(null); }};

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#020b14", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:48, height:48, border:"2px solid #0f2037", borderTop:"2px solid #1d4ed8", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:14, color:"#e2e8f0", fontFamily:"monospace", fontWeight:700, letterSpacing:"0.06em", marginBottom:8 }}>RUNNING DAILY MARKET ANALYSIS</div>
        <div style={{ fontSize:12, color:"#22d3a8", fontFamily:"monospace" }}>{loadingStep}</div>
      </div>
    </div>
  );

  const r = displayReport;
  const m = r?.macroIndicators||{};
  const rec = r?.recommendation||{};

  return (
    <div style={{ background:"#020b14", minHeight:"100vh", color:"#e2e8f0" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:2px}`}</style>

      {/* HEADER */}
      <div style={{ borderBottom:"1px solid #0f2037", padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#020b14", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:32, height:32, background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:"#fff", fontFamily:"monospace" }}>BB</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#e2e8f0", letterSpacing:"0.06em", textTransform:"uppercase", fontFamily:"monospace" }}>BlackBridge Equity Research</div>
            <div style={{ fontSize:9, color:"#1e3a5f", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"monospace" }}>Macro Intelligence · Sector Rotation · S&P 500</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex", background:"#060f1a", border:"1px solid #0f2037", borderRadius:5, overflow:"hidden" }}>
            {[["dashboard","Dashboard"],["archive","Archive"]].map(([id,label])=>(
              <button key={id} onClick={()=>{setTab(id);if(id==="archive")setSelectedDate(null);}} style={{ padding:"6px 16px", fontSize:11, fontFamily:"monospace", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", border:"none", cursor:"pointer", background:tab===id?"#1d4ed8":"transparent", color:tab===id?"#fff":"#334155", transition:"all 0.15s" }}>{label}</button>
            ))}
          </div>
          <button onClick={()=>{setApiKey("");localStorage.removeItem(API_KEY_STORAGE);}} title="Change API Key" style={{ background:"none", border:"1px solid #1e3a5f", borderRadius:4, color:"#334155", padding:"5px 10px", fontSize:10, fontFamily:"monospace", cursor:"pointer" }}>⚙ KEY</button>
          <button onClick={runAnalysis} style={{ padding:"8px 18px", background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)", border:"none", borderRadius:5, color:"#fff", fontSize:11, fontFamily:"monospace", fontWeight:700, letterSpacing:"0.08em", cursor:"pointer" }}>▶ RUN ANALYSIS</button>
        </div>
      </div>

      {/* STATUS BAR */}
      {(error||currentReport)&&(
        <div style={{ background:"#060f1a", borderBottom:"1px solid #0a1628", padding:"5px 24px", display:"flex", alignItems:"center", gap:14 }}>
          {error
            ? <span style={{ fontSize:11, color:"#f87171", fontFamily:"monospace" }}>⚠ {error}</span>
            : <>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#22d3a8", display:"inline-block", boxShadow:"0 0 5px #22d3a8" }}/>
                <span style={{ fontSize:10, color:"#1e3a5f", fontFamily:"monospace", letterSpacing:"0.06em" }}>
                  LAST REPORT: {currentReport?`${fmtDate(currentReport.reportDate)} ${currentReport.reportTime||""}`:"—"}
                  {reports.length>1?` · ${reports.length} REPORTS`:""}
                </span>
                {selectedDate&&<span style={{ fontSize:10, color:"#f59e0b", fontFamily:"monospace" }}>
                  VIEWING: {fmtDate(selectedDate)} &nbsp;
                  <button onClick={()=>setSelectedDate(null)} style={{ background:"none", border:"none", color:"#f59e0b", cursor:"pointer", fontSize:10, fontFamily:"monospace" }}>× LATEST</button>
                </span>}
              </>
          }
        </div>
      )}

      {/* MAIN */}
      <div style={{ padding:"20px 24px", maxWidth:1400, margin:"0 auto" }}>
        {tab==="dashboard"&&(
          !r
            ? <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:400, gap:14, color:"#1e3a5f" }}>
                <div style={{ fontSize:56, opacity:0.2 }}>◈</div>
                <div style={{ fontSize:14, color:"#1e3a5f", fontFamily:"monospace", textAlign:"center", lineHeight:1.8 }}>NO REPORTS YET<br/><span style={{ fontSize:11 }}>Click ▶ RUN ANALYSIS to start</span></div>
              </div>
            : <>
                {/* Date/Regime row */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ fontSize:22, fontStyle:"italic", color:"#e2e8f0" }}>{fmtDate(r.reportDate)}</div>
                    <RegimeBadge regime={r.marketRegime}/>
                    <span style={{ fontSize:11, color:"#475569", fontFamily:"monospace" }}>{r.cyclePhase}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#334155", fontFamily:"monospace" }}>{r.reportTime}</div>
                </div>

                {/* Macro strip */}
                <div style={{ background:"#060f1a", border:"1px solid #0f2037", borderRadius:8, padding:"12px 16px", marginBottom:14, overflowX:"auto" }}>
                  <div style={{ display:"flex", gap:10, minWidth:"fit-content" }}>
                    <MacroTile label="S&P 500" value={m.spx} change={m.spxChange}/>
                    <MacroTile label="VIX" value={m.vix}/>
                    <MacroTile label="Fed Rate" value={m.fedFundsRate}/>
                    <MacroTile label="CPI" value={m.cpi}/>
                    <MacroTile label="Unemployment" value={m.unemployment}/>
                    <MacroTile label="10Y-2Y" value={m.yieldCurve10Y2Y}/>
                    <MacroTile label="DXY" value={m.dxy}/>
                    <MacroTile label="WTI Crude" value={m.wtiCrude}/>
                    <MacroTile label="GDP Growth" value={m.gdpGrowth}/>
                  </div>
                </div>

                {/* Trend chart */}
                {reports.length>=2&&<div style={{ background:"#060f1a", border:"1px solid #0f2037", borderRadius:8, padding:16, marginBottom:14 }}><TrendChart reports={reports}/></div>}

                {/* Strategist note */}
                {rec.strategistNote&&<div style={{ background:"#060f1a", border:"1px solid #0f2037", borderLeft:"3px solid #1d4ed8", borderRadius:8, padding:"14px 18px", marginBottom:14 }}>
                  <div style={{ fontSize:9, color:"#1e3a5f", letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"monospace", marginBottom:6 }}>Chief Strategist Note</div>
                  <div style={{ fontSize:14, color:"#94a3b8", lineHeight:1.7, fontStyle:"italic" }}>"{rec.strategistNote}"</div>
                  {rec.overallRiskLevel&&<div style={{ marginTop:8, fontSize:10, color:CONFIDENCE_COLORS[rec.overallRiskLevel], fontFamily:"monospace" }}>RISK LEVEL: {rec.overallRiskLevel}</div>}
                </div>}

                {/* Rec cards + sector signals */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 260px", gap:14, marginBottom:14 }}>
                  <RecCard rec={rec.primarySector} primary={true}/>
                  <RecCard rec={rec.secondarySector} primary={false}/>
                  <div style={{ background:"#060f1a", border:"1px solid #0f2037", borderRadius:8, padding:16 }}>
                    <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"monospace", marginBottom:10 }}>Sector Signals</div>
                    {(r.sectorAnalysis||SP500_SECTORS.map(s=>({ticker:s.id,name:s.name,signal:"NEUTRAL",momentum:"WEAK"}))).map((s,i)=><SectorRow key={i} {...s}/>)}
                    {rec.avoidSectors?.length>0&&<div style={{ marginTop:10, borderTop:"1px solid #0d1a29", paddingTop:8 }}>
                      <div style={{ fontSize:9, color:"#7f1d1d", fontFamily:"monospace", marginBottom:5 }}>AVOID</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {rec.avoidSectors.map(s=><span key={s} style={{ fontSize:10, color:"#f87171", background:"#2e0505", borderRadius:3, padding:"1px 8px", fontFamily:"monospace" }}>{s}</span>)}
                      </div>
                    </div>}
                  </div>
                </div>

                {/* News + events */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  <div style={{ background:"#060f1a", border:"1px solid #0f2037", borderRadius:8, padding:16 }}>
                    <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"monospace", marginBottom:10 }}>News Flow</div>
                    {(r.topNews||[]).map((n,i)=><NewsItem key={i} item={n}/>)}
                  </div>
                  <div style={{ background:"#060f1a", border:"1px solid #0f2037", borderRadius:8, padding:16 }}>
                    <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"monospace", marginBottom:10 }}>Economic Calendar</div>
                    {(r.economicEvents||[]).map((e,i)=><EventItem key={i} item={e}/>)}
                  </div>
                </div>
              </>
        )}

        {tab==="archive"&&(
          <div>
            <div style={{ background:"#060f1a", border:"1px solid #0f2037", borderRadius:8, padding:16, marginBottom:14 }}>
              <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"monospace", marginBottom:14, borderBottom:"1px solid #0d1a29", paddingBottom:8 }}>Report Archive</div>
              {reports.length===0
                ? <div style={{ color:"#1e3a5f", fontSize:12, fontFamily:"monospace", padding:"24px 0", textAlign:"center" }}>NO REPORTS SAVED YET</div>
                : [...reports].reverse().map((rp,i)=>{
                    const cc=CONFIDENCE_COLORS[rp.recommendation?.primarySector?.conviction]||"#94a3b8";
                    const active=selectedDate===rp.reportDate;
                    return <div key={i} onClick={()=>{setSelectedDate(rp.reportDate);setTab("dashboard");}} style={{ display:"flex", alignItems:"center", gap:14, padding:"10px 14px", borderRadius:6, cursor:"pointer", marginBottom:4, background:active?"#0a1628":"transparent", border:`1px solid ${active?"#1e3a5f":"transparent"}`, transition:"all 0.15s" }}>
                      <div style={{ fontSize:12, color:"#e2e8f0", fontFamily:"monospace", width:115 }}>{fmtDate(rp.reportDate)}</div>
                      <RegimeBadge regime={rp.marketRegime}/>
                      <div style={{ fontSize:11, color:"#475569", flex:1 }}>{rp.cyclePhase}</div>
                      {rp.recommendation?.primarySector&&<div style={{ fontSize:11, color:cc, fontFamily:"monospace", fontWeight:700 }}>↑ {rp.recommendation.primarySector.ticker}</div>}
                      {rp.recommendation?.secondarySector&&<div style={{ fontSize:11, color:"#334155", fontFamily:"monospace" }}>+ {rp.recommendation.secondarySector.ticker}</div>}
                      <div style={{ fontSize:11, color:"#1e3a5f" }}>→</div>
                    </div>;
                  })
              }
            </div>
            {reports.length>0&&<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:11, color:"#1e3a5f", fontFamily:"monospace" }}>{reports.length} REPORT{reports.length!==1?"S":""} STORED</div>
              <button onClick={clearHistory} style={{ background:"none", border:"1px solid #7f1d1d", color:"#f87171", borderRadius:4, padding:"5px 14px", fontSize:10, fontFamily:"monospace", cursor:"pointer", letterSpacing:"0.08em" }}>CLEAR ARCHIVE</button>
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}
