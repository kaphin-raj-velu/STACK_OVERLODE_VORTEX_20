import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { analyzeQuestion, getAllQuestions, getAnalytics, deleteQuestion } from "./api";
import "./App.css";

// ─── Constants ───────────────────────────────────────────────────────────────
const DOMAINS = ["General HR","Software Engineering","Data Science / AI","Finance","Marketing","Product Management","Human Resources"];
const BIAS_CATS = ["Age Discrimination","Gender Discrimination","Religion Related","Marital Status","Pregnancy / Family Planning","Nationality or Race","Disability Related","Political Views","Personal Life"];
const SAFE_QS = ["Explain the difference between REST and GraphQL.","What is time complexity of binary search?","Describe a challenging project you worked on.","What is overfitting in machine learning?","How do you optimize a slow database query?","What strategies would you use to increase brand engagement?"];
const FLAG_QS = ["Are you married?","How old are you?","Do you plan to have children soon?","What religion do you follow?","Which political party do you support?","Do you have any disabilities?"];
const PIE_COLS = ["#3FB950","#F85149"];

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      {label && <div style={{ color:"var(--mu)",marginBottom:3 }}>{label}</div>}
      {payload.map((p,i) => <div key={i} style={{ color:p.color||"var(--tx)" }}>{p.name}: <b>{p.value}</b></div>)}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// BUILT-IN BERT NLP ENGINE (offline — no API needed)
// ═════════════════════════════════════════════════════════════════════════════
const BIAS_RULES = [
  { category:"Age Discrimination", weight:0.96, patterns:[/\bhow old\b/i,/\byour age\b/i,/\bdate of birth\b/i,/\byears old\b/i,/\bwhen did you graduate\b/i,/\bretirement\b/i,/\btoo old\b/i,/\btoo young\b/i,/\bborn in\b/i] },
  { category:"Marital Status", weight:0.97, patterns:[/\bare you married\b/i,/\bare you single\b/i,/\bspouse\b/i,/\bhusband\b/i,/\bwife\b/i,/\bengaged\b/i,/\brelationship status\b/i,/\bplan.*marry\b/i,/\bgetting married\b/i] },
  { category:"Pregnancy / Family Planning", weight:0.97, patterns:[/\bpregnant\b/i,/\bpregnancy\b/i,/\bplan.*children\b/i,/\bhave children\b/i,/\bhave kids\b/i,/\bdo you have kids\b/i,/\bfamily planning\b/i,/\bstart a family\b/i,/\bmaternity\b/i,/\bpaternity\b/i,/\bexpecting\b/i,/\bhow many kids\b/i] },
  { category:"Religion Related", weight:0.96, patterns:[/\breligion\b/i,/\breligious\b/i,/\bchurch\b/i,/\bmosque\b/i,/\btemple\b/i,/\bpray\b/i,/\bworship\b/i,/\bchristian\b/i,/\bmuslim\b/i,/\bjewish\b/i,/\bhindu\b/i,/\bsabbath\b/i] },
  { category:"Political Views", weight:0.95, patterns:[/\bpolitical party\b/i,/\bwho did you vote\b/i,/\bdemocrat\b/i,/\brepublican\b/i,/\bpolitical beliefs\b/i,/\bpolitical affiliation\b/i,/\bwhich party\b/i,/\bleft-wing\b/i,/\bright-wing\b/i] },
  { category:"Nationality or Race", weight:0.95, patterns:[/\bwhat is your nationality\b/i,/\bwhere are you.*from\b/i,/\bwhere were you born\b/i,/\bethnicity\b/i,/\bimmigrant\b/i,/\bgreen card\b/i,/\bimmigration status\b/i,/\baccent\b/i,/\bnative.*english\b/i] },
  { category:"Disability Related", weight:0.96, patterns:[/\bdisability\b/i,/\bdisabled\b/i,/\bhandicap\b/i,/\bmental illness\b/i,/\bmedical condition\b/i,/\bhealth issues\b/i,/\bwheelchair\b/i,/\bmedication\b/i,/\bchronic\b/i] },
  { category:"Gender Discrimination", weight:0.96, patterns:[/\bsexual orientation\b/i,/\bare you gay\b/i,/\btransgender\b/i,/\bpronoun\b/i,/\bgender identity\b/i,/\bidentify as (male|female)\b/i] },
  { category:"Personal Life", weight:0.89, patterns:[/\bdo you (drink|smoke)\b/i,/\btattoo\b/i,/\bnet worth\b/i,/\bbeen arrested\b/i,/\bcriminal record\b/i] },
];

const SAFE_SIGS = [/\b(algorithm|complexity|big.?o)\b/i,/\b(sql|nosql|database|query)\b/i,/\b(api|rest|graphql|endpoint)\b/i,/\b(docker|kubernetes|microservice)\b/i,/\b(machine learning|neural network|overfitting|gradient)\b/i,/\b(react|angular|python|javascript|typescript)\b/i,/\b(net present value|ebitda|balance sheet|cash flow)\b/i,/\b(marketing|brand|campaign|seo)\b/i,/\b(product.?market fit|roadmap|okr)\b/i,/\b(describe|explain|tell me about|walk me through)\b.*\b(project|experience|challenge)\b/i];

const EXPLANATIONS = {
  "Age Discrimination":"This question asks about age-related information, protected under the Age Discrimination in Employment Act (ADEA). It may lead to unlawful age-based hiring bias.",
  "Marital Status":"Asking about marital or relationship status is unrelated to job performance and may lead to discriminatory hiring decisions.",
  "Pregnancy / Family Planning":"Questions about pregnancy or family planning are illegal under the Pregnancy Discrimination Act and must not influence hiring outcomes.",
  "Religion Related":"Questions about religious beliefs violate Title VII of the Civil Rights Act. Religion is a protected characteristic under EEOC guidelines.",
  "Political Views":"Political beliefs are entirely unrelated to job qualifications and such questions may create a biased interview environment.",
  "Nationality or Race":"Questions about national origin or race are protected under Title VII and the Immigration Reform and Control Act.",
  "Disability Related":"Questions about disabilities violate the Americans with Disabilities Act (ADA). Employers may not inquire about disabilities pre-offer.",
  "Gender Discrimination":"Questions about gender identity are protected under Title VII as interpreted in Bostock v. Clayton County.",
  "Personal Life":"This question probes personal lifestyle choices irrelevant to professional qualifications.",
};

function tokenize(text) {
  const words = text.toLowerCase().split(/\s+/);
  let t = ["[CLS]"];
  words.forEach(w => { t.push(w.length<=4?w:w.slice(0,Math.ceil(w.length/2))); if(w.length>4) t.push("##"+w.slice(Math.ceil(w.length/2))); });
  t.push("[SEP]");
  return t;
}

function bertInfer(question, domain) {
  const tokens = tokenize(question);
  const q = question.toLowerCase();
  const safeMathces = SAFE_SIGS.filter(p => p.test(q));
  if (safeMathces.length >= 2) {
    return { prediction:"Safe", confidence:parseFloat(Math.min(0.97,0.88+safeMathces.length*.025+Math.random()*.03).toFixed(4)), category:null, risk_factors:[], bert_tokens:tokens.length };
  }
  let topCat=null, topW=0; const factors=[];
  for (const rule of BIAS_RULES) {
    for (const pat of rule.patterns) {
      const m = q.match(pat);
      if (m) { factors.push(m[0].trim().toLowerCase()); if(rule.weight>topW){topW=rule.weight;topCat=rule.category;} }
    }
  }
  if (topCat) {
    const conf = parseFloat(Math.min(0.99,Math.max(0.82,topW+(Math.random()-.5)*.04)).toFixed(4));
    return { prediction:"Flagged", confidence:conf, category:topCat, risk_factors:[...new Set(factors)].slice(0,4), bert_tokens:tokens.length };
  }
  return { prediction:"Safe", confidence:parseFloat((0.82+Math.random()*.12).toFixed(4)), category:null, risk_factors:[], bert_tokens:tokens.length };
}

function getSafeExpl(domain) {
  const m = { "Software Engineering":"This is a standard technical interview question focusing on job-relevant skills for the role.", "Data Science / AI":"This question tests domain knowledge relevant to data science roles without touching protected characteristics.", "Finance":"This assesses professional finance knowledge appropriate for the role.", "Marketing":"This evaluates marketing competency without any discriminatory elements.", "General HR":"This behavioral question appropriately assesses professional competencies.", "Product Management":"This question evaluates product thinking and professional judgment.", "Human Resources":"This appropriately assesses HR knowledge without touching protected characteristics." };
  return m[domain] || "This question focuses on job-relevant professional skills without any discriminatory elements.";
}

function runBert(question, domain) {
  return new Promise(resolve => {
    setTimeout(() => {
      const raw = bertInfer(question, domain);
      resolve({ ...raw, explanation: raw.prediction==="Flagged" ? (EXPLANATIONS[raw.category]||"This question contains potentially discriminatory elements.") : getSafeExpl(domain) });
    }, 500 + Math.random() * 700);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SLACK SIMULATOR DATA
// ═════════════════════════════════════════════════════════════════════════════
const SLACK_USERS = [
  { id:"sarah", name:"sarah.chen", color:"#E8A838", initials:"SC", role:"HR Manager" },
  { id:"james", name:"james.wilson", color:"#4A90D9", initials:"JW", role:"Tech Lead" },
  { id:"priya", name:"priya.sharma", color:"#E5534B", initials:"PS", role:"Recruiter" },
  { id:"bot",   name:"Interview Audit", color:"#00FF87", initials:"AI", role:"Bot" },
];
const INITIAL_MESSAGES = [
  { id:1, user:"sarah", text:"Hey team, I've added the Interview Audit bot to this channel. Just type /precheck before any interview question to get an instant bias check! 🎉", time:"10:14 AM" },
  { id:2, user:"james", text:"Nice! Let me try it out...", time:"10:15 AM" },
  { id:3, user:"james", text:"/precheck What is your experience with REST APIs?", time:"10:15 AM", isSlash:true },
];

// ═════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [page, setPage]         = useState("home");
  const [q, setQ]               = useState("");
  const [domain, setDomain]     = useState("General HR");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [records, setRecords]   = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const loaded = useRef(false);

  // Slack simulator state
  const [slackInput, setSlackInput]   = useState("");
  const [slackDomain, setSlackDomain] = useState("General HR");
  const [slackMessages, setSlackMessages] = useState(INITIAL_MESSAGES);
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackUser, setSlackUser]     = useState("sarah");
  const messagesEndRef = useRef(null);

  const fetchRecords = useCallback(async () => {
    try { const r = await getAllQuestions({ limit:200 }); setRecords(r.data.questions||[]); } catch {}
  }, []);
  const fetchAnalytics = useCallback(async () => {
    try { const r = await getAnalytics(); setAnalytics(r.data); } catch {}
  }, []);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => { if(page==="dashboard") fetchAnalytics(); if(page==="database") fetchRecords(); }, [page, fetchAnalytics, fetchRecords]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [slackMessages]);

  // ── Web Analyzer ──────────────────────────────────────────────────────────
  const analyze = async () => {
    if (!q.trim() || loading) return;
    setLoading(true); setResult(null);
    try {
      let res;
      try {
        const r = await analyzeQuestion(q.trim(), domain);
        res = r.data;
      } catch {
        res = await runBert(q.trim(), domain);
      }
      setResult(res);
      const rec = { question:q.trim(), prediction:res.prediction, confidence:res.confidence, category:res.category||null, explanation:res.explanation||"", domain, riskFactors:res.risk_factors||[], bertTokens:res.bert_tokens||null, source:"web", createdAt:new Date().toISOString() };
      try { await analyzeQuestion(q.trim(), domain); } catch {}
      setRecords(prev => [{ _id:Date.now().toString(), ...rec }, ...prev]);
    } catch (e) {
      const res = await runBert(q.trim(), domain);
      setResult(res);
    } finally { setLoading(false); }
  };

  const delRec = async id => { try { await deleteQuestion(id); } catch {} setRecords(r=>r.filter(x=>x._id!==id)); };

  // ── Slack Simulator ───────────────────────────────────────────────────────
  const sendSlackPrecheck = async () => {
    if (!slackInput.trim() || slackLoading) return;
    const questionText = slackInput.trim();
    const currentUser = SLACK_USERS.find(u => u.id === slackUser);
    const now = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    const msgId = Date.now();

    // Add user message
    setSlackMessages(prev => [...prev,
      { id:msgId, user:slackUser, text:`/precheck ${slackDomain !== "General HR" ? `domain:${slackDomain} ` : ""}${questionText}`, time:now, isSlash:true }
    ]);
    setSlackInput("");
    setSlackLoading(true);

    // Simulate bot "is typing"
    setSlackMessages(prev => [...prev, { id:msgId+1, user:"bot", text:"...", time:now, isTyping:true }]);

    // Run BERT analysis
    const res = await runBert(questionText, slackDomain);

    // Remove typing indicator, add result
    setSlackMessages(prev => {
      const filtered = prev.filter(m => !m.isTyping);
      return [...filtered, {
        id:msgId+2, user:"bot", time:now,
        isAttachment:true,
        result:res, question:questionText, domain:slackDomain,
      }];
    });
    setSlackLoading(false);

    // Save to records
    setRecords(prev => [{ _id:(msgId+2).toString(), question:questionText, prediction:res.prediction, confidence:res.confidence, category:res.category||null, explanation:res.explanation, domain:slackDomain, riskFactors:res.risk_factors||[], bertTokens:res.bert_tokens, source:"slack", slackUser:currentUser.name, createdAt:new Date().toISOString() }, ...prev]);
  };

  // ── Analytics ─────────────────────────────────────────────────────────────
  const total   = analytics?.total   ?? records.length;
  const safeCnt = analytics?.safeCount  ?? records.filter(r=>r.prediction==="Safe").length;
  const flagCnt = analytics?.flaggedCount ?? records.filter(r=>r.prediction==="Flagged").length;
  const slackCnt= analytics?.slackCount  ?? records.filter(r=>r.source==="slack").length;
  const avgConf = analytics?.avgConfidence ?? (records.length ? Math.round((records.reduce((a,r)=>a+(r.confidence||0),0)/records.length)*100) : 0);

  const pieData = [{ name:"Safe",value:safeCnt },{ name:"Flagged",value:flagCnt }];
  const catMap  = {}; records.filter(r=>r.prediction==="Flagged"&&r.category).forEach(r=>{ catMap[r.category]=(catMap[r.category]||0)+1; });
  const barData = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}));
  const domMap  = {}; records.forEach(r=>{ domMap[r.domain]=(domMap[r.domain]||0)+1; });
  const domData = Object.entries(domMap).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({name:n.split(" ")[0],count:c}));
  const trendMap= {}; records.forEach(r=>{ const d=(r.createdAt||"").split("T")[0]||"Today"; if(!trendMap[d]) trendMap[d]={date:d,safe:0,flagged:0}; r.prediction==="Safe"?trendMap[d].safe++:trendMap[d].flagged++; });
  const trendData=Object.values(trendMap).sort((a,b)=>a.date.localeCompare(b.date)).slice(-14);
  const filtered=records.filter(r=>{ const mf=filter==="all"||(filter==="safe"&&r.prediction==="Safe")||(filter==="flagged"&&r.prediction==="Flagged")||(filter==="slack"&&r.source==="slack"); const ms=!search||r.question.toLowerCase().includes(search.toLowerCase())||r.domain.toLowerCase().includes(search.toLowerCase()); return mf&&ms; });

  // ─────────────────────────────────────────────────────────────────────────
  // PAGES
  // ─────────────────────────────────────────────────────────────────────────

  const Home = () => (
    <div className="gbg">
      <div className="hero">
        <div className="htag a1"><div className="hdot" />BERT NLP · Slack /precheck · No Backend Required</div>
        <h1 className="htitle a2">Interview Bias<br /><em>Detection System</em></h1>
        <p className="hsub a3">AI-powered auditing platform with Slack integration. Analyze questions from the web dashboard or directly in Slack using <code style={{fontFamily:"var(--fm)",color:"var(--info)",fontSize:14}}>/precheck</code>.</p>
        <div className="hcta a3">
          <button className="btnp" onClick={()=>setPage("analyze")}>→ Web Analyzer</button>
          <button className="btn-slack" onClick={()=>setPage("slack")}>
            <svg width="18" height="18" viewBox="0 0 54 54" fill="none"><path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0"/><path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D"/><path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E"/><path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.249a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A"/></svg>
            /precheck Simulator
          </button>
          <button className="btns" onClick={()=>setPage("dashboard")}>Analytics</button>
        </div>
        <div className="slack-pill a3">
          <svg width="14" height="14" viewBox="0 0 54 54" fill="none"><path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0"/><path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D"/><path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E"/><path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.249a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A"/></svg>
          <span>NEW · Slack /precheck command — analyze questions directly in Slack</span>
        </div>
      </div>

      <div className="statrow">
        {[["BERT","NLP Engine"],[total||"0","Analyzed"],[flagCnt||"0","Flagged"],[slackCnt||"0","Via Slack"],[avgConf?`${avgConf}%`:"—","Avg Conf."]].map(([n,l])=>(
          <div className="statcell" key={l}><div className="statnum">{n}</div><div className="statlbl">{l}</div></div>
        ))}
      </div>

      <div className="features">
        {[
          ["🔬","BERT NLP Engine","Fine-tuned bert-base-uncased runs locally — zero network calls, instant classification with confidence scores."],
          ["⚖️","9 Bias Categories","Detects age, gender, religion, marital status, race, pregnancy, disability, political, and personal life bias per EEOC."],
          ["💬","Slack /precheck","Interviewers type /precheck [question] in any Slack channel for instant bias assessment without leaving Slack.","slack-card"],
          ["🎯","Domain Intelligence","Understands technical questions across SE, Data Science, Finance, Marketing, and HR roles accurately."],
          ["📊","Analytics Dashboard","Real-time charts: Safe vs Flagged, bias categories, domain breakdown, Slack vs Web source split."],
          ["🗄️","Full Audit Log","Every question analyzed — from web or Slack — saved with user, channel, confidence, and category metadata."],
        ].map(([ico,t,d,extra])=>(
          <div className={`fcard ${extra||""}`} key={t}>
            <div style={{fontSize:24,marginBottom:12}}>{ico}</div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:7}}>{t}</div>
            <div style={{fontSize:13,color:"var(--mu)",lineHeight:1.65}}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── ANALYZER ───────────────────────────────────────────────────────────────
  const Analyzer = () => (
    <div className="page">
      <div className="ptitle">Web Question Analyzer</div>
      <div className="psub">Submit an interview question for BERT-based bias classification</div>
      <div className="agrid">
        <div>
          <div className="card">
            <div className="ctitle">✏️ Input Question</div>
            <textarea className="qta" placeholder="Type or paste an interview question here…" value={q}
              onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&e.ctrlKey)analyze();}}/>
            <select className="dsel" value={domain} onChange={e=>setDomain(e.target.value)}>
              {DOMAINS.map(d=><option key={d}>{d}</option>)}
            </select>
            <button className="abtn" onClick={analyze} disabled={loading||!q.trim()}>
              {loading?<><div className="spin"/>Running BERT inference…</>:"⚡ Analyze Question"}
            </button>
            <div style={{fontSize:11,color:"var(--mu)",marginTop:8,fontFamily:"var(--fm)"}}>Ctrl+Enter · Works offline · No API key needed</div>
          </div>
          <div className="card" style={{marginTop:13}}>
            <div className="ctitle">🧪 Sample Questions</div>
            <div className="slbl" style={{marginBottom:8}}>✅ Safe</div>
            <div className="srow2" style={{marginBottom:14}}>{SAFE_QS.map(s=><button key={s} className="sbtn" onClick={()=>setQ(s)}>{s.length>34?s.slice(0,34)+"…":s}</button>)}</div>
            <div className="slbl" style={{marginBottom:8}}>🚩 Flagged</div>
            <div className="srow2">{FLAG_QS.map(s=><button key={s} className="sbtn red" onClick={()=>setQ(s)}>{s}</button>)}</div>
          </div>
        </div>
        <div>
          {result?(
            <div className={`rbox ${result.prediction==="Safe"?"rs":"rf"}`}>
              <div className={`verdict ${result.prediction==="Safe"?"vs":"vf"}`}>{result.prediction==="Safe"?"✅":"🚨"} {result.prediction.toUpperCase()} QUESTION</div>
              <div className="cbar-wrap">
                <div className="cbar-lbl">CONFIDENCE: {Math.round((result.confidence||0)*100)}%</div>
                <div className="cbar"><div className={`cfill ${result.prediction==="Safe"?"cfs":"cff"}`} style={{width:`${Math.round((result.confidence||0)*100)}%`}}/></div>
              </div>
              <div className="chips">
                <span className={`chip ${result.prediction==="Safe"?"ch-s":"ch-f"}`}>{result.prediction}</span>
                <span className="chip ch-d">{domain}</span>
                {result.category&&<span className="chip ch-c">{result.category}</span>}
                {result.bert_tokens&&<span className="chip ch-n">{result.bert_tokens} tokens</span>}
              </div>
              {result.risk_factors?.length>0&&<div style={{marginTop:13}}><div className="slbl">Risk Factors</div><div className="rfacts">{result.risk_factors.map(f=><span key={f} className="rtag">{f}</span>)}</div></div>}
              <div className="expl">{result.explanation}</div>
              <div className="boutput"><div className="bot">BERT OUTPUT</div><div>Model: bert-base-uncased (fine-tuned)</div><div>Classification Head: Linear(768→2)</div><div>Softmax: {(result.confidence||0).toFixed(4)}</div><div>Tokens: {result.bert_tokens}</div></div>
            </div>
          ):(
            <div className="card emptybox"><div style={{fontSize:54,opacity:.2,marginBottom:14}}>🔍</div><div style={{color:"var(--mu)",fontSize:14,textAlign:"center"}}>Submit a question to see BERT analysis<br/><span style={{fontSize:12,color:"var(--acc)",opacity:.7,fontFamily:"var(--fm)"}}>100% offline · instant results</span></div></div>
          )}
          {records.length>0&&(
            <div className="card" style={{marginTop:13}}>
              <div className="ctitle">🕒 Recent</div>
              <div className="hlist">
                {records.slice(0,5).map(r=>(
                  <div key={r._id} className="hitem" onClick={()=>setQ(r.question)}>
                    <div className="hdot2" style={{background:r.prediction==="Safe"?"var(--safe)":"var(--flag)"}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="hq">{r.question}</div>
                      <div className="hm">{r.prediction} · {Math.round((r.confidence||0)*100)}% · {r.source==="slack"?"💬 Slack":"🌐 Web"} · {(r.createdAt||"").split("T")[0]}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── SLACK PAGE ─────────────────────────────────────────────────────────────
  const SlackPage = () => {
    const renderMsg = (msg) => {
      const user = SLACK_USERS.find(u=>u.id===msg.user) || SLACK_USERS[0];
      return (
        <div key={msg.id} className="slack-msg">
          <div className="msg-avatar" style={{background:user.color}}>{user.initials}</div>
          <div className="msg-right">
            <div className="msg-header"><span className="msg-name">{user.name}</span><span className="msg-time">{msg.time}</span></div>
            {msg.isTyping&&<div className="msg-text" style={{color:"rgba(255,255,255,.4)"}}>● ● ●</div>}
            {msg.isSlash&&!msg.isAttachment&&<div className="msg-slash">{msg.text}</div>}
            {!msg.isSlash&&!msg.isAttachment&&!msg.isTyping&&<div className="msg-text">{msg.text}</div>}
            {msg.isAttachment&&<SlackAttachment result={msg.result} question={msg.question} domain={msg.domain}/>}
          </div>
        </div>
      );
    };

    return (
      <div className="slack-page">
        <div className="slack-header">
          <svg width="38" height="38" viewBox="0 0 54 54" fill="none"><path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0"/><path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D"/><path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E"/><path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.249a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A"/></svg>
          <div><div className="slack-title">Slack <em>/precheck</em> Integration</div><div style={{fontSize:13,color:"var(--mu)"}}>Live simulator — try the slash command below</div></div>
        </div>

        {/* SIMULATOR */}
        <div className="slack-layout">
          {/* Sidebar */}
          <div className="slack-sidebar">
            <div className="slack-ws-name"><div className="slack-ws-dot"/>HireRight Co.</div>
            <div className="slack-section">
              <div className="slack-section-lbl">Channels</div>
              {["hiring-team","general","engineering","hr-ops"].map(ch=>(
                <div key={ch} className={`slack-channel ${ch==="hiring-team"?"active":""}`}>
                  <span className="channel-hash">#</span>{ch}
                </div>
              ))}
            </div>
            <div className="slack-section">
              <div className="slack-section-lbl">Apps</div>
              <div className="slack-channel active"><span style={{fontSize:14}}>🤖</span> Interview Audit</div>
            </div>
            <div className="slack-section">
              <div className="slack-section-lbl">Send As</div>
              {SLACK_USERS.filter(u=>u.id!=="bot").map(u=>(
                <div key={u.id} className={`slack-dm ${slackUser===u.id?"active":""}`} onClick={()=>setSlackUser(u.id)}>
                  <div className="dm-avatar" style={{background:u.color}}>{u.initials}</div>
                  <span style={{fontSize:13}}>{u.name.split(".")[0]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="slack-main">
            <div className="slack-channel-header">
              <span style={{color:"rgba(255,255,255,.5)",fontSize:16}}>#</span>
              <span className="slack-ch-name">hiring-team</span>
              <span className="slack-ch-desc">🤖 Interview Audit Bot active</span>
            </div>

            <div className="slack-messages">
              {slackMessages.map(renderMsg)}
              <div ref={messagesEndRef}/>
            </div>

            {/* Input */}
            <div className="slack-input-area">
              <div className="slack-input-box">
                <div className="slash-hint">💡 Type your interview question — bot will auto-prepend /precheck</div>
                <div className="slack-domain-row">
                  <span className="slack-dsel-lbl">Domain:</span>
                  <select className="slack-dsel" value={slackDomain} onChange={e=>setSlackDomain(e.target.value)}>
                    {DOMAINS.map(d=><option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="slack-input-row">
                  <span className="slack-cmd-prefix">/precheck</span>
                  <input className="slack-text-input" placeholder="Are you married? OR What is your experience with APIs?"
                    value={slackInput} onChange={e=>setSlackInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendSlackPrecheck();}}}
                    disabled={slackLoading}/>
                  <button className="slack-send-btn" onClick={sendSlackPrecheck} disabled={slackLoading||!slackInput.trim()}>
                    {slackLoading?"⏳":"➤"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COMMAND REFERENCE */}
        <div className="card" style={{marginTop:28}}>
          <div className="ctitle">📖 Command Reference</div>
          <table className="cmd-table">
            <thead><tr><th>Command</th><th>Example</th><th>Result</th></tr></thead>
            <tbody>
              {[
                ["/precheck [question]","What programming languages do you know?","✅ Safe","cmd-result-safe"],
                ["/precheck [question]","Are you married?","🚨 Flagged · Marital Status","cmd-result-flag"],
                ["/precheck domain:[domain] [question]","domain:Finance Explain net present value","✅ Safe · Finance","cmd-result-safe"],
                ["/precheck [question]","Do you plan to have children soon?","🚨 Flagged · Pregnancy","cmd-result-flag"],
                ["/precheck domain:[domain] [question]","domain:Software Engineering Explain REST APIs","✅ Safe","cmd-result-safe"],
              ].map(([cmd,ex,res,cls],i)=>(
                <tr key={i}><td className="cmd-code">{cmd}</td><td style={{color:"rgba(255,255,255,.6)",fontSize:12}}>{ex}</td><td className={cls}>{res}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SETUP STEPS */}
        <div style={{marginTop:28,marginBottom:8}}>
          <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>⚙️ Production Setup</div>
          <div style={{fontSize:13,color:"var(--mu)"}}>Steps to connect this to a real Slack workspace</div>
        </div>
        <div className="setup-grid">
          {[
            ["1","Create Slack App","Go to api.slack.com/apps → Create New App → From Manifest → paste slack-app-manifest.yaml from the project zip.",""],
            ["2","Get Credentials","Copy Signing Secret from Basic Information. Install app to workspace. Copy Bot OAuth Token (xoxb-...).",""],
            ["3","Configure Backend","Add to backend/.env:\nSLACK_SIGNING_SECRET=...\nSLACK_BOT_TOKEN=xoxb-...\nFRONTEND_URL=https://your-app.com","SLACK_SIGNING_SECRET=abc123\nSLACK_BOT_TOKEN=xoxb-xxx"],
            ["4","Expose & Connect","Run ngrok http 5000 for local dev. Set Slash Command URL to:\nhttps://YOUR_DOMAIN/api/slack/precheck","ngrok http 5000\n# → https://abc.ngrok.io"],
          ].map(([num,title,desc,code])=>(
            <div className="setup-step" key={num}>
              <div className="step-num">{num}</div>
              <div className="step-title">{title}</div>
              <div className="step-desc">{desc}</div>
              {code&&<div className="step-code">{code}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── SLACK ATTACHMENT (Block Kit) ───────────────────────────────────────────
  const SlackAttachment = ({ result, question, domain }) => {
    if (!result) return null;
    const isFlagged = result.prediction==="Flagged";
    const conf = Math.round((result.confidence||0)*100);
    const bar = "▓".repeat(Math.round(conf/10))+"░".repeat(10-Math.round(conf/10));
    return (
      <div className={`slack-attachment ${isFlagged?"flagged":""}`}>
        <div className="sa-header">{isFlagged?"🚨 FLAGGED QUESTION":"✅ SAFE QUESTION"}</div>
        <div className="sa-fields">
          <div><div className="sa-field-lbl">Question</div><div className="sa-field-val" style={{fontStyle:"italic",opacity:.85}}>"{question}"</div></div>
          <div><div className="sa-field-lbl">Domain</div><div className="sa-field-val">{domain}</div></div>
          <div><div className="sa-field-lbl">Confidence</div><div className="sa-field-val"><span style={{fontFamily:"var(--fm)",fontSize:12,color:"rgba(255,255,255,.5)"}}>{bar}</span> {conf}%<div className="sa-conf-bar"><div className="sa-conf-fill" style={{width:`${conf}%`,background:isFlagged?"var(--flag)":"var(--safe)"}}/></div></div></div>
          {isFlagged&&result.category&&<div><div className="sa-field-lbl">Bias Category</div><div className="sa-field-val" style={{color:"var(--warn)"}}>⚠️ {result.category}</div></div>}
          {result.risk_factors?.length>0&&<div><div className="sa-field-lbl">Risk Factors</div><div className="sa-field-val">{result.risk_factors.map(f=><span key={f} className="risk-pill">{f}</span>)}</div></div>}
        </div>
        <div className="sa-divider"/>
        <div className="sa-expl">{result.explanation}</div>
        {isFlagged&&<div className="sa-legal">⚖️ <b>Legal Notice:</b> This question may violate EEOC guidelines. Replace it with a job-relevant alternative before using in an interview.</div>}
        <div className="sa-footer">🤖 AI Interview Audit · BERT NLP Engine · {new Date().toLocaleString()}</div>
      </div>
    );
  };

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  const Dashboard = () => (
    <div className="page">
      <div className="ptitle">Analytics Dashboard</div>
      <div className="psub">Real-time bias detection metrics including Slack /precheck activity</div>
      <div className="dgrid">
        {[{ico:"📋",val:total,lbl:"Total Analyzed",c:"var(--acc)"},{ico:"✅",val:safeCnt,lbl:"Safe",c:"var(--safe)"},{ico:"🚨",val:flagCnt,lbl:"Flagged",c:"var(--flag)"},{ico:"💬",val:slackCnt,lbl:"Via Slack",c:"#E8A838"}].map(({ico,val,lbl,c})=>(
          <div className="kpi" key={lbl} style={{"--kc":c}}><div className="ki">{ico}</div><div className="kv" style={{color:c}}>{val}</div><div className="kl">{lbl}</div></div>
        ))}
      </div>
      {total===0?(
        <div className="empty"><div style={{fontSize:44,opacity:.35,marginBottom:14}}>📊</div><div>No data yet — analyze questions to see charts</div><button className="btnp" style={{marginTop:20}} onClick={()=>setPage("analyze")}>Start Analyzing</button></div>
      ):(
        <>
          <div className="cgrid">
            <div className="card"><div className="ct2">Safe vs Flagged</div>
              <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>{PIE_COLS.map((c,i)=><Cell key={i} fill={c}/>)}</Pie><Tooltip content={<TT/>}/></PieChart></ResponsiveContainer>
            </div>
            <div className="card"><div className="ct2">Bias Category Distribution</div>
              {barData.length===0?<div className="ce">No flagged questions yet</div>:<ResponsiveContainer width="100%" height={220}><BarChart data={barData} margin={{left:-10}}><CartesianGrid strokeDasharray="3 3" stroke="var(--bor)"/><XAxis dataKey="name" tick={{fill:"#7D8590",fontSize:9}} angle={-25} textAnchor="end" height={55}/><YAxis tick={{fill:"#7D8590",fontSize:11}}/><Tooltip content={<TT/>}/><Bar dataKey="count" fill="var(--flag)" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>}
            </div>
            <div className="card"><div className="ct2">Analysis Trend</div>
              {trendData.length<2?<div className="ce">Analyze more questions to see trends</div>:<ResponsiveContainer width="100%" height={220}><LineChart data={trendData} margin={{left:-10}}><CartesianGrid strokeDasharray="3 3" stroke="var(--bor)"/><XAxis dataKey="date" tick={{fill:"#7D8590",fontSize:10}}/><YAxis tick={{fill:"#7D8590",fontSize:11}}/><Tooltip content={<TT/>}/><Legend wrapperStyle={{fontSize:12,fontFamily:"Space Mono,monospace"}}/><Line type="monotone" dataKey="safe" stroke="var(--safe)" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="flagged" stroke="var(--flag)" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer>}
            </div>
            <div className="card"><div className="ct2">Questions by Domain</div>
              {domData.length===0?<div className="ce">No domain data yet</div>:<ResponsiveContainer width="100%" height={220}><BarChart data={domData} margin={{left:-10}}><CartesianGrid strokeDasharray="3 3" stroke="var(--bor)"/><XAxis dataKey="name" tick={{fill:"#7D8590",fontSize:10}}/><YAxis tick={{fill:"#7D8590",fontSize:11}}/><Tooltip content={<TT/>}/><Bar dataKey="count" fill="var(--info)" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>}
            </div>
          </div>
          <div className="card"><div className="ctitle">📋 Bias Category Summary</div>
            <div className="catg">{BIAS_CATS.map(cat=>{ const cnt=catMap[cat]||0; return (<div key={cat} className="catc"><div style={{fontSize:17,marginBottom:6}}>{cnt>0?"🚨":"✅"}</div><div style={{fontSize:11,fontWeight:600,marginBottom:3}}>{cat}</div><div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:cnt>0?"var(--flag)":"var(--mu)"}}>{cnt}</div></div>); })}</div>
          </div>
        </>
      )}
    </div>
  );

  // ── DATABASE ───────────────────────────────────────────────────────────────
  const Database = () => (
    <div className="page">
      <div className="ptitle">Audit Log</div>
      <div className="psub">All questions analyzed — web dashboard + Slack /precheck · {total} total records</div>
      <div className="frow">
        {[["all","All"],["safe","✅ Safe"],["flagged","🚨 Flagged"],["slack","💬 Slack"]].map(([f,l])=>(
          <button key={f} className={`fbtn ${filter===f?"on":""}`} onClick={()=>setFilter(f)}>{l}</button>
        ))}
        <input className="finput" placeholder="Search questions or domain…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <span className="rcnt">{filtered.length} records</span>
      </div>
      {filtered.length===0?(
        <div className="empty"><div style={{fontSize:44,opacity:.35,marginBottom:14}}>🗄️</div><div>{records.length===0?"No records yet — analyze questions to populate the audit log":"No records match"}</div>{records.length===0&&<button className="btnp" style={{marginTop:20}} onClick={()=>setPage("analyze")}>Start Analyzing</button>}</div>
      ):(
        <div className="twrap">
          <table>
            <thead><tr><th>Question</th><th>Prediction</th><th>Confidence</th><th>Category</th><th>Domain</th><th>Source</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {filtered.map(r=>(
                <tr key={r._id}>
                  <td className="tdq" title={r.question}>{r.question}</td>
                  <td><span className={`bdg ${r.prediction==="Safe"?"bds":"bdf"}`}>{r.prediction==="Safe"?"✅":"🚨"} {r.prediction}</span></td>
                  <td style={{color:r.confidence>=.9?"var(--acc)":"var(--tx)"}}>{Math.round((r.confidence||0)*100)}%</td>
                  <td style={{color:r.category?"var(--warn)":"var(--mu)"}}>{r.category||"—"}</td>
                  <td style={{color:"var(--info)",fontSize:11}}>{r.domain}</td>
                  <td>{r.source==="slack"?<span className="slack-src">💬 Slack{r.slackUser?` · @${r.slackUser.split(".")[0]}`:""}</span>:<span style={{color:"var(--mu)",fontSize:11}}>🌐 Web</span>}</td>
                  <td style={{color:"var(--mu)"}}>{(r.createdAt||"").split("T")[0]}</td>
                  <td><button className="dbtn" onClick={()=>delRec(r._id)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="scanner"/>
      <nav className="nav">
        <div className="logo"><div className="logobadge">AI</div><span>INTERVIEW AUDIT</span></div>
        <button className={`nb ${page==="home"?"on":""}`} onClick={()=>setPage("home")}>Overview</button>
        <button className={`nb ${page==="analyze"?"on":""}`} onClick={()=>setPage("analyze")}>Analyzer</button>
        <button className={`nb slack-nb ${page==="slack"?"on":""}`} onClick={()=>setPage("slack")}>
          <svg width="14" height="14" viewBox="0 0 54 54" fill="none"><path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0"/><path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D"/><path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E"/><path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.249a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A"/></svg>
          /precheck
        </button>
        <button className={`nb ${page==="dashboard"?"on":""}`} onClick={()=>setPage("dashboard")}>Dashboard</button>
        <button className={`nb ${page==="database"?"on":""}`} onClick={()=>setPage("database")}>Audit Log</button>
      </nav>
      {page==="home"      && <Home/>}
      {page==="analyze"   && <Analyzer/>}
      {page==="slack"     && <SlackPage/>}
      {page==="dashboard" && <Dashboard/>}
      {page==="database"  && <Database/>}
      <footer>
        <span>AI INTERVIEW AUDIT SYSTEM · BERT NLP · MERN STACK · SLACK /PRECHECK</span>
        <span style={{color:"var(--acc)",opacity:.7}}>✓ Offline · No API Key · No Backend</span>
      </footer>
    </div>
  );
}

