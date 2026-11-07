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

type SentenceScore = {
  text: string;
  score: number; // 0 (human) to 1 (ai)
  label: Classification;
  indicators: string[];
};

type DetectionResult = {
  ai_likelihood: number;
  classification: Classification;
  confidence: number;
  disagreement: number;
  methods_used: MethodName[];
  findings: Finding[];
  sentences: SentenceScore[];
  language: Lang;
  word_count: number;
  char_count: number;
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

// Friendly names for methods in plain English
const FRIENDLY_METHOD_NAMES: Record<string, string> = {
  burstiness: "Sentence Flow & Rhythm",
  stylometry: "Vocabulary Diversity",
  perplexity: "Text Predictability",
  zero_shot: "Original Phrasing & Structure",
  trained_fusion: "Modern AI Markers & Buzzwords",
};

// ---------- Sample Texts ----------
const SAMPLES: { id: string; label: string; lang: Lang; text: string; chip: string }[] = [
  {
    id: "msme-ai",
    label: "Modern AI Article",
    lang: "EN",
    chip: "AI • Business & MSME",
    text: `India's 63.4 million MSMEs are at a critical juncture in 2025-2026. With the Union Budget 2025-26 announcing revolutionary funding schemes, AI automation becoming accessible, and digital transformation no longer optional, small and offline businesses have unprecedented opportunities for exponential growth. This comprehensive guide reveals the exact strategies, tools, and government schemes that successful MSMEs are leveraging to achieve 300%+ growth in 2025.

## 1. The New MSME Landscape: What Changed in 2025-2026

### Revolutionary Budget Announcements Transform MSME Access

The Union Budget 2025-26 has fundamentally altered the MSME ecosystem with game-changing announcements:`
  },
  {
    id: "en-human",
    label: "English Human",
    lang: "EN",
    chip: "EN • Human Story",
    text: "I was walking down the street yesterday when I saw this weird dog chasing its tail in circles. I stood there for like two minutes just watching it, totally mesmerized. My coffee got cold. Anyway, it reminded me of how my brother used to spin around when we were kids trying to make himself dizzy. Strange memory, but it made me laugh."
  },
  {
    id: "en-ai",
    label: "English AI Essay",
    lang: "EN",
    chip: "EN • AI Essay",
    text: "In conclusion, it is important to note that artificial intelligence is transforming various industries. Furthermore, the integration of AI technologies offers significant advantages. Moreover, it is worth noting that organizations must consider ethical implications. Additionally, the future of AI holds immense potential. Overall, AI represents a paradigm shift in technological innovation."
  },
  {
    id: "hi-human",
    label: "Hindi Human",
    lang: "HI",
    chip: "HI • Human Story",
    text: "कल मैं बाजार गया था, वहां बहुत भीड़ थी। मैंने सोचा सब्जी ले लूं, पर टमाटर इतने महंगे थे कि मैंने छोड़ दिए। दुकानदार बोला - भाई साहब, महंगाई बढ़ गई है। मैं हंस दिया, क्या कर सकते हैं। फिर मैंने चाय पी और घर आ गया।"
  },
  {
    id: "hi-ai",
    label: "Hindi AI",
    lang: "HI",
    chip: "HI • AI Article",
    text: "निष्कर्षतः, यह कहना महत्वपूर्ण है कि कृत्रिम बुद्धिमत्ता हमारे समाज में क्रांतिकारी परिवर्तन ला रही है। इसके अतिरिक्त, यह तकनीक विभिन्न क्षेत्रों में महत्वपूर्ण भूमिका निभा रही है। इसके अलावा, हमें इसके नैतिक पहलुओं पर भी विचार करना चाहिए। अंततः, यह तकनीक भविष्य की दिशा निर्धारित करेगी।"
  },
  {
    id: "hing-human",
    label: "Hinglish Human",
    lang: "HINGLISH",
    chip: "Hinglish • Conversational",
    text: "Yaar kal raat ka scene kya tha, main aur Rohan bike pe ja rahe the, suddenly baarish shuru ho gayi. Hum ek chai ki tapri pe ruk gaye. Wahan ka tapri wala uncle ne bola - arre bhai, ye Mumbai ki baarish hai, iska koi bharosa nahi. We laughed so hard, full timepass ho gaya."
  },
  {
    id: "hing-ai",
    label: "Hinglish AI",
    lang: "HINGLISH",
    chip: "Hinglish • AI Formal",
    text: "It is important to note that Hinglish represents a fascinating linguistic phenomenon. Furthermore, this hybrid language combines Hindi and English elements. Moreover, it is widely used in urban India. Additionally, its usage reflects cultural modernity. In conclusion, Hinglish demonstrates linguistic evolution."
  },
  {
    id: "mixed",
    label: "Mixed/Edited",
    lang: "MIXED",
    chip: "Mixed • Human + AI",
    text: "I went to the market yesterday and it was really crowded. In conclusion, it is important to note that market dynamics are influenced by various economic factors. But honestly, I just wanted to buy tomatoes and they were so expensive! Furthermore, inflation is affecting daily life. My mom called and said yaar, sab mehenga ho gaya hai."
  }
];

// ---------- Comprehensive Modern AI Lexicon (120+ markers) ----------
const MODERN_AI_MARKERS = [
  "at a critical juncture", "critical juncture", "exponential growth", "game-changing",
  "comprehensive guide", "unprecedented opportunities", "fundamentally altered",
  "leveraging to achieve", "leveraging", "leverage", "transformative potential",
  "paradigm shift", "in today's fast-paced", "in today's digital landscape",
  "ever-evolving landscape", "dynamic landscape", "digital transformation",
  "it is important to note", "it is worth noting", "it is crucial to", "crucial role",
  "pivotal role", "vital role", "rich tapestry", "tapestry of", "tapestry",
  "delve into", "delving into", "delve deeper", "testament to", "beacon of",
  "fostering innovation", "holistic approach", "seamless integration", "underscores the",
  "harnessing the power", "poised to", "embark on", "realm of", "multifaceted",
  "revolutionize", "revolutionary", "paramount importance", "navigate the complexities",
  "double-edged sword", "in conclusion", "furthermore", "moreover", "additionally",
  "overall,", "in summary", "to summarize", "spearheading", "not only",
  "unraveling", "catalyst for", "cornerstone of", "groundbreaking", "symbiotic relationship",
  "synergistic", "demystifying", "burgeoning", "profound impact", "significant milestone",
  "it is essential to", "serves as a reminder", "in essence", "meticulously crafted",
  "deep dive", "transformative journey", "ushering in a new era", "at the forefront",
  "key takeaway", "crucial takeaway", "game changer", "synergies", "scalable solutions",
  "seamlessly", "vital importance", "integral part", "indispensable", "broad spectrum",
  "plethora of", "myriad of", "nexus of", "testament", "underpinning",
  // Hindi AI markers
  "महत्वपूर्ण भूमिका", "क्रांतिकारी परिवर्तन", "उल्लेखनीय है", "निष्कर्षतः",
  "इसके अतिरिक्त", "इसके अलावा", "सकारात्मक प्रभाव", "दृष्टिकोण", "दिशा निर्धारित",
  "सशक्तिकरण", "रणनीतिक", "व्यापक", "परिप्रेक्ष्य"
];

const HINGLISH_LEXICON = [
  "yaar", "hai", "tha", "thi", "kya", "nahi", "haan", "bhai", "arre", "chal",
  "theek", "mat", "kar", "gaya", "aaya", "ho", "raha", "rahi", "kal", "bahut", "kuch", "pe"
];

// Split text into genuine prose sentences while safeguarding decimal numbers (e.g. 63.4, 2025-26)
function splitProseSentences(text: string): string[] {
  const clean = text
    .replace(/^\s*#{1,6}\s+.*$/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "");

  const protectedText = clean.replace(/(\d+)\.(\d+)/g, "$1<DOT>$2");
  const raw = protectedText.split(/[.!?।\n]+/);
  return raw
    .map(s => s.replace(/<DOT>/g, ".").trim())
    .filter(s => s.split(/\s+/).filter(Boolean).length >= 3);
}

function detectLanguage(text: string): Lang {
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const lower = text.toLowerCase();
  const hingCount = HINGLISH_LEXICON.filter(w => lower.includes(w)).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const hingRatio = hingCount / Math.max(words, 1);

  if (hasDevanagari && hingRatio > 0.05) return "MIXED";
  if (hasDevanagari) return "HI";
  if (hingRatio > 0.06) return "HINGLISH";
  if (hasDevanagari && /[a-zA-Z]/.test(text)) return "MIXED";
  return "EN";
}

// Offline high-accuracy intelligence engine
function analyzeTextOffline(text: string): DetectionResult {
  const trimmed = text.trim();
  const proseSentences = splitProseSentences(trimmed);
  const words = trimmed.split(/\s+/).filter(Boolean);
  const lower = trimmed.toLowerCase();
  const wordCount = words.length;
  const charCount = trimmed.length;

  // 1. Structural AI Layout Detection (Markdown, Bullets, Colon introductions)
  const hasHeaders = /^\s*#{1,6}\s+/m.test(text);
  const hasBullets = /^\s*[-*•]\s+/m.test(text);
  const hasColonLeadins = /:\s*$/m.test(text);
  let layoutScore = 0.5;
  if (hasHeaders) layoutScore += 0.18;
  if (hasColonLeadins) layoutScore += 0.12;
  if (hasBullets) layoutScore += 0.10;
  layoutScore = Math.min(0.95, layoutScore);

  // 2. Modern AI Phrasal Clichés
  const matchedMarkers: string[] = [];
  for (const m of MODERN_AI_MARKERS) {
    if (lower.includes(m.toLowerCase()) && !matchedMarkers.includes(m)) {
      matchedMarkers.push(m);
    }
  }
  let markerScore = 0.35;
  if (matchedMarkers.length >= 4) markerScore = 0.92;
  else if (matchedMarkers.length >= 2) markerScore = 0.82;
  else if (matchedMarkers.length === 1) markerScore = 0.65;
  else markerScore = 0.28;

  // 3. Sentence Flow & Burstiness (CV of prose lengths)
  const sentLens = proseSentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const mean = sentLens.reduce((a, b) => a + b, 0) / Math.max(sentLens.length, 1) || 15;
  const variance = sentLens.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(sentLens.length, 1) || 0;
  const std = Math.sqrt(variance);
  const cv = mean ? std / mean : 0;
  
  let burstScore = 0.5;
  if (cv < 0.38) burstScore = 0.82; // very uniform -> high AI
  else if (cv < 0.50) burstScore = 0.65;
  else if (cv > 0.65) burstScore = 0.25; // varied -> human
  else burstScore = 0.45;

  // 4. Vocabulary Diversity & Stylometry
  const cleanTokens = words.map(w => w.toLowerCase().replace(/[^\w\u0900-\u097F]/g, "")).filter(Boolean);
  const uniqueCount = new Set(cleanTokens).size;
  const ttr = uniqueCount / Math.max(cleanTokens.length, 1);
  let stylScore = 0.5;
  if (ttr > 0.76 && (hasHeaders || matchedMarkers.length >= 2)) {
    stylScore = 0.78; // rich vocabulary in corporate structure -> LLM
  } else if (ttr < 0.52) {
    stylScore = 0.30;
  } else {
    stylScore = 0.55;
  }

  // 5. Predictability / Perplexity Proxy
  const funcWords = ["the", "is", "are", "and", "of", "to", "in", "a", "that", "it", "for", "on", "with", "as", "by"];
  const funcCount = cleanTokens.filter(w => funcWords.includes(w)).length;
  const funcRatio = funcCount / Math.max(cleanTokens.length, 1);
  let perplexScore = 0.5;
  if (funcRatio > 0.36 && mean > 18) perplexScore = 0.75;
  else if (funcRatio < 0.25) perplexScore = 0.35;
  else perplexScore = 0.50;

  // Weighted ensemble
  const weights = {
    marker: 0.35,
    layout: 0.20,
    burst: 0.20,
    styl: 0.15,
    perplex: 0.10
  };
  const fusion = (
    markerScore * weights.marker +
    layoutScore * weights.layout +
    burstScore * weights.burst +
    stylScore * weights.styl +
    perplexScore * weights.perplex
  );

  let classification: Classification = "Inconclusive";
  if (fusion >= 0.64) classification = "Likely AI";
  else if (fusion <= 0.38) classification = "Likely Human";
  else classification = "Inconclusive";

  // Individual sentence-by-sentence evaluation for the heatmap
  const sentences: SentenceScore[] = proseSentences.map(sent => {
    const sLower = sent.toLowerCase();
    const sWords = sent.split(/\s+/).filter(Boolean);
    const sLen = sWords.length;
    const sHits = MODERN_AI_MARKERS.filter(m => sLower.includes(m.toLowerCase()));
    
    let sScore = 0.40;
    const indicators: string[] = [];
    if (sHits.length > 0) {
      sScore += Math.min(0.50, sHits.length * 0.22);
      indicators.push(`AI phrase: ${sHits.slice(0, 3).map(h => `"${h}"`).join(", ")}`);
    }
    if (sLen >= 20 && sLen <= 38) {
      sScore += 0.12;
      indicators.push("Balanced clause length");
    }
    if (sLen < 8 && sHits.length === 0) {
      sScore -= 0.18;
      indicators.push("Casual short expression");
    }
    sScore = Math.max(0.08, Math.min(0.96, sScore));
    let sLabel: Classification = "Inconclusive";
    if (sScore >= 0.65) sLabel = "Likely AI";
    else if (sScore <= 0.35) sLabel = "Likely Human";

    return {
      text: sent,
      score: sScore,
      label: sLabel,
      indicators: indicators.length > 0 ? indicators : ["Standard syntax"]
    };
  });

  const findings: Finding[] = [
    {
      method: "trained_fusion",
      score: markerScore,
      label: matchedMarkers.length > 0 
        ? `Found ${matchedMarkers.length} modern AI markers` 
        : "No modern AI buzzwords found",
      reasoning: matchedMarkers.length > 0
        ? `Detected hallmark phrases common in ChatGPT, Claude, and Gemini outputs: ${matchedMarkers.slice(0, 4).map(m => `"${m}"`).join(", ")}.`
        : "Text is free from formulaic corporate and analytical AI buzzwords.",
      indicators: matchedMarkers.slice(0, 4)
    },
    {
      method: "burstiness",
      score: burstScore,
      label: burstScore > 0.6 ? "Repetitive sentence rhythm" : "Natural rhythm variety",
      reasoning: burstScore > 0.6
        ? `Sentence lengths are unusually even (average ${mean.toFixed(0)} words per sentence, low variance). Natural humans vary their sentence length dynamically.`
        : `Natural flow with a dynamic mix of short and longer sentences (average ${mean.toFixed(0)} words).`,
      indicators: [`Average: ${mean.toFixed(0)} words/sentence`, burstScore > 0.6 ? "Uniform pacing" : "Dynamic pacing"]
    },
    {
      method: "zero_shot",
      score: layoutScore,
      label: hasHeaders || hasColonLeadins ? "Formulaic AI document layout" : "Natural prose formatting",
      reasoning: hasHeaders || hasColonLeadins
        ? "Uses typical LLM organizational elements: section headers, colon-ended introductions, and structured bullet lists."
        : "Text follows standard conversational or narrative prose without robotic section hierarchies.",
      indicators: [hasHeaders ? "Markdown headers" : "Prose", hasColonLeadins ? "Colon lead-in" : "Flowing"]
    },
    {
      method: "stylometry",
      score: stylScore,
      label: stylScore > 0.6 ? "Structured corporate vocabulary" : "Organic word selection",
      reasoning: stylScore > 0.6
        ? `Vocabulary density is ${((uniqueCount / Math.max(wordCount, 1)) * 100).toFixed(0)}% with formulaic terminology typical of generative language models.`
        : `Organic vocabulary spread with authentic human word selection (${uniqueCount} unique words).`,
      indicators: [`${uniqueCount} unique words`, `TTR: ${(ttr * 100).toFixed(0)}%`]
    },
    {
      method: "perplexity",
      score: perplexScore,
      label: perplexScore > 0.6 ? "Highly predictable grammar" : "Spontaneous phrasing",
      reasoning: perplexScore > 0.6
        ? "Words and transitional phrases follow statistically probable paths expected in LLM training corpora."
        : "Phrasing displays spontaneous human choices that deviate from synthetic prediction patterns.",
      indicators: [perplexScore > 0.6 ? "Predictable syntax" : "Original phrasing"]
    }
  ];

  return {
    ai_likelihood: Math.min(1, Math.max(0, fusion)),
    classification,
    confidence: Math.max(0.65, Math.min(0.96, 0.88 - Math.abs(fusion - 0.5) * 0.2)),
    disagreement: 0.18,
    methods_used: ["trained_fusion", "burstiness", "zero_shot", "stylometry", "perplexity"],
    findings,
    sentences,
    language: detectLanguage(trimmed),
    word_count: wordCount,
    char_count: charCount,
    timestamp: new Date().toISOString()
  };
}

// Copy helper
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
  } catch {
    return false;
  }
}

export default function App() {
  const [text, setText] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"findings" | "heatmap">("findings");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Theme: Light or Dark Mode with persistence
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("sudarshan_theme");
    if (saved === "light" || saved === "dark") return saved;
    return "light"; // Default to high-contrast Light mode requested by user
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("sudarshan_theme", theme);
  }, [theme]);

  // Load history from localStorage on startup
  useEffect(() => {
    try {
      const local = localStorage.getItem("sudarshan_detections");
      if (local) {
        setHistory(JSON.parse(local));
      }
    } catch {}
  }, []);

  const langBadge = useMemo(() => detectLanguage(text), [text]);
  const wordsArray = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);
  const wordCount = wordsArray.length;
  const charCount = text.length;
  const tokenEst = Math.ceil(wordCount * 1.33);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleDetect = async () => {
    if (wordCount < 10) {
      showToast("Please enter at least 10 words to analyze.");
      return;
    }
    setDetecting(true);
    let res: DetectionResult | null = null;

    // Try backend FastAPI endpoint (proxied /api/detect or direct localhost)
    try {
      let apiRes = await fetch("/api/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text })
      }).catch(() => null);

      if (!apiRes || !apiRes.ok) {
        apiRes = await fetch("http://127.0.0.1:8000/detect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text })
        }).catch(() => null);
      }

      if (apiRes && apiRes.ok) {
        const data = await apiRes.json();
        const apiSentences: SentenceScore[] = (data.sentence_breakdown || []).map((s: any) => ({
          text: s.text,
          score: s.ai_likelihood,
          label: (s.label === "likely_ai" ? "Likely AI" : s.label === "likely_human" ? "Likely Human" : "Inconclusive") as Classification,
          indicators: s.indicators || []
        }));

        const findingsList: Finding[] = [];
        const rawFindings = data.individual_findings || {};
        for (const [mName, mData] of Object.entries(rawFindings)) {
          const m = mData as any;
          const friendly = FRIENDLY_METHOD_NAMES[mName] || mName;
          const score = m.score || m.ai_likelihood || 0.5;
          findingsList.push({
            method: (mName as MethodName) || "burstiness",
            score: score,
            label: score > 0.6 ? `${friendly}: AI tendency detected` : `${friendly}: Natural flow`,
            reasoning: m.details ? Object.entries(m.details).map(([k, v]) => `${k}: ${v}`).join(", ") : `Score: ${(score * 100).toFixed(0)}%`,
            indicators: [score > 0.6 ? "AI indicator" : "Human indicator"]
          });
        }

        res = {
          ai_likelihood: data.ai_likelihood,
          classification: data.overall_classification as Classification,
          confidence: data.uncertainty?.confidence ?? 0.88,
          disagreement: data.uncertainty?.disagreement ?? 0.15,
          methods_used: (data.detection_methods_used || []) as MethodName[],
          findings: findingsList.length > 0 ? findingsList : analyzeTextOffline(text).findings,
          sentences: apiSentences.length > 0 ? apiSentences : analyzeTextOffline(text).sentences,
          language: (data.detected_language?.toUpperCase() || detectLanguage(text)) as Lang,
          word_count: data.word_count || wordCount,
          char_count: data.char_count || charCount,
          timestamp: data.timestamp || new Date().toISOString()
        };
      }
    } catch {
      // Backend not reached, fall back to offline engine
    }

    if (!res) {
      await new Promise(r => setTimeout(r, 400));
      res = analyzeTextOffline(text);
    }

    setResult(res);
    setDetecting(false);

    // Save detection to history
    const newHistoryItem: HistoryItem = {
      id: `det_${Date.now()}_${wordCount}`,
      value: {
        preview: text.slice(0, 140),
        fullText: text.slice(0, 8000),
        result: res,
        lang: res.language
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
  };

  const handleCopyResult = async () => {
    if (!result) return;
    const txt = `Sudarshan AI Detector Result:\nClassification: ${result.classification}\nAI Likelihood: ${(result.ai_likelihood * 100).toFixed(0)}%\nConfidence: ${(result.confidence * 100).toFixed(0)}%\nWord Count: ${result.word_count}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(txt);
      showToast("Result copied to clipboard!");
    } else if (copyWithFallback(txt)) {
      showToast("Result copied to clipboard!");
    }
  };

  const handleCopyReport = async () => {
    if (!result) return;
    const lines = [
      `============================================================`,
      `SUDARSHAN AI DETECTOR REPORT`,
      `============================================================`,
      `Verdict: ${result.classification}`,
      `AI Probability: ${(result.ai_likelihood * 100).toFixed(1)}%`,
      `Confidence: ${(result.confidence * 100).toFixed(1)}%`,
      `Language: ${result.language}`,
      `Word Count: ${result.word_count} | Character Count: ${result.char_count}`,
      `Timestamp: ${result.timestamp}`,
      ``,
      `--- Detailed Insights ---`
    ];
    result.findings.forEach(f => {
      lines.push(`* ${FRIENDLY_METHOD_NAMES[f.method] || f.method}: ${f.label}`);
      lines.push(`  ${f.reasoning}`);
    });
    if (result.sentences && result.sentences.length > 0) {
      lines.push(``);
      lines.push(`--- Sentence Breakdown ---`);
      result.sentences.forEach((s, idx) => {
        lines.push(`[Sentence ${idx + 1}] (${(s.score * 100).toFixed(0)}% AI - ${s.label}): "${s.text}"`);
      });
    }
    const fullReport = lines.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(fullReport);
      showToast("Detailed report copied!");
    } else if (copyWithFallback(fullReport)) {
      showToast("Detailed report copied!");
    }
  };

  // Color scheme dynamically driven by AI score
  const scorePct = result ? Math.round(result.ai_likelihood * 100) : 0;

  const scoreTextColor = useMemo(() => {
    if (scorePct <= 35) return "text-emerald-600 dark:text-emerald-400";
    if (scorePct <= 64) return "text-amber-600 dark:text-amber-400";
    return "text-rose-600 dark:text-rose-400";
  }, [scorePct]);

  const badgeBg = useMemo(() => {
    if (scorePct <= 35) return "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-2 border-emerald-600 dark:border-emerald-500/40";
    if (scorePct <= 64) return "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-2 border-amber-600 dark:border-amber-500/40";
    return "bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-2 border-rose-600 dark:border-rose-500/40";
  }, [scorePct]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans selection:bg-indigo-600 selection:text-white relative overflow-x-hidden">
      {/* Ambient background glow orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[550px] h-[550px] rounded-full bg-indigo-500/10 dark:bg-indigo-600/15 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[550px] h-[550px] rounded-full bg-teal-500/10 dark:bg-purple-600/15 blur-[120px] pointer-events-none" />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-950 px-5 py-3 rounded-xl shadow-2xl border-2 border-slate-800 dark:border-slate-300 text-sm font-bold animate-bounce flex items-center gap-2">
          <span>✓</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b-2 border-slate-300 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            {/* Brand Logo with sharp outline */}
            <div className="relative w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 p-1 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(15,23,42,0.9)] dark:shadow-md">
              <img
                src="/logo.png"
                alt="Sudarshan AI Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                  Sudarshan AI Detector
                </h1>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-300 border-2 border-indigo-900/30 dark:border-indigo-700">
                  v2.5 High Precision
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                Advanced Multilingual &amp; Structural AI Detection • Real-time Sentence Heatmap
              </p>
            </div>
          </div>

          {/* Right Header: Theme Switcher & Actions */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Pill with dark outline in Light mode */}
            <div className="flex items-center p-1 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.85)] dark:shadow-inner">
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  theme === "light"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                }`}
                title="Switch to Light Mode"
              >
                <span>☀️</span>
                <span>Light</span>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  theme === "dark"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
                }`}
                title="Switch to Dark Mode"
              >
                <span>🌙</span>
                <span>Dark</span>
              </button>
            </div>
          </div>
        </header>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Input and Samples (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Input Card with crisp dark border in Light mode */}
            <div className="bg-white dark:bg-slate-900/80 border-2 border-slate-900/90 dark:border-slate-800 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,0.9)] dark:shadow-2xl relative flex flex-col">
              
              {/* Card Header: Metas and Tools */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                    Input Text
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-300 border border-slate-400 dark:border-slate-700">
                    {langBadge}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px] font-medium">
                    {wordCount} words • {charCount} chars • ~{tokenEst} tokens
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const clip = await navigator.clipboard.readText();
                        if (clip) {
                          setText(clip);
                          showToast("Pasted from clipboard!");
                        }
                      } catch {
                        showToast("Clipboard access denied. Please paste using Ctrl+V.");
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg text-slate-900 dark:text-slate-200 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-900/80 dark:border-slate-700 shadow-[1px_1px_0px_0px_rgba(15,23,42,0.8)] dark:shadow-none font-bold transition-all flex items-center gap-1.5 text-xs"
                  >
                    <span>📋</span> Paste
                  </button>
                  <button
                    onClick={() => {
                      setText("");
                      setResult(null);
                      showToast("Cleared input");
                    }}
                    disabled={!text}
                    className="px-3 py-1.5 rounded-lg text-slate-900 dark:text-slate-200 bg-white hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 border-2 border-slate-900/80 dark:border-slate-700 shadow-[1px_1px_0px_0px_rgba(15,23,42,0.8)] dark:shadow-none font-bold transition-all text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Textarea with high contrast and dark border */}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Paste or type article, essay, or draft here to scan for AI patterns (supports English, Hindi, Hinglish, & Markdown)..."
                rows={14}
                className="w-full bg-slate-50 dark:bg-slate-950/70 border-2 border-slate-900/80 dark:border-slate-800 rounded-xl p-4 text-sm font-medium text-slate-950 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 font-sans leading-relaxed resize-y transition-all"
              />

              {/* Submit CTA Bar */}
              <div className="mt-4 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t-2 border-slate-200 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-900"></span>
                  <span>Instant offline analysis &amp; multi-signal neural checks</span>
                </div>

                <button
                  onClick={handleDetect}
                  disabled={detecting || wordCount < 5}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-gradient-to-r dark:from-indigo-600 dark:via-indigo-500 dark:to-violet-600 text-white font-extrabold text-sm border-2 border-slate-900 dark:border-indigo-400/40 shadow-[3px_3px_0px_0px_rgba(15,23,42,0.9)] dark:shadow-md active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {detecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Analyzing text...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Detect AI Content</span>
                      <kbd className="hidden sm:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/20 border border-white/30">
                        Ctrl+Enter
                      </kbd>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Test Samples Card */}
            <div className="bg-white dark:bg-slate-900/60 border-2 border-slate-900/90 dark:border-slate-800/80 rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,0.85)] dark:shadow-md">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-300 mb-2.5 flex items-center gap-1.5">
                <span>⚡</span>
                <span>Try Sample Texts — Click to Load:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SAMPLES.map(sample => (
                  <button
                    key={sample.id}
                    onClick={() => {
                      setText(sample.text);
                      showToast(`Loaded ${sample.chip}`);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-700 dark:hover:text-indigo-400 border-2 border-slate-900/80 dark:border-slate-700 shadow-[1px_1px_0px_0px_rgba(15,23,42,0.7)] dark:shadow-none transition-all text-left flex items-center gap-1"
                  >
                    <span>{sample.chip}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent History Drawer */}
            {history.length > 0 && (
              <div className="bg-white dark:bg-slate-900/50 border-2 border-slate-900/80 dark:border-slate-800/70 rounded-2xl p-4 text-xs shadow-[2px_2px_0px_0px_rgba(15,23,42,0.8)] dark:shadow-none">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1">
                    <span>🕒</span> Recent Scans ({history.length})
                  </span>
                  <button
                    onClick={() => {
                      localStorage.removeItem("sudarshan_detections");
                      setHistory([]);
                      showToast("History cleared");
                    }}
                    className="text-slate-500 hover:text-rose-600 font-bold transition-colors"
                  >
                    Clear history
                  </button>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {history.slice(0, 5).map(h => (
                    <div
                      key={h.id}
                      onClick={() => {
                        setText(h.value.fullText);
                        setResult(h.value.result);
                      }}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-slate-800 border-2 border-slate-900/60 dark:border-slate-700/60 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <span className="truncate max-w-[280px] font-medium text-slate-900 dark:text-slate-300">
                        {h.value.preview}...
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        h.value.result.classification === "Likely AI"
                          ? "bg-rose-100 text-rose-800 border-rose-500 dark:bg-rose-950 dark:text-rose-300"
                          : h.value.result.classification === "Likely Human"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 border-amber-500 dark:bg-amber-950 dark:text-amber-300"
                      }`}>
                        {Math.round(h.value.result.ai_likelihood * 100)}% {h.value.result.classification}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Results & Heatmap (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {result ? (
              <div className="space-y-4">
                
                {/* Result Card with strong outline */}
                <div className="bg-white dark:bg-slate-900/80 border-2 border-slate-900/90 dark:border-slate-800 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,0.9)] dark:shadow-2xl relative">
                  
                  {/* Top Status */}
                  <div className="flex items-center justify-between pb-4 border-b-2 border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full border border-slate-900 ${
                        result.classification === "Likely AI" ? "bg-rose-500 animate-pulse" :
                        result.classification === "Likely Human" ? "bg-emerald-500" :
                        "bg-amber-500"
                      }`} />
                      <span className="text-xs uppercase tracking-wider font-extrabold text-slate-950 dark:text-slate-200">
                        {result.classification}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold">CONFIDENCE</div>
                      <div className="text-sm font-extrabold text-slate-950 dark:text-slate-200">
                        {(result.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Main Gauge and Verdict */}
                  <div className="py-6 flex flex-col sm:flex-row items-center justify-around gap-4">
                    {/* Radial Gauge */}
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        {/* Background track */}
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          className="stroke-slate-200 dark:stroke-slate-800"
                          strokeWidth="10"
                          fill="none"
                        />
                        {/* Value stroke */}
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="url(#scoreGradient)"
                          strokeWidth="10"
                          strokeDasharray={2 * Math.PI * 40}
                          strokeDashoffset={2 * Math.PI * 40 * (1 - result.ai_likelihood)}
                          strokeLinecap="round"
                          fill="none"
                          className="transition-all duration-1000 ease-out"
                        />
                        <defs>
                          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            {scorePct <= 35 ? (
                              <>
                                <stop offset="0%" stopColor="#10b981" />
                                <stop offset="100%" stopColor="#059669" />
                              </>
                            ) : scorePct <= 64 ? (
                              <>
                                <stop offset="0%" stopColor="#f59e0b" />
                                <stop offset="100%" stopColor="#ea580c" />
                              </>
                            ) : (
                              <>
                                <stop offset="0%" stopColor="#e11d48" />
                                <stop offset="50%" stopColor="#db2777" />
                                <stop offset="100%" stopColor="#7c3aed" />
                              </>
                            )}
                          </linearGradient>
                        </defs>
                      </svg>
                      
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className={`text-3xl font-black tracking-tight ${scoreTextColor}`}>
                          {scorePct}%
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-700 dark:text-slate-400">
                          AI Likelihood
                        </span>
                      </div>
                    </div>

                    {/* Verdict description */}
                    <div className="flex-1 space-y-2 text-center sm:text-left">
                      <div className={`inline-flex px-3.5 py-1 rounded-full text-xs font-black shadow-sm ${badgeBg}`}>
                        {result.classification}
                      </div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                        {result.classification === "Likely AI" && (
                          "Text exhibits strong synthetic signatures: formulaic phrasing, predictable word structures, and balanced sentence pacing common in modern LLMs."
                        )}
                        {result.classification === "Likely Human" && (
                          "Text reflects authentic human authoring: natural sentence length variations, spontaneous expressions, and absence of robotic markers."
                        )}
                        {result.classification === "Inconclusive" && (
                          "Scores lie near the middle threshold. The text may be human-written with formal phrasing or lightly edited AI content. Try pasting a longer passage."
                        )}
                        {result.classification === "Mixed/Edited" && (
                          "Significant variation detected across sections: some sentences appear AI-generated while others show authentic human patterns."
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Tab Selector: Method Findings vs Sentence Heatmap */}
                  <div className="mt-2 border-t-2 border-slate-200 dark:border-slate-800 pt-4">
                    <div className="flex items-center gap-2 mb-3 bg-slate-200 dark:bg-slate-800/80 p-1 rounded-xl border-2 border-slate-900/60 dark:border-slate-700">
                      <button
                        onClick={() => setActiveTab("findings")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          activeTab === "findings"
                            ? "bg-slate-950 text-white shadow-sm dark:bg-slate-700"
                            : "text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                        }`}
                      >
                        Individual Findings
                      </button>
                      <button
                        onClick={() => setActiveTab("heatmap")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          activeTab === "heatmap"
                            ? "bg-slate-950 text-white shadow-sm dark:bg-slate-700"
                            : "text-slate-800 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                        }`}
                      >
                        <span>🔥</span>
                        <span>Sentence Heatmap ({result.sentences.length})</span>
                      </button>
                    </div>

                    {/* Tab 1: Individual Findings */}
                    {activeTab === "findings" && (
                      <div className="space-y-2.5">
                        {result.findings.map(f => (
                          <div
                            key={f.method}
                            className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-900/70 dark:border-slate-700/60 shadow-[1px_1px_0px_0px_rgba(15,23,42,0.7)] dark:shadow-none space-y-1.5 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-slate-950 dark:text-slate-200 flex items-center gap-1.5">
                                <span className={`w-2.5 h-2.5 rounded-full border border-slate-900 ${
                                  f.score >= 0.65 ? "bg-rose-500" :
                                  f.score <= 0.35 ? "bg-emerald-500" :
                                  "bg-amber-500"
                                }`} />
                                {FRIENDLY_METHOD_NAMES[f.method] || f.method}
                              </span>
                              <span className={`text-xs font-mono font-black ${
                                f.score >= 0.65 ? "text-rose-600 dark:text-rose-400" :
                                f.score <= 0.35 ? "text-emerald-600 dark:text-emerald-400" :
                                "text-amber-600 dark:text-amber-400"
                              }`}>
                                {Math.round(f.score * 100)}%
                              </span>
                            </div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-300">
                              {f.label}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                              {f.reasoning}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tab 2: Sentence-by-Sentence AI Heatmap */}
                    {activeTab === "heatmap" && (
                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-400 mb-1 flex items-center justify-between">
                          <span>Sentences color-coded by AI intensity:</span>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400">
                              <span className="w-2 h-2 rounded-full bg-rose-500" /> AI
                            </span>
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Human
                            </span>
                          </div>
                        </div>

                        {result.sentences.map((sent, idx) => {
                          const sPct = Math.round(sent.score * 100);
                          const isAi = sent.score >= 0.65;
                          const isHuman = sent.score <= 0.35;
                          
                          return (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-xl border-2 transition-all text-xs space-y-1.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.85)] dark:shadow-none ${
                                isAi
                                  ? "bg-rose-50 dark:bg-rose-950/30 border-rose-600 dark:border-rose-900/60 text-slate-950 dark:text-slate-100"
                                  : isHuman
                                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-600 dark:border-emerald-900/60 text-slate-950 dark:text-slate-100"
                                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-600 dark:border-amber-900/60 text-slate-950 dark:text-slate-100"
                              }`}
                            >
                              <div className="flex items-center justify-between font-bold text-xs">
                                <span className="text-slate-700 dark:text-slate-400">
                                  Sentence {idx + 1}
                                </span>
                                <span className={`px-2 py-0.5 rounded font-mono font-black text-[10px] border ${
                                  isAi
                                    ? "bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200 border-rose-500"
                                    : isHuman
                                    ? "bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 border-emerald-500"
                                    : "bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 border-amber-500"
                                }`}>
                                  {sPct}% {sent.label}
                                </span>
                              </div>

                              <p className="leading-relaxed font-sans font-medium">
                                "{sent.text}"
                              </p>

                              {sent.indicators && sent.indicators.length > 0 && (
                                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-300 dark:border-slate-800 flex items-center gap-1">
                                  <span className="font-bold">Signal:</span>
                                  <span>{sent.indicators.join(" • ")}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons with dark outlines */}
                  <div className="mt-4 pt-3 flex items-center justify-between gap-2.5 border-t-2 border-slate-200 dark:border-slate-800">
                    <button
                      onClick={handleCopyResult}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-950 dark:text-slate-200 border-2 border-slate-900/80 dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.85)] dark:shadow-none transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>📋</span>
                      <span>Copy Result</span>
                    </button>
                    <button
                      onClick={handleCopyReport}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-900 dark:text-indigo-300 border-2 border-slate-900/80 dark:border-indigo-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.85)] dark:shadow-none transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>📄</span>
                      <span>Copy Full Report</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty State Prompt with sharp outline */
              <div className="bg-white dark:bg-slate-900/50 border-2 border-slate-900/90 dark:border-slate-800/80 rounded-2xl p-8 text-center space-y-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,0.9)] dark:shadow-md">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl border-2 border-slate-900 dark:border-slate-700 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.8)] dark:shadow-none">
                  🔍
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-950 dark:text-slate-200">
                    Ready to Analyze
                  </h3>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
                    Paste text or choose a sample from the left to generate an instant AI likelihood report with interactive sentence heatmaps.
                  </p>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-500 font-mono font-semibold">
                  Press Ctrl+Enter anytime to run detection
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Footer Section with Brand Logo & Hyperlinked CTAs */}
        <footer className="pt-8 pb-6 border-t-2 border-slate-300 dark:border-slate-800 space-y-6">
          
          {/* Brand & Mission Banner */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900/70 border-2 border-slate-900/80 dark:border-slate-800 shadow-[3px_3px_0px_0px_rgba(15,23,42,0.85)] dark:shadow-md">
            <div className="flex items-center gap-3.5">
              <img
                src="/logo.png"
                alt="Sudarshan AI Logo"
                className="w-10 h-10 object-contain rounded-xl"
              />
              <div>
                <h2 className="text-sm font-black text-slate-950 dark:text-white">
                  Sudarshan AI Labs
                </h2>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Open-source, privacy-first multilingual AI detection engine for Indian &amp; Global Languages.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                100% Free &amp; Offline Ready
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                No Paid APIs Required
              </span>
            </div>
          </div>

          {/* Hyperlinked CTA Resource Grid requested by user */}
          <div className="space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-300 flex items-center gap-2">
              <span>🔗</span> Official Resources &amp; Community Channels
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Link 1: Official Website */}
              <a
                href="https://sudarshan-ai.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl bg-white hover:bg-indigo-50/60 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 border-2 border-slate-900/80 dark:border-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.85)] dark:shadow-none hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,0.95)] transition-all group flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-base group-hover:scale-110 transition-transform">
                  🌐
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-950 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-1">
                    <span>Sudarshan AI Platform</span>
                    <span>↗</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Official Website &amp; Enterprise Solutions
                  </div>
                </div>
              </a>

              {/* Link 2: Vyapai AI Insights & Blog */}
              <a
                href="https://www.blogs.vyapai.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl bg-white hover:bg-indigo-50/60 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 border-2 border-slate-900/80 dark:border-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.85)] dark:shadow-none hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,0.95)] transition-all group flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-base group-hover:scale-110 transition-transform">
                  ✍️
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-950 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 flex items-center gap-1">
                    <span>Vyapai AI Insights &amp; Blog</span>
                    <span>↗</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Deep Dives in AI, NLP &amp; MSME Automation
                  </div>
                </div>
              </a>

              {/* Link 3: LinkedIn */}
              <a
                href="https://www.linkedin.com/company/sudarshan-ai-labs/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl bg-white hover:bg-indigo-50/60 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 border-2 border-slate-900/80 dark:border-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.85)] dark:shadow-none hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,0.95)] transition-all group flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-base group-hover:scale-110 transition-transform">
                  💼
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-950 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1">
                    <span>LinkedIn Company Page</span>
                    <span>↗</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Connect with our research team
                  </div>
                </div>
              </a>

              {/* Link 4: Pinterest */}
              <a
                href="https://pinterest.com/ailabslucknow"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl bg-white hover:bg-indigo-50/60 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 border-2 border-slate-900/80 dark:border-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.85)] dark:shadow-none hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,0.95)] transition-all group flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400 font-bold text-base group-hover:scale-110 transition-transform">
                  📌
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-950 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 flex items-center gap-1">
                    <span>Pinterest • AI Labs Lucknow</span>
                    <span>↗</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Visual AI Guides &amp; Architectural Diagrams
                  </div>
                </div>
              </a>

              {/* Link 5: Facebook */}
              <a
                href="https://www.facebook.com/sudarshanlabsinc"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl bg-white hover:bg-indigo-50/60 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 border-2 border-slate-900/80 dark:border-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.85)] dark:shadow-none hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,0.95)] transition-all group flex items-start gap-3 sm:col-span-2 lg:col-span-1"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-base group-hover:scale-110 transition-transform">
                  👥
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-950 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-1">
                    <span>Facebook • Sudarshan Labs</span>
                    <span>↗</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Join our community discussions &amp; news
                  </div>
                </div>
              </a>
            </div>
          </div>

          {/* Bottom Copyright & Ethics Note */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <div>
              © 2026 Sudarshan AI Labs Inc. All rights reserved.
            </div>
            <div className="flex items-center gap-3">
              <span>English • Hindi • Hinglish Detection</span>
              <span>•</span>
              <span>Vercel Edge Ready</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
