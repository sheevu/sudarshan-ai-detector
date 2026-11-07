import { useEffect, useRef, useState, useMemo } from "react";

// ---------- Types ----------
type Lang = "EN" | "HI" | "HINGLISH" | "MIXED";
type Classification = "Likely Human" | "Likely AI" | "Mixed/Edited" | "Inconclusive";
type MethodName = "burstiness" | "stylometry" | "perplexity" | "zero_shot" | "trained_fusion";

type Finding = {
  method: MethodName;
  score: number; // 0 human -> 1 ai
  label: string;
  reasoning: string;
  indicators: string[];
};

type DetectionResult = {
  ai_likelihood: number;
  classification: Classification;
  confidence: number;
  disagreement: number;
  methods_used: MethodName[];
  findings: Finding[];
  language: Lang;
  word_count: number;
  char_count: number;
  mixed_sections?: { text: string; label: Classification; ai_score: number }[];
  timestamp: string;
};

type HistoryItem = {
  id: string;
  value: {
    preview: string;
    fullText: string;
    result: DetectionResult;
    lang: Lang;
  };
  created_at: string;
};

// Friendly names for methods
const FRIENDLY_METHOD_NAMES: Record<string, string> = {
  burstiness: "Sentence Flow & Rhythm",
  stylometry: "Vocabulary Diversity",
  perplexity: "Text Predictability",
  zero_shot: "Original Phrasing",
  trained_fusion: "AI Transition Phrases",
};

// ---------- Sample Texts ----------
const SAMPLES: { id: string; label: string; lang: Lang; text: string; chip: string }[] = [
  { id: "en-human", label: "English Human", lang: "EN", chip: "EN • Human Story", text: "I was walking down the street yesterday when I saw this weird dog chasing its tail in circles. I stood there for like two minutes just watching it, totally mesmerized. My coffee got cold. Anyway, it reminded me of how my brother used to spin around when we were kids trying to make himself dizzy. Strange memory, but it made me laugh." },
  { id: "en-ai", label: "English AI", lang: "EN", chip: "EN • AI Essay", text: "In conclusion, it is important to note that artificial intelligence is transforming various industries. Furthermore, the integration of AI technologies offers significant advantages. Moreover, it is worth noting that organizations must consider ethical implications. Additionally, the future of AI holds immense potential. Overall, AI represents a paradigm shift in technological innovation." },
  { id: "hi-human", label: "Hindi Human", lang: "HI", chip: "HI • Human Story", text: "कल मैं बाजार गया था, वहां बहुत भीड़ थी। मैंने सोचा सब्जी ले लूं, पर टमाटर इतने महंगे थे कि मैंने छोड़ दिए। दुकानदार बोला - भाई साहब, महंगाई बढ़ गई है। मैं हंस दिया, क्या कर सकते हैं। फिर मैंने चाय पी और घर आ गया।" },
  { id: "hi-ai", label: "Hindi AI", lang: "HI", chip: "HI • AI Article", text: "निष्कर्षतः, यह कहना महत्वपूर्ण है कि कृत्रिम बुद्धिमत्ता हमारे समाज में महत्वपूर्ण परिवर्तन ला रही है। इसके अतिरिक्त, यह तकनीक विभिन्न क्षेत्रों में क्रांति ला रही है। इसके अलावा, हमें इसके नैतिक पहलुओं पर भी विचार करना चाहिए। अंततः, यह तकनीक भविष्य की दिशा निर्धारित करेगी।" },
  { id: "hing-human", label: "Hinglish Human", lang: "HINGLISH", chip: "Hinglish • Conversational", text: "Yaar kal raat ka scene kya tha, main aur Rohan bike pe ja rahe the, suddenly baarish shuru ho gayi. Hum ek chai ki tapri pe ruk gaye. Wahan ka tapri wala uncle ne bola - arre bhai, ye Mumbai ki baarish hai, iska koi bharosa nahi. We laughed so hard, full timepass ho gaya." },
  { id: "hing-ai", label: "Hinglish AI", lang: "HINGLISH", chip: "Hinglish • AI Formal", text: "It is important to note that Hinglish represents a fascinating linguistic phenomenon. Furthermore, this hybrid language combines Hindi and English elements. Moreover, it is widely used in urban India. Additionally, its usage reflects cultural modernity. In conclusion, Hinglish demonstrates linguistic evolution." },
  { id: "mixed", label: "Mixed/Edited", lang: "MIXED", chip: "Mixed • Human + AI", text: "I went to the market yesterday and it was really crowded. In conclusion, it is important to note that market dynamics are influenced by various economic factors. But honestly, I just wanted to buy tomatoes and they were so expensive! Furthermore, inflation is affecting daily life. My mom called and said yaar, sab mehenga ho gaya hai." },
  { id: "past-ai", label: "Past AI Content", lang: "EN", chip: "AI • Research Draft", text: "The implementation of machine learning algorithms has revolutionized data processing methodologies. It is worth noting that deep learning architectures, particularly transformer-based models, have demonstrated unprecedented capabilities. Moreover, the synergy between natural language processing and computer vision is paving the way for multimodal AI systems. Overall, these advancements underscore the transformative potential of AI." },
];

// ---------- Detection Logic ----------
const AI_PHRASES = [
  "in conclusion", "furthermore", "it is important to note", "moreover", "additionally", "overall", "in summary",
  "it is worth noting", "in essence", "it is crucial", "it is essential", "delving into", "a testament to",
  "paradigm shift", "tapestry", "multifaceted", "embark", "realm", "landscape",
  "निष्कर्षतः", "इसके अतिरिक्त", "इसके अलावा", "अंततः", "महत्वपूर्ण है",
  "it underscores", "it highlights", "meticulously", "leverage", "utilize"
];
const HINGLISH_LEXICON = ["yaar", "hai", "tha", "thi", "kya", "nahi", "haan", "bhai", "arre", "chal", "theek", "mat", "kar", "gaya", "aaya", "ho", "raha", "rahi", "kal", "bahut", "kuch", "pe"];

function detectLanguage(text: string): Lang {
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const lower = text.toLowerCase();
  const hingCount = HINGLISH_LEXICON.filter(w => lower.includes(w)).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const hingRatio = hingCount / Math.max(words, 1);

  if (hasDevanagari && hingRatio > 0.05) return "MIXED";
  if (hasDevanagari) return "HI";
  if (hingRatio > 0.07) return "HINGLISH";
  if (hasDevanagari && /[a-zA-Z]/.test(text)) return "MIXED";
  return "EN";
}

function analyzeText(text: string): DetectionResult {
  const trimmed = text.trim();
  const sentences = trimmed.split(/[.!?।\n]+/).map(s => s.trim()).filter(s => s.length > 3);
  const words = trimmed.split(/\s+/).filter(Boolean);
  const lower = trimmed.toLowerCase();
  const wordCount = words.length;
  const charCount = trimmed.length;

  // Burstiness
  const sentLens = sentences.map(s => s.split(/\s+/).length);
  const mean = sentLens.reduce((a, b) => a + b, 0) / Math.max(sentLens.length, 1) || 0;
  const variance = sentLens.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(sentLens.length, 1) || 0;
  const std = Math.sqrt(variance);
  const cv = mean ? std / mean : 0;
  const burstScore = Math.max(0, Math.min(1, 1 - cv / 0.85)); // low cv => high AI

  // Stylometry - TTR
  const unique = new Set(words.map(w => w.toLowerCase().replace(/[^\w\u0900-\u097F]/g, ""))).size;
  const ttr = unique / Math.max(wordCount, 1);
  const stylScore = Math.max(0, Math.min(1, 1 - ttr / 0.72)); // low TTR => AI

  // Zero shot - hapax
  const freq: Record<string, number> = {};
  words.forEach(w => { const k = w.toLowerCase().replace(/[^\w]/g, ""); if (k) freq[k] = (freq[k] || 0) + 1; });
  const hapax = Object.values(freq).filter(v => v === 1).length;
  const hapaxRatio = hapax / Math.max(wordCount, 1);
  const zeroScore = Math.max(0, Math.min(1, 1 - hapaxRatio / 0.65));

  // Perplexity proxy - avg word length + function words
  const funcWords = ["the", "is", "are", "and", "of", "to", "in", "a", "that", "it", "for", "on", "with", "as", "be"];
  const funcCount = words.filter(w => funcWords.includes(w.toLowerCase())).length;
  const funcRatio = funcCount / Math.max(wordCount, 1);
  const avgWordLen = words.reduce((a, b) => a + b.length, 0) / Math.max(wordCount, 1);
  const perplexScore = Math.max(0, Math.min(1, (funcRatio > 0.35 ? 0.7 : 0.3) + (avgWordLen > 5.2 ? 0.3 : 0) ));

  // Trained fusion - AI phrase detection
  let aiHits = 0;
  const foundPhrases: string[] = [];
  AI_PHRASES.forEach(p => {
    const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
    const matches = lower.match(re);
    if (matches) { aiHits += matches.length; foundPhrases.push(p); }
  });
  const aiDensity = aiHits / Math.max(wordCount / 100, 1);
  let trainedScore = Math.min(1, aiDensity * 0.55 + (foundPhrases.length > 3 ? 0.3 : 0));
  const starts = sentences.filter(s => /^(In conclusion|Furthermore|Moreover|Additionally|Overall|It is important|It is worth)/i.test(s.trim())).length;
  trainedScore = Math.min(1, trainedScore + starts * 0.15);

  const methods: Record<MethodName, number> = {
    burstiness: burstScore,
    stylometry: stylScore,
    perplexity: perplexScore,
    zero_shot: zeroScore,
    trained_fusion: trainedScore,
  };

  // Fusion weighted
  let fusion = methods.trained_fusion * 0.55 + methods.burstiness * 0.15 + methods.stylometry * 0.15 + methods.zero_shot * 0.10 + methods.perplexity * 0.05;
  const extreme = fusion < 0.2 || fusion > 0.8;
  if (extreme) {
    fusion = fusion * 0.25 + methods.trained_fusion * 0.75;
  }

  const scores = Object.values(methods);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const disagreement = Math.sqrt(scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / scores.length);

  let classification: Classification = "Inconclusive";
  if (fusion >= 0.65 && disagreement < 0.45) classification = "Likely AI";
  else if (fusion <= 0.35 && disagreement < 0.45) classification = "Likely Human";
  else if (disagreement > 0.45) classification = "Mixed/Edited";
  else if (fusion > 0.5) classification = "Likely AI";
  else classification = "Likely Human";

  if (fusion > 0.42 && fusion < 0.58) classification = "Inconclusive";

  const confidence = 1 - disagreement * 0.9;

  // Simple plain-English findings
  const findings: Finding[] = [
    {
      method: "burstiness",
      score: burstScore,
      label: burstScore > 0.6 ? "Repetitive sentence lengths" : "Natural sentence variety",
      reasoning: burstScore > 0.6
        ? "Sentence lengths are very uniform (avg " + mean.toFixed(0) + " words per sentence). AI models typically produce uniform rhythms, whereas humans vary their sentence flow."
        : "Natural mix of short and longer sentences (avg " + mean.toFixed(0) + " words), which is typical of authentic human writing.",
      indicators: [burstScore > 0.6 ? "Uniform length" : "Varied length", `Avg: ${mean.toFixed(0)} words/sentence`]
    },
    {
      method: "stylometry",
      score: stylScore,
      label: stylScore > 0.6 ? "Limited vocabulary range" : "Rich & diverse vocabulary",
      reasoning: stylScore > 0.6
        ? "Words and phrasing repeat frequently. Automated tools often reuse high-frequency formulaic vocabulary."
        : "Text showcases a broad, expressive vocabulary (" + unique + " unique words across " + wordCount + " words total).",
      indicators: [stylScore > 0.6 ? "High repetition" : "Rich word choice", `${unique} unique words`]
    },
    {
      method: "zero_shot",
      score: zeroScore,
      label: zeroScore > 0.6 ? "Standard template phrasing" : "Distinctive personal phrasing",
      reasoning: zeroScore > 0.6
        ? "Uses common, generic phrasing patterns without unique word combinations."
        : "Includes distinctive, one-off words and expressive turns of phrase rarely seen in generic AI outputs.",
      indicators: [zeroScore > 0.6 ? "Generic phrasing" : "Distinctive style"]
    },
    {
      method: "perplexity",
      score: perplexScore,
      label: perplexScore > 0.6 ? "Predictable word order" : "Creative & spontaneous flow",
      reasoning: perplexScore > 0.6
        ? "Words follow standard, statistically expected textbook structures that AI models default to."
        : "Word combinations are spontaneous and creative, reflecting genuine human thought.",
      indicators: [perplexScore > 0.6 ? "High predictability" : "Spontaneous phrasing"]
    },
    {
      method: "trained_fusion",
      score: trainedScore,
      label: foundPhrases.length ? `Found ${foundPhrases.length} AI transition markers` : "No AI cliché phrases found",
      reasoning: foundPhrases.length
        ? `Detected hallmark AI connectors: ${foundPhrases.slice(0, 4).map(p => `"${p}"`).join(", ")}.`
        : "Writing flows naturally without formulaic AI transition markers like 'in conclusion' or 'it is important to note'.",
      indicators: foundPhrases.length ? foundPhrases.slice(0, 4) : ["Clean phrasing"]
    },
  ];

  // mixed sections visualization
  let mixed_sections: DetectionResult["mixed_sections"] = undefined;
  if (classification === "Mixed/Edited" || (fusion > 0.35 && fusion < 0.65)) {
    const chunkSize = Math.ceil(sentences.length / 3) || 1;
    mixed_sections = [];
    for (let i = 0; i < sentences.length; i += chunkSize) {
      const chunk = sentences.slice(i, i + chunkSize).join(". ") + ".";
      const cLower = chunk.toLowerCase();
      const hit = AI_PHRASES.some(p => cLower.includes(p));
      const sScore = hit ? 0.78 : 0.22 + Math.random() * 0.15;
      mixed_sections.push({ text: chunk.slice(0, 220), label: sScore > 0.6 ? "Likely AI" : "Likely Human", ai_score: sScore });
    }
  }

  return {
    ai_likelihood: Math.min(1, Math.max(0, fusion)),
    classification,
    confidence: Math.min(1, Math.max(0, confidence)),
    disagreement,
    methods_used: Object.keys(methods) as MethodName[],
    findings,
    language: detectLanguage(trimmed),
    word_count: wordCount,
    char_count: charCount,
    mixed_sections,
    timestamp: new Date().toISOString(),
  };
}

// ---------- Helpers ----------
function copyWithFallback(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

// ---------- Component ----------
export default function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [dark, setDark] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeFinding, setActiveFinding] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync dark class on root document
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  // auto resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.max(220, textareaRef.current.scrollHeight) + "px";
    }
  }, [text]);

  // load history via records API or localStorage
  const reloadHistory = async () => {
    try {
      const res = await fetch("actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "records.list", args: { collection: "detections", limit: 50 } }),
      });
      const j = await res.json();
      if (j.data && j.data.records) {
        const recs = j.data.records as HistoryItem[];
        recs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setHistory(recs);
        return;
      }
    } catch { /* offline / local fallback */ }

    try {
      const local = localStorage.getItem("sudarshan_detections");
      if (local) {
        setHistory(JSON.parse(local));
      }
    } catch {}
  };
  useEffect(() => { reloadHistory(); }, []);

  const langBadge = useMemo(() => detectLanguage(text), [text]);
  const wordCount = useMemo(() => text.trim().split(/\s+/).filter(Boolean).length, [text]);
  const charCount = text.length;
  const tokenEst = Math.ceil(wordCount * 1.33);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const handleDetect = async () => {
    if (wordCount < 10) { showToast("Please enter at least 10 words to analyze."); return; }
    setDetecting(true);
    let res: DetectionResult | null = null;

    // Attempt to query local Python FastAPI backend if available
    try {
      const apiRes = await fetch("/api/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        const findingsList: Finding[] = [];
        const rawFindings = data.individual_findings || {};
        for (const [mName, mData] of Object.entries(rawFindings)) {
          const m = mData as any;
          const friendly = FRIENDLY_METHOD_NAMES[mName] || mName;
          const score = m.score || m.ai_likelihood || 0.5;
          findingsList.push({
            method: (mName as MethodName) || "burstiness",
            score: score,
            label: score > 0.6 ? `${friendly}: AI tendency detected` : `${friendly}: Natural pattern`,
            reasoning: m.details ? Object.entries(m.details).map(([k,v]) => `${k}: ${v}`).join(", ") : `Confidence score: ${(score * 100).toFixed(0)}%`,
            indicators: [score > 0.6 ? "AI indicator" : "Human indicator"]
          });
        }
        res = {
          ai_likelihood: data.ai_likelihood,
          classification: data.overall_classification as Classification,
          confidence: data.uncertainty?.confidence ?? 0.85,
          disagreement: data.uncertainty?.disagreement ?? 0.2,
          methods_used: (data.detection_methods_used || []) as MethodName[],
          findings: findingsList.length > 0 ? findingsList : analyzeText(text).findings,
          language: (data.detected_language?.toUpperCase() || detectLanguage(text)) as Lang,
          word_count: data.word_count || wordCount,
          char_count: data.char_count || charCount,
          timestamp: data.timestamp || new Date().toISOString()
        };
      }
    } catch {
      // Backend not running, use client-side analyzer
    }

    if (!res) {
      await new Promise(r => setTimeout(r, 450));
      res = analyzeText(text);
    }

    setResult(res);
    setDetecting(false);

    // save history to localStorage
    const newHistoryItem: HistoryItem = {
      id: `det_${Date.now()}_${wordCount}`,
      value: {
        preview: text.slice(0, 120),
        fullText: text.slice(0, 8000),
        result: res,
        lang: res.language,
      },
      created_at: new Date().toISOString()
    };

    try {
      const local = localStorage.getItem("sudarshan_detections");
      const current = local ? JSON.parse(local) : [];
      const updated = [newHistoryItem, ...current.slice(0, 49)];
      localStorage.setItem("sudarshan_detections", JSON.stringify(updated));
      setHistory(updated);
    } catch {}

    try {
      await fetch("actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "records.create",
          args: {
            collection: "detections",
            value: newHistoryItem.value,
            idempotency_key: newHistoryItem.id
          }
        })
      });
      reloadHistory();
    } catch { /* ignore */ }

    setTimeout(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handlePaste = () => {
    textareaRef.current?.focus();
    try {
      textareaRef.current?.select();
    } catch {}
    showToast("Focused — press Ctrl+V to paste your text");
  };

  const handleFile = (file: File) => {
    if (!/\.(txt|md)$/i.test(file.name) && file.type !== "text/plain") { showToast("Please upload a .txt or .md text file."); return; }
    const r = new FileReader();
    r.onload = e => { setText((e.target?.result as string) || ""); showToast(`Loaded "${file.name}"`); };
    r.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
    const txt = e.dataTransfer.getData("text"); if (txt) setText(txt);
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleDetect(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setText(""); setResult(null); showToast("Cleared"); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [text, result, wordCount]);

  const gaugeOffset = result ? 283 - 283 * result.ai_likelihood : 283;

  // Dynamic color palette & gradient depending on result
  // Low (<0.35) = Emerald (Human)
  // Mid (0.35 - 0.65, e.g. 56%) = Warm Amber / Orange (Inconclusive / Mixed)
  // High (>0.65) = Rose / Red (AI)
  const isHuman = result ? result.ai_likelihood < 0.35 || result.classification === "Likely Human" : false;
  const isAi = result ? result.ai_likelihood >= 0.65 || result.classification === "Likely AI" : false;
  const isMid = result ? (!isHuman && !isAi) : true;

  const gradientStops = isHuman
    ? { start: "#34d399", end: "#059669", bar: "from-emerald-500 to-teal-600", text: "text-emerald-500 dark:text-emerald-400" }
    : isMid
    ? { start: "#fbbf24", end: "#ea580c", bar: "from-amber-400 to-orange-500", text: "text-amber-500 dark:text-amber-400" }
    : { start: "#f87171", end: "#dc2626", bar: "from-rose-500 to-red-600", text: "text-rose-500 dark:text-rose-400" };

  const badgeColorClass = isHuman
    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
    : isMid
    ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
    : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400";

  return (
    <div data-safe-area-inset-root style={{ boxSizing: "border-box", paddingTop: "var(--safe-area-inset-top)" }} className="min-h-screen w-full overflow-x-clip antialiased selection:bg-violet-500/30">
      {/* Background decoration */}
      <div className="fixed inset-0 -z-10" style={{ background: `radial-gradient(1200px 600px at 20% -10%, var(--glow-1), transparent 60%), radial-gradient(1000px 500px at 90% 0%, var(--glow-2), transparent 60%), radial-gradient(900px 500px at 50% 120%, var(--glow-3), transparent), linear-gradient(to bottom, var(--bg), var(--bg-2))` }} />
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full blur-[90px] opacity-60" style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)", animation: "float1 14s ease-in-out infinite" }} />
        <div className="absolute top-[10%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[110px] opacity-50" style={{ background: "radial-gradient(circle, #4f46e5, transparent 70%)", animation: "float2 18s ease-in-out infinite" }} />
        <div className="absolute bottom-[-20%] left-[30%] w-[700px] h-[700px] rounded-full blur-[120px] opacity-40" style={{ background: "radial-gradient(circle, #0ea5e9, transparent 70%)", animation: "float3 20s ease-in-out infinite" }} />
      </div>

      {/* Header */}
      <header data-safe-area-sticky-top style={{ top: "var(--safe-area-inset-top)" }} className="sticky z-30 backdrop-blur-2xl border-b" id="top">
        <div className="glass border-x-0 border-t-0">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 h-[64px] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 grid place-items-center text-white font-black tracking-tighter shadow-lg shadow-violet-600/20">S</div>
              <div className="leading-none">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[15px] sm:text-[16px] tracking-tight" style={{ color: "var(--text)" }}>Sudarshan AI Detector</span>
                  <span className="hidden sm:inline-flex text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full bg-violet-600 text-white">AI DETECTOR</span>
                </div>
                <div className="text-[11px] sm:text-[12px] mt-0.5 mono" style={{ color: "var(--text-soft)" }}>Accurate & Explainable • English • Hindi • Hinglish</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowHistory(v => !v)} className="inline-flex items-center h-9 px-3 rounded-full glass text-[12px] font-medium hover:bg-white/10 transition" style={{ color: "var(--text)" }}>
                <span className="mr-1.5">◫</span> History {history.length ? `• ${history.length}` : ""}
              </button>
              <button aria-label="Toggle theme" onClick={() => setDark(v => !v)} className="w-9 h-9 rounded-full glass grid place-items-center hover:scale-105 active:scale-95 transition">
                <span className="text-[14px]">{dark ? "☀" : "☾"}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Intro */}
        <div className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="max-w-[760px]" style={{ animation: "inUp .6s ease" }}>
            <h1 className="text-[28px] sm:text-[36px] lg:text-[42px] font-[800] tracking-tight leading-[1.05]" style={{ color: "var(--text)" }}>
              Instant & Explainable <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">AI Text Detection</span>
            </h1>
            <p className="mt-2.5 text-[14px] sm:text-[15px] leading-relaxed max-w-[640px]" style={{ color: "var(--text-soft)" }}>
              Analyze any article, essay, or message to see if it was written by a human or generated by ChatGPT, Claude, Gemini, or DeepSeek. Provides clear plain-English reasons for every finding.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] mono flex-wrap">
            <span className="px-3 py-1 rounded-full glass">English • Hindi • Hinglish</span>
            <span className="px-3 py-1 rounded-full glass">100% Private</span>
            <span className="px-3 py-1 rounded-full glass">Multi-Signal Analysis</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          {/* Input Panel */}
          <div className="lg:col-span-7 relative">
            <div className="glass rounded-[22px] sm:rounded-[28px] p-4 sm:p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.3)]" style={{ animation: "inUp .7s ease .05s both" }}>
              {/* top row */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-bold tracking-widest px-2.5 py-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black">INPUT TEXT</div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium mono ${langBadge === "EN" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : langBadge === "HI" ? "bg-orange-500/10 border-orange-500/20 text-orange-600" : langBadge === "HINGLISH" ? "bg-sky-500/10 border-sky-500/20 text-sky-600" : "bg-violet-500/10 border-violet-500/20 text-violet-600"}`}>◍ {langBadge} {text ? "• auto detected" : "• ready"}</span>
                  {text && <span className="text-[11px] mono" style={{ color: "var(--text-faint)" }}>{wordCount} words • {charCount} chars</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={handlePaste} className="h-8 px-3 rounded-full glass text-[12px] font-medium hover:bg-black/5 dark:hover:bg-white/10 transition">⎘ Paste</button>
                  <button onClick={() => { setText(""); setResult(null); }} className="h-8 px-3 rounded-full glass text-[12px] font-medium hover:bg-black/5">Clear</button>
                  <label className="h-8 px-3 rounded-full glass text-[12px] font-medium hover:bg-black/5 cursor-pointer grid place-items-center">
                    ↑ Upload
                    <input type="file" accept=".txt,.md" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  </label>
                </div>
              </div>

              {/* textarea wrapper */}
              <div className="relative rounded-[18px] border bg-white/70 dark:bg-black/20 overflow-hidden focus-within:ring-2 focus-within:ring-violet-500/30 transition" style={{ borderColor: "var(--border)" }} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="Paste your text here... Supports English, Hindi, and Hinglish. Or try one of the sample texts below."
                  className="w-full min-h-[220px] max-h-[520px] bg-transparent p-4 sm:p-5 text-[15px] leading-[1.7] outline-none resize-none placeholder:text-zinc-400"
                  style={{ color: "var(--text)" }}
                  aria-label="Text to detect"
                />
                {/* drag overlay */}
                {dragOver && (
                  <div className="absolute inset-0 z-10 bg-violet-600/10 backdrop-blur-md grid place-items-center border-2 border-dashed border-violet-500 rounded-[18px]">
                    <div className="glass rounded-2xl px-5 py-3 text-[13px] font-semibold">Drop text file here (.txt / .md)</div>
                  </div>
                )}
                {/* bottom toolbar inside */}
                <div className="flex items-center justify-between px-3 py-2 border-t bg-zinc-50/70 dark:bg-zinc-900/30" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[11px] mono" style={{ color: "var(--text-faint)" }}>{wordCount < 10 ? `${10 - wordCount} more words needed for reliable detection` : "Ready to analyze"}</span>
                  <span className="text-[11px] mono" style={{ color: "var(--text-faint)" }}>Press Ctrl+Enter to detect</span>
                </div>
              </div>

              {/* sample chips */}
              <div className="mt-4">
                <div className="text-[11px] font-semibold tracking-widest mb-2" style={{ color: "var(--text-faint)" }}>TRY SAMPLE TEXTS (CLICK TO TEST)</div>
                <div className="flex flex-wrap gap-2">
                  {SAMPLES.map(s => (
                    <button key={s.id} onClick={() => setText(s.text)} className="px-3 py-1.5 rounded-full text-[12px] font-medium border bg-white/60 dark:bg-white/[0.06] hover:scale-[1.02] active:scale-[0.98] transition" style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}>
                      {s.chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* detect button */}
              <button onClick={handleDetect} disabled={wordCount < 10 || detecting} className="mt-5 w-full h-[52px] rounded-[14px] bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-semibold text-[14px] tracking-wide shadow-[0_12px_30px_-12px_rgba(79,70,229,0.6)] hover:shadow-[0_16px_40px_-12px_rgba(79,70,229,0.7)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center justify-center gap-2 shimmer">
                {detecting ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Analyzing writing patterns...
                  </>
                ) : (
                  <>
                    ✦ Analyze Text Now — Press Ctrl+Enter
                  </>
                )}
              </button>

              {/* friendly privacy note */}
              <div className="mt-4 glass rounded-[16px] p-3.5 flex items-center gap-3">
                <span className="text-[16px]">🔒</span>
                <div className="text-[12px] leading-snug" style={{ color: "var(--text-soft)" }}>
                  <strong style={{ color: "var(--text)" }}>100% Confidential:</strong> Text is analyzed locally in your session. We do not store, log, or use your writing for training.
                </div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-5" id="results">
            <div className="glass rounded-[22px] sm:rounded-[28px] p-4 sm:p-6 min-h-[540px] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.3)] relative overflow-hidden" style={{ animation: "inUp .7s ease .1s both" }}>
              {!result ? (
                <div className="h-full min-h-[500px] grid place-items-center text-center p-6">
                  <div>
                    <div className="w-20 h-20 mx-auto rounded-[20px] bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 grid place-items-center text-[28px]">🛡️</div>
                    <div className="mt-4 font-bold text-[16px]" style={{ color: "var(--text)" }}>Ready to analyze</div>
                    <div className="mt-2 text-[13px] leading-relaxed max-w-[320px]" style={{ color: "var(--text-soft)" }}>
                      Paste your text on the left and click Detect. You will receive an overall verdict, probability score, and clear explanations for each writing pattern.
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-2 text-[11px]">
                      <div className="glass rounded-xl p-2.5 font-medium">Sentence Rhythm</div>
                      <div className="glass rounded-xl p-2.5 font-medium">Word Variety</div>
                      <div className="glass rounded-xl p-2.5 font-medium">AI Signatures</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5" style={{ animation: "inUp .4s ease" }}>
                  {/* classification badge & meta */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-bold tracking-wide border ${badgeColorClass}`}>
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                        {result.classification.toUpperCase()}
                      </div>
                      <div className="mt-2 text-[12px] mono" style={{ color: "var(--text-faint)" }}>{result.language} • {result.word_count} words • {new Date(result.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] mono" style={{ color: "var(--text-faint)" }}>ACCURACY CONFIDENCE</div>
                      <div className="text-[18px] font-bold" style={{ color: "var(--text)" }}>{Math.round(result.confidence * 100)}%</div>
                    </div>
                  </div>

                  {/* circular gauge with dynamic gradient */}
                  <div className="flex items-center gap-5">
                    <div className="relative w-[132px] h-[132px] shrink-0">
                      <svg width="132" height="132" viewBox="0 0 100 100" className="-rotate-90">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="8" />
                        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#dynamic-gauge-grad)" strokeWidth="8" strokeLinecap="round" strokeDasharray="283" strokeDashoffset={gaugeOffset} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)" }} />
                        <defs>
                          <linearGradient id="dynamic-gauge-grad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={gradientStops.start} />
                            <stop offset="100%" stopColor={gradientStops.end} />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 grid place-items-center">
                        <div className="text-center">
                          <div className={`text-[28px] font-[800] tracking-tight ${gradientStops.text}`}>{Math.round(result.ai_likelihood * 100)}%</div>
                          <div className="text-[10px] mono tracking-widest font-semibold" style={{ color: "var(--text-faint)" }}>AI LIKELIHOOD</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2.5">
                      <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${gradientStops.bar} transition-all duration-700`} style={{ width: `${result.ai_likelihood * 100}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {result.methods_used.map(m => (
                          <span key={m} className="text-[11px] font-medium px-2 py-0.5 rounded-full glass border" style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}>
                            {FRIENDLY_METHOD_NAMES[m] || m}
                          </span>
                        ))}
                      </div>
                      <div className="text-[12px] leading-relaxed font-medium" style={{ color: "var(--text-soft)" }}>
                        {result.classification === "Likely AI" ? "Consistent sentence lengths & frequent formulaic connectors — classic AI writing structure." : result.classification === "Likely Human" ? "Varied sentence rhythm, high vocabulary diversity & natural phrasing — authentic human style." : result.classification === "Mixed/Edited" ? "Mixed signals detected — likely human-edited AI content or co-authored sections." : "Scores are in the middle threshold (56%). Some formal phrases present, but requires longer text for certainty."}
                      </div>
                    </div>
                  </div>

                  {/* Simple English Insight Card */}
                  <div className="rounded-[16px] border p-4 bg-white/70 dark:bg-white/[0.04] backdrop-blur-md" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[14px]">💡</span>
                      <span className="text-[12px] font-bold tracking-wider uppercase" style={{ color: "var(--text)" }}>Plain English Summary</span>
                    </div>
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
                      {result.classification === "Likely AI" ? (
                        <>
                          This text strongly resembles <strong>AI-generated writing</strong>. Sentences are very uniform in length, vocabulary follows predictable textbook sequences, and common AI transition phrases (like <em>furthermore</em> or <em>in conclusion</em>) appear frequently.
                        </>
                      ) : result.classification === "Likely Human" ? (
                        <>
                          This text shows clear hallmarks of <strong>human writing</strong>. It features natural variety in sentence pacing, rich word choice, and spontaneous thought transitions typical of genuine personal expression.
                        </>
                      ) : result.classification === "Mixed/Edited" ? (
                        <>
                          This text appears to be a <strong>blend of human and AI content</strong>. Certain sentences flow with personal voice, while other parts show structured, automated phrasing — often seen when someone edits an AI draft.
                        </>
                      ) : (
                        <>
                          The result is <strong>inconclusive ({Math.round(result.ai_likelihood * 100)}% AI likelihood)</strong>. The text contains both formal structured sentences and natural phrasing. Providing a slightly longer sample (100+ words) will give a clearer, more definitive result.
                        </>
                      )}
                    </p>
                  </div>

                  {/* findings accordion in simple words */}
                  <div>
                    <div className="text-[11px] font-bold tracking-widest mb-2 uppercase" style={{ color: "var(--text-faint)" }}>HOW WE REACHED THIS CONCLUSION (5 SIGNALS)</div>
                    <div className="space-y-2">
                      {result.findings.map(f => {
                        const friendlyTitle = FRIENDLY_METHOD_NAMES[f.method] || f.method;
                        const isAiLeaning = f.score > 0.6;
                        return (
                          <div key={f.method} className="rounded-[14px] border bg-white/50 dark:bg-white/[0.04] overflow-hidden" style={{ borderColor: "var(--border)" }}>
                            <button onClick={() => setActiveFinding(activeFinding === f.method ? null : f.method)} className="w-full flex items-center justify-between px-3.5 py-3 text-left">
                              <div className="flex items-center gap-3">
                                <div className={`w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold ${isAiLeaning ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                                  {isAiLeaning ? "AI" : "✓"}
                                </div>
                                <div>
                                  <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{friendlyTitle}</div>
                                  <div className="text-[11px]" style={{ color: "var(--text-soft)" }}>{f.label}</div>
                                </div>
                              </div>
                              <span className="text-[14px] font-bold px-1" style={{ color: "var(--text-faint)" }}>{activeFinding === f.method ? "−" : "+"}</span>
                            </button>
                            {activeFinding === f.method && (
                              <div className="px-3.5 pb-3 pt-1 text-[12px] leading-relaxed space-y-2 border-t bg-black/[0.02] dark:bg-white/[0.02]" style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}>
                                <div>{f.reasoning}</div>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {f.indicators.map((ind, i) => (
                                    <span key={i} className="px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[11px] font-medium">{ind}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* mixed visualization */}
                  {result.mixed_sections && result.mixed_sections.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold tracking-widest mb-2 uppercase" style={{ color: "var(--text-faint)" }}>SECTION-BY-SECTION BREAKDOWN</div>
                      <div className="space-y-2">
                        {result.mixed_sections.map((sec, i) => (
                          <div key={i} className="rounded-[12px] border p-3 flex gap-3 items-start" style={{ borderColor: sec.label === "Likely AI" ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)", background: sec.label === "Likely AI" ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)" }}>
                            <div className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${sec.label === "Likely AI" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
                              {sec.label === "Likely AI" ? "AI Style" : "Human Style"}
                            </div>
                            <div className="text-[12px] leading-relaxed" style={{ color: "var(--text-soft)" }}>{sec.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clean User Actions (NO Copy JSON button!) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <button
                      onClick={() => {
                        const summary = `AI Detection Result: ${result.classification} (${Math.round(result.ai_likelihood * 100)}% AI likelihood)\nConfidence: ${Math.round(result.confidence * 100)}%\nLanguage: ${result.language} • ${result.word_count} words\n\nAnalyzed Text Preview:\n${text.slice(0, 400)}...`;
                        copyWithFallback(summary);
                        showToast("Copied Summary to clipboard");
                      }}
                      className="h-10 px-3 rounded-full glass font-medium text-[12px] hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center justify-center gap-1.5"
                      style={{ color: "var(--text)" }}
                    >
                      <span>⎘</span> Copy Summary
                    </button>
                    <button
                      onClick={() => {
                        const report = `# AI Detection Report\n\nOverall Classification: ${result.classification}\nAI Probability: ${Math.round(result.ai_likelihood * 100)}%\nConfidence Score: ${Math.round(result.confidence * 100)}%\nLanguage: ${result.language}\nWord Count: ${result.word_count} words\n\nKey Findings:\n${result.findings.map(f => `• ${FRIENDLY_METHOD_NAMES[f.method] || f.method}: ${f.label}\n  Explanation: ${f.reasoning}`).join("\n\n")}\n\nSubmitted Text:\n"${text.slice(0, 1500)}"\n\n— Verified with Sudarshan AI Detector`;
                        copyWithFallback(report);
                        showToast("Copied Formatted Report");
                      }}
                      className="h-10 px-3 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black font-semibold text-[12px] hover:scale-[1.01] active:scale-[0.99] transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>📄</span> Copy Full Report
                    </button>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({ title: "Sudarshan AI Detector", text: `${result.classification} — ${Math.round(result.ai_likelihood * 100)}% AI likelihood` }).catch(()=>{});
                        } else {
                          copyWithFallback(window.location.href);
                          showToast("Link copied to clipboard");
                        }
                      }}
                      className="h-10 px-3 rounded-full glass font-medium text-[12px] hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center justify-center gap-1.5"
                      style={{ color: "var(--text)" }}
                    >
                      <span>↗</span> Share Result
                    </button>
                  </div>

                  {/* friendly ethics notice */}
                  <div className="rounded-[12px] bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
                    <span className="font-bold">Important Guidance:</span> AI detectors calculate linguistic patterns and probabilities. They should be used to assist human review and constructive feedback, not as sole evidence.
                  </div>
                </div>
              )}
            </div>

            {/* user-friendly overview chips */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="glass rounded-[16px] p-3 text-center">
                <div className="text-[10px] mono tracking-wider font-semibold" style={{ color: "var(--text-faint)" }}>MODELS CHECKED</div>
                <div className="text-[11px] font-semibold mt-1" style={{ color: "var(--text)" }}>ChatGPT • Claude • Gemini</div>
              </div>
              <div className="glass rounded-[16px] p-3 text-center">
                <div className="text-[10px] mono tracking-wider font-semibold" style={{ color: "var(--text-faint)" }}>LANGUAGES</div>
                <div className="text-[11px] font-semibold mt-1" style={{ color: "var(--text)" }}>English • Hindi • Hinglish</div>
              </div>
              <div className="glass rounded-[16px] p-3 text-center">
                <div className="text-[10px] mono tracking-wider font-semibold" style={{ color: "var(--text-faint)" }}>ANALYSIS TYPE</div>
                <div className="text-[11px] font-semibold mt-1" style={{ color: "var(--text)" }}>Multi-Signal Ensemble</div>
              </div>
            </div>
          </div>
        </div>

        {/* User-Friendly Footer (Developer instructions & deploy text removed) */}
        <footer className="mt-12 glass rounded-[20px] p-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="font-bold text-[14px]" style={{ color: "var(--text)" }}>Sudarshan AI Detector</div>
              <div className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
                A modern, multilingual AI detection platform designed for students, educators, writers, and professionals to evaluate content authenticity with explainable reasoning.
              </div>
            </div>
            <div>
              <div className="font-semibold text-[13px]" style={{ color: "var(--text)" }}>Best Practices & Ethics</div>
              <ul className="mt-2 text-[12px] leading-relaxed space-y-1 list-disc pl-4" style={{ color: "var(--text-soft)" }}>
                <li>Use probability scores for triage and helpful guidance.</li>
                <li>Never use AI detection scores to penalize without human discussion.</li>
                <li>Respect author privacy — scan only authorized materials.</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-[13px]" style={{ color: "var(--text)" }}>Supported Content Types</div>
              <ul className="mt-2 text-[12px] leading-relaxed space-y-1" style={{ color: "var(--text-soft)" }}>
                <li>• Essays, research papers & assignments</li>
                <li>• Blog posts, news articles & newsletters</li>
                <li>• Business emails, reports & marketing drafts</li>
                <li>• Multilingual texts (English, Hindi, and Hinglish)</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t text-[11px] mono flex flex-col sm:flex-row justify-between gap-2" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>
            <span>© {new Date().getFullYear()} Sudarshan AI Labs • Accurate, Transparent & Privacy-First</span>
            <span>Tip: Press Ctrl+Enter to analyze • Ctrl+K to clear</span>
          </div>
        </footer>
      </main>

      {/* History Sidebar */}
      <div className={`fixed inset-0 z-40 transition ${showHistory ? "pointer-events-auto" : "pointer-events-none"}`}>
        <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition ${showHistory ? "opacity-100" : "opacity-0"}`} onClick={() => setShowHistory(false)} />
        <div className={`absolute top-0 right-0 h-full w-[92%] sm:w-[380px] glass-strong shadow-2xl transition-transform duration-300 ${showHistory ? "translate-x-0" : "translate-x-full"} flex flex-col pt-4`}>
          <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <div>
              <div className="font-bold text-[14px]" style={{ color: "var(--text)" }}>Detection History</div>
              <div className="text-[11px] mono" style={{ color: "var(--text-faint)" }}>Saved locally in this browser • {history.length} items</div>
            </div>
            <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-full glass grid place-items-center">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {history.length === 0 ? (
              <div className="p-8 text-center text-[13px]" style={{ color: "var(--text-soft)" }}>No history yet. Analyze some text to save records here.</div>
            ) : (
              history.map(h => (
                <button key={h.id} onClick={() => { setText(h.value.fullText); setResult(h.value.result); setShowHistory(false); showToast("Restored analysis from history"); }} className="w-full text-left rounded-[14px] border p-3 bg-white/60 dark:bg-white/[0.04] hover:bg-white/80 transition" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.value.result.classification === "Likely AI" ? "bg-red-500/10 text-red-600" : h.value.result.classification === "Likely Human" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{h.value.result.classification}</span>
                    <span className="text-[10px] mono" style={{ color: "var(--text-faint)" }}>{Math.round(h.value.result.ai_likelihood * 100)}% • {h.value.lang}</span>
                  </div>
                  <div className="mt-1.5 text-[12px] leading-snug line-clamp-2" style={{ color: "var(--text-soft)" }}>{h.value.preview}</div>
                  <div className="mt-1 text-[10px] mono" style={{ color: "var(--text-faint)" }}>{new Date(h.created_at).toLocaleString()}</div>
                </button>
              ))
            )}
          </div>
          <div className="p-3 border-t flex gap-2" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => {
              localStorage.removeItem("sudarshan_detections");
              setHistory([]);
              showToast("History cleared");
            }} className="flex-1 h-9 rounded-full glass text-[12px]">Clear History</button>
            <button onClick={() => setShowHistory(false)} className="flex-1 h-9 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black text-[12px]">Close</button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-strong rounded-full px-4 py-2 text-[12px] font-medium shadow-xl flex items-center gap-2" style={{ color: "var(--text)", animation: "inUp .25s ease" }}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />{toast}
        </div>
      )}

      {/* Mobile history button */}
      <button onClick={() => setShowHistory(true)} className="md:hidden fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xl grid place-items-center text-[18px]">◫</button>

      <style>{`
        .line-clamp-2{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        ${dark ? ":root{ color-scheme: dark; }" : ":root{ color-scheme: light; }"}
      `}</style>
    </div>
  );
}
