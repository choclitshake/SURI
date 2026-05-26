"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSession, getContent, ContentResponse } from "../../../../lib/api";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import confetti from "canvas-confetti";
import { 
  BookOpen, 
  Loader2, 
  Sparkles, 
  Check, 
  ArrowRight, 
  HelpCircle, 
  Trophy, 
  Flame, 
  Compass, 
  Leaf, 
  ShieldAlert 
} from "lucide-react";

// SURI's custom motivational tips tailored directly to active node topics
const SURI_COMMENTARY: Record<string, string> = {
  "QE": "Sss-olve this parabola puzzle, Ranger! Those roots are where the curve kisses the baseline trail!",
  "SLE": "Lines overlapping? Sss-uch a perfect intersection of pathways! Find where they meet!",
  "RER": "Rational exponents are just radicals in disguise! Unwrap their power carefully!",
  "FP": "Factoring is like finding GCF keys to unlock hidden gates in the wood!",
  "OI": "Watch those negative signs carefully! They are like tricky bramble thorns!",
  "PE": "Higher-degree polynomials have many roots! Track down every single sss-olution!"
};

// ── Client-Side Text Pre-Processor (Converts Wall of Text to Spaced Lessons) ── [2]
function formatLessonMarkdown(text: string): string {
  if (!text) return "";

  const stepRules = [
    { trigger: "Distribute the 2/3", heading: "### Step 1: Distribute Fractional Coefficients" },
    { trigger: "Simplify the multiplication", heading: "### Step 2: Simplify Term Calculations" },
    { trigger: "To eliminate the fraction", heading: "### Step 3: Eliminate Fractional Denominators" },
    { trigger: "Distribute the 3 on both sides", heading: "### Step 4: Apply Left/Right Distribution" },
    { trigger: "Now, we want to arrange", heading: "### Step 5: Group Variables on One Side" },
    { trigger: "Move the constant", heading: "### Step 6: Isolate Variable Terms" },
    { trigger: "The standard form usually", heading: "### Step 7: Standardize Leading Coefficients" }
  ];

  let cleaned = text;
  stepRules.forEach(({ trigger, heading }) => {
    cleaned = cleaned.replace(trigger, `\n\n${heading}\n\n${trigger}`);
  });

  return cleaned;
}

// ── Dynamic Lesson Graphic Visualizer Component ─────────────────────────────
function LessonVisualizer({ nodeId }: { nodeId: string }) {
  const id = nodeId?.toUpperCase() || "";

  if (id.includes("QE")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-2">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <line x1="10" y1="60" x2="190" y2="60" stroke="#1F2720" strokeWidth="1.5" />
          <line x1="100" y1="10" x2="100" y2="110" stroke="#1F2720" strokeWidth="1.5" />
          <path d="M 45 25 Q 100 120 155 25" fill="none" stroke="#1F2720" strokeWidth="3" />
          <circle cx="68" cy="60" r="5" fill="#fdd400" stroke="#1F2720" strokeWidth="2" className="animate-pulse" />
          <circle cx="132" cy="60" r="5" fill="#fdd400" stroke="#1F2720" strokeWidth="2" className="animate-pulse" />
          <text x="54" y="52" className="text-[10px] font-mono font-black fill-[#1F2720]">x₁</text>
          <text x="138" y="52" className="text-[10px] font-mono font-black fill-[#1F2720]">x₂</text>
        </svg>
        <p className="text-[9px] font-black text-slate-500 text-center uppercase mt-1 tracking-wider">Parabola Roots [1]</p>
      </div>
    );
  }

  if (id.includes("SLE")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-2">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <line x1="10" y1="60" x2="190" y2="60" stroke="#1F2720" strokeWidth="1.5" />
          <line x1="100" y1="10" x2="100" y2="110" stroke="#1F2720" strokeWidth="1.5" />
          <line x1="30" y1="100" x2="170" y2="20" stroke="#1F2720" strokeWidth="3" />
          <line x1="30" y1="20" x2="170" y2="100" stroke="#1F2720" strokeWidth="2" strokeDasharray="3 3" />
          <circle cx="100" cy="60" r="6" fill="#fdd400" stroke="#1F2720" strokeWidth="2" className="animate-ping" />
          <circle cx="100" cy="60" r="4.5" fill="#fdd400" stroke="#1F2720" strokeWidth="2" />
          <text x="110" y="55" className="text-[10px] font-mono font-black fill-[#1F2720]">(x, y)</text>
        </svg>
        <p className="text-[9px] font-black text-slate-500 text-center uppercase mt-1 tracking-wider">Line Intersection [1]</p>
      </div>
    );
  }

  if (id.includes("RER")) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-3 py-4">
        <div className="flex items-center gap-2 text-center">
          <div className="bg-white border-2 border-[#1F2720] rounded-xl p-2.5 shadow-[2px_2px_0px_0px_#1F2720]">
            <span className="font-['Hanken_Grotesk'] text-lg font-black text-[#1F2720]">x</span>
            <sup className="text-[10px] font-mono font-black text-[#fdd400] bg-[#1F2720] px-1 rounded ml-0.5">a/b</sup>
          </div>
          <span className="text-[#1F2720] font-black">⟺</span>
          <div className="bg-white border-2 border-[#1F2720] rounded-xl p-2.5 shadow-[2px_2px_0px_0px_#1F2720] relative flex items-center">
            <sup className="text-[8px] font-mono font-black text-slate-400 absolute left-1 top-1">b</sup>
            <span className="font-['Hanken_Grotesk'] text-lg font-black text-[#1F2720] pl-1">√x</span>
            <sup className="text-[8px] font-mono font-black text-[#fdd400] bg-[#1F2720] px-0.5 rounded ml-0.5">a</sup>
          </div>
        </div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
          Radical Rewrite Rule [1]
        </p>
      </div>
    );
  }

  if (id.includes("FP")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-2">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <rect x="30" y="10" width="70" height="70" fill="#1F2720" fillOpacity="0.05" stroke="#1F2720" strokeWidth="2" />
          <text x="65" y="50" className="text-[10px] font-mono font-black fill-[#1F2720]">x²</text>
          <rect x="100" y="10" width="45" height="70" fill="#fdd400" fillOpacity="0.1" stroke="#1F2720" strokeWidth="1.5" strokeDasharray="2 2" />
          <text x="120" y="50" className="text-[10px] font-mono font-black fill-[#1F2720]">3x</text>
          <rect x="30" y="80" width="70" height="30" fill="#fdd400" fillOpacity="0.1" stroke="#1F2720" strokeWidth="1.5" strokeDasharray="2 2" />
          <text x="60" y="100" className="text-[10px] font-mono font-black fill-[#1F2720]">2x</text>
          <rect x="100" y="80" width="45" height="30" fill="#fdd400" stroke="#1F2720" strokeWidth="2" />
          <text x="120" y="100" className="text-[10px] font-mono font-black fill-[#1F2720]">+6</text>
          <text x="65" y="5" className="text-[8px] font-mono fill-slate-400 text-center">x</text>
          <text x="122" y="5" className="text-[8px] font-mono fill-[#1F2720] font-black text-center">+3</text>
          <text x="20" y="50" className="text-[8px] font-mono fill-slate-400">x</text>
          <text x="18" y="98" className="text-[8px] font-mono fill-[#1F2720] font-black">+2</text>
        </svg>
        <p className="text-[9px] font-black text-slate-500 text-center uppercase mt-1 tracking-wider">Area Factoring Model [1]</p>
      </div>
    );
  }

  if (id.includes("OI")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-3">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <line x1="10" y1="60" x2="190" y2="60" stroke="#1F2720" strokeWidth="2" />
          <polygon points="10,56 10,64 2,60" fill="#1F2720" />
          <polygon points="190,56 190,64 198,60" fill="#1F2720" />
          <line x1="40" y1="55" x2="40" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="70" y1="55" x2="70" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="100" y1="53" x2="100" y2="67" stroke="#1F2720" strokeWidth="2" />
          <line x1="130" y1="55" x2="130" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="160" y1="55" x2="160" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          <text x="37" y="76" className="text-[8px] font-mono fill-slate-400">-2</text>
          <text x="67" y="76" className="text-[8px] font-mono fill-slate-400">-1</text>
          <text x="98" y="78" className="text-[9px] font-mono font-black fill-[#1F2720]">0</text>
          <text x="127" y="76" className="text-[8px] font-mono fill-slate-400">+1</text>
          <text x="157" y="76" className="text-[8px] font-mono fill-slate-400">+2</text>
          <path d="M 40 60 Q 70 20 100 60" fill="none" stroke="#fdd400" strokeWidth="2" strokeDasharray="2 2" />
          <polygon points="98,53 103,58 97,61" fill="#fdd400" />
          <text x="65" y="32" className="text-[8px] font-mono font-black fill-[#1F2720]">+2</text>
        </svg>
        <p className="text-[9px] font-black text-slate-500 text-center uppercase mt-1 tracking-wider">Number Line Vector [1]</p>
      </div>
    );
  }

  if (id.includes("PE") || id.includes("PO") || id.includes("PD")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-2">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <line x1="10" y1="60" x2="190" y2="60" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="100" y1="10" x2="100" y2="110" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M 30 110 C 60 10, 80 10, 100 60 C 120 110, 140 110, 170 10" fill="none" stroke="#1F2720" strokeWidth="2.5" />
          <circle cx="50" cy="60" r="4" fill="#fdd400" stroke="#1F2720" strokeWidth="2" />
          <circle cx="100" cy="60" r="4" fill="#fdd400" stroke="#1F2720" strokeWidth="2" />
          <circle cx="150" cy="60" r="4" fill="#fdd400" stroke="#1F2720" strokeWidth="2" />
          <text x="125" y="20" className="text-[8px] font-mono fill-slate-400">Degree n = 3</text>
        </svg>
        <p className="text-[9px] font-black text-slate-500 text-center uppercase mt-1 tracking-wider">Multi-Root Polynomial [1]</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <BookOpen size={24} className="text-[#1F2720]/40" />
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center mt-2">Theory Sandbox [1]</p>
    </div>
  );
}

export default function LessonPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [content, setContent] = useState<ContentResponse | null>(null);
  const [currentNode, setCurrentNode] = useState<string>(""); 
  const [errorType, setErrorType] = useState<"no_content" | "general" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dynamic Interactive States for Lesson Progress
  const [activeTab, setActiveTab] = useState<"concept" | "example" | "explanation">("concept");
  const [readConcept, setReadConcept] = useState(false);
  const [readExample, setReadExample] = useState(false);
  const [readExplanation, setReadExplanation] = useState(false);

  const loadLessonContent = async () => {
    setErrorType(null);
    setErrorMsg(null);

    try {
      const session = await getSession(sessionId);
      setCurrentNode(session.current_node); 
      const data = await getContent(session.current_node);

      if (data.error === "no_content") {
        setErrorType("no_content");
        setContent(null);
        return;
      }

      setContent(data);
    } catch (err: unknown) {
      console.error(err);
      setErrorType("general");
      const message =
        err instanceof Error ? err.message : "Failed to connect to the server.";
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail?: string }).detail)
          : message;
      setErrorMsg(detail);
      setContent(null);
    }
  };

  useEffect(() => {
    if (sessionId) {
      loadLessonContent();
    }
  }, [sessionId]);

  const handleStartPractice = () => {
    router.push(`/session/${sessionId}/practice`);
  };

  const handleExit = () => {
    router.push("/topics");
  };

  // Checkbox understanding indicators triggering confetti [2]
  const handleMarkRead = (section: "concept" | "example" | "explanation") => {
    if (section === "concept") {
      setReadConcept(true);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } else if (section === "example") {
      setReadExample(true);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } else if (section === "explanation") {
      setReadExplanation(true);
      confetti({ particleCount: 80, spread: 80, origin: { y: 0.8 } });
    }
  };

  const activeMilestonesCount = [readConcept, readExample, readExplanation].filter(Boolean).length;
  const progressPercent = Math.round((activeMilestonesCount / 3) * 100);

  const ErrorWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-[#1b261c] text-[#1F2720] p-6 md:p-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-xl bg-[#faf8f5] border-[4px] border-[#1F2720] rounded-[32px] p-8 shadow-[8px_8px_0px_0px_#1F2720] text-center relative overflow-hidden">
        {children}
      </div>
    </div>
  );

  if (errorType === "no_content") {
    return (
      <ErrorWrapper>
        <span className="font-['Manrope'] text-[10px] text-[#1F2720] bg-[#fdd400] px-3 py-1.5 rounded-md border-2 border-[#1F2720] font-black uppercase tracking-wider">SYSTEM WARN</span>
        <h2 className="text-xl font-black font-['Hanken_Grotesk'] text-[#1F2720] mt-4 mb-2">
          Content Unavailable
        </h2>
        <p className="font-['Manrope'] text-xs text-slate-500 mb-8 leading-relaxed font-bold">
          The node curriculum stream is currently unpopulated for this active track section.
        </p>
        <button
          onClick={handleExit}
          className="w-full sm:w-auto bg-[#fdd400] text-[#1F2720] border-[3px] border-[#1F2720] py-3.5 px-8 text-xs font-['Manrope'] font-black uppercase rounded-2xl tracking-wider transition-all cursor-pointer shadow-[4px_4px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#1F2720] active:translate-y-0.5"
        >
          Exit Session
        </button>
      </ErrorWrapper>
    );
  }

  if (errorType === "general") {
    return (
      <ErrorWrapper>
        <span className="font-['Manrope'] text-[9px] text-red-900 bg-red-100 border-2 border-[#1F2720] px-2.5 py-1 rounded-md font-black uppercase tracking-wider">DIAGNOSTIC FAULT</span>
        <h2 className="text-xl font-black font-['Hanken_Grotesk'] text-[#1F2720] mt-4 mb-2">System Error</h2>
        <p className="font-['Manrope'] text-xs text-red-900 bg-red-50 border-2 border-[#1F2720] rounded-xl p-3 my-4 break-all text-left font-bold">
          [FAULT_LOG] {errorMsg}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button
            onClick={loadLessonContent}
            className="bg-[#fdd400] text-[#1F2720] border-[3px] border-[#1F2720] py-3 px-6 text-xs font-['Manrope'] font-black uppercase rounded-2xl tracking-wider transition-all cursor-pointer shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 active:translate-y-0.5"
          >
            Retry Connection
          </button>
          <button
            onClick={handleExit}
            className="bg-white text-[#1F2720] border-[3px] border-[#1F2720] py-3 px-6 text-xs font-['Manrope'] font-black uppercase rounded-2xl tracking-wider transition-all cursor-pointer shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5"
          >
            Exit Workspace
          </button>
        </div>
      </ErrorWrapper>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-[#1b261c] flex items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-[#1F2720]/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-[#1F2720] border-t-[#fdd400] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Pre-process raw math
  const cleanLessonMath = (expr: string) => {
    const inline = expr.replace(/\$\$(.+?)\$\$/g, (_, inner) => `$${inner}$`);
    return inline
      .replace(/(\d)\s*\*\s*([a-zA-Z])/g, "$1$2")
      .replace(/([a-zA-Z])\s*\*\s*([a-zA-Z])/g, "$1$2");
  };

  const lessonBody = formatLessonMarkdown(cleanLessonMath(resolveLessonText(content)));
  const workedExample = formatLessonMarkdown(cleanLessonMath(content.worked_example || ""));
  const guidedExplanation = formatLessonMarkdown(cleanLessonMath(content.guided_explanation || ""));

  const suriTip = SURI_COMMENTARY[currentNode] || "Sss-tudy these rules carefully before moving to practice!";

  return (
    <div className="bg-[#1b261c] min-h-screen text-[#1F2720] py-8 px-4 md:px-8 relative overflow-hidden font-['Manrope'] flex flex-col items-center">
      
      {/* Background Forest Silhouette */}
      <div className="absolute inset-0 opacity-15 bg-cover bg-bottom mix-blend-overlay pointer-events-none" 
           style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAEXma6INVd0pxsf2NimA83gxdCqv-1PqJrcWOioIbkPEtj3Z7oIxOvuUvLYNc4Dp9x3Y1BdR1CuvLCFJx5RSzJA9_Kk02IsPNQSy0DeGhX33fZvqV6ZTAci5gEWEnXt3d5H0IqVOBVrHAtZ0wRSpSPEhIZkwT8lWCqZo0inU40TzVsVWo-vjMqvT5w8nLCUkx-agKpKsnu_I62S8u6WesHawWnmWYTE_400YVkv8YcJ_L_q-lbQ4H0O-Ey3ld_l4PtBxxi-Kv7vQ8')" }} />

      {/* Floating Glowing Fireflies */}
      <div className="firefly w-2 h-2" style={{ left: "8%", bottom: "12%", animation: "floatFirefly 8s ease-in-out infinite" }} />
      <div className="firefly w-2.5 h-2.5" style={{ left: "25%", bottom: "6%", animation: "floatFirefly 10s ease-in-out infinite 1.5s" }} />
      <div className="firefly w-1.5 h-1.5" style={{ left: "48%", bottom: "16%", animation: "floatFirefly 6s ease-in-out infinite 0.5s" }} />

      {/* Dynamic Math Highlight CSS Override tags */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .markdown-content {
          line-height: 2.1;
        }
        .markdown-content p {
          margin-bottom: 1.25rem;
          color: #1F2720;
          font-weight: 700;
        }
        /* Beautiful Neobrutalist Math Highlights */
        .markdown-content .katex {
          font-weight: 900 !important;
          font-size: 1.08em;
          color: #1b4320 !important;
          background-color: rgba(121, 255, 143, 0.22) !important;
          padding: 3px 8px !important;
          border-radius: 8px !important;
          border: 1.5px solid #1F2720 !important;
          display: inline-block;
        }
        .markdown-content .katex-display {
          margin: 1.5rem 0 !important;
          padding: 0 !important;
        }
        .markdown-content .katex-display .katex {
          background-color: #ffffff !important;
          border: 3px solid #1F2720 !important;
          padding: 12px 22px !important;
          border-radius: 16px !important;
          box-shadow: 3px 3px 0px 0px #1F2720 !important;
          display: inline-block !important;
        }
        .markdown-content ol {
          list-style: decimal !important;
          padding-left: 1.5rem !important;
          margin-bottom: 1rem !important;
          font-weight: bold;
        }
        .markdown-content ul {
          list-style: disc !important;
          padding-left: 1.5rem !important;
          margin-bottom: 1rem !important;
          font-weight: bold;
        }
        .markdown-content li {
          margin-bottom: 0.5rem !important;
        }
      `}} />

      <div className="max-w-3xl w-full mx-auto space-y-6 relative z-10">

        {/* Header Section */}
        <header className="bg-gradient-to-b from-[#1b261c] to-[#2e3e2d] rounded-[32px] p-6 md:p-8 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="absolute top-0 right-1/4 w-32 h-32 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-4 z-10 border-b-4 border-[#1F2720]/30 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400] border border-[#1F2720]" />
              <span className="font-['Manrope'] text-[10px] text-emerald-300 tracking-[0.2em] uppercase font-black">ACTIVE LESSON MODULE</span>
            </div>
            
            <button
              onClick={handleExit}
              className="font-['Manrope'] text-[10px] text-[#1F2720] bg-[#fdd400] hover:bg-[#ffe170] px-4.5 py-2 rounded-xl border-2 border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0px_0px_0px_0px_#1F2720] transition-all cursor-pointer font-black uppercase tracking-wider"
            >
              Exit
            </button>
          </div>

          <div className="z-10 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white font-['Hanken_Grotesk'] drop-shadow-[2.5px_2.5px_0px_#1F2720] leading-tight">
                {content.node_label}
              </h1>
              <p className="font-['Manrope'] text-[10px] text-emerald-200 mt-1.5 font-bold uppercase tracking-wider">
                Source Scroll: <span className="text-[#fdd400] font-black">{content.source_doc}</span>
              </p>
            </div>
          </div>
        </header>

        {/* Suri's Tip Balloon Commentary */}
        <div className="bg-[#ffe170] border-[4px] border-[#1F2720] shadow-[5px_5px_0px_0px_#1F2720] p-4 rounded-3xl flex items-center gap-4 relative overflow-hidden transform hover:scale-[1.01] transition-transform">
          <img src="/suri-snake-left.png" alt="Suri Guide" className="h-12 w-auto object-contain select-none shrink-0 animate-jelly" />
          <p className="text-xs md:text-sm text-[#1F2720] font-black leading-relaxed m-0">
            Suri says: <strong className="bg-white/40 px-1.5 py-0.5 rounded border border-[#1F2720]/30 font-black">"{suriTip}"</strong>
          </p>
        </div>

        {/* Milestone Ranger Progress Indicator */}
        <div className="bg-[#faf8f5] rounded-3xl p-5 border-[4px] border-[#1F2720] shadow-[5px_5px_0px_0px_#1F2720] space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="font-['Manrope'] text-[11px] font-black text-[#1F2720] uppercase tracking-wider">Ranger Lesson Completion</span>
            <span className="font-['Manrope'] text-[10px] font-black text-[#1F2720] bg-emerald-100 border-2 border-[#1F2720] px-3 py-1 rounded-md">{progressPercent}% Clear</span>
          </div>
          <div className="h-5 w-full bg-[#e6e8ea] rounded-full overflow-hidden border-[3px] border-[#1F2720] p-0.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all border-r-2 border-[#1F2720]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Interactive Scroll Tabs controls */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setActiveTab("concept")}
            className={`py-3 rounded-2xl font-['Manrope'] text-xs font-black tracking-wider uppercase border-[3.5px] border-[#1F2720] transition-all cursor-pointer shadow-[3.5px_3.5px_0px_0px_#1F2720] active:translate-y-0.5 ${
              activeTab === "concept" 
                ? "bg-[#fdd400] text-[#1F2720]" 
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            📔 Core Concept
          </button>
          
          <button
            onClick={() => setActiveTab("example")}
            className={`py-3 rounded-2xl font-['Manrope'] text-xs font-black tracking-wider uppercase border-[3.5px] border-[#1F2720] transition-all cursor-pointer shadow-[3.5px_3.5px_0px_0px_#1F2720] active:translate-y-0.5 ${
              activeTab === "example" 
                ? "bg-[#fdd400] text-[#1F2720]" 
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            ✍️ Worked Example
          </button>

          <button
            onClick={() => setActiveTab("explanation")}
            className={`py-3 rounded-2xl font-['Manrope'] text-xs font-black tracking-wider uppercase border-[3.5px] border-[#1F2720] transition-all cursor-pointer shadow-[3.5px_3.5px_0px_0px_#1F2720] active:translate-y-0.5 ${
              activeTab === "explanation" 
                ? "bg-[#fdd400] text-[#1F2720]" 
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            🗺️ Explanation
          </button>
        </div>

        {/* Interactive Active Content Scrolls */}
        <div className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] p-6 md:p-8 relative min-h-[300px] flex flex-col justify-between">
          
          {/* TAB 1: CORE CONCEPT */}
          {activeTab === "concept" && (
            <div className="space-y-6 flex-1">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1F2720]/10">
                <span className="text-[10px] font-black tracking-wider uppercase text-emerald-800 bg-emerald-100 px-3 py-1 rounded-md border-2 border-[#1F2720]">Concept Module</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Text Content */}
                <div className="lg:col-span-2 space-y-4 markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      h3: ({ node, ...props }) => (
                        <h3 className="text-sm font-black text-[#1F2720] uppercase tracking-widest mt-6 mb-3 pb-1 border-b-2 border-[#1F2720]/15 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#fdd400]" />
                          {props.children}
                        </h3>
                      )
                    }}
                  >
                    {lessonBody}
                  </ReactMarkdown>
                </div>

                {/* Graphic Sandbox Visualizer Aid */}
                <div className="lg:col-span-1 bg-white border-[3px] border-[#1F2720] rounded-2xl p-4.5 flex flex-col justify-between min-h-[220px] relative overflow-hidden shadow-[4px_4px_0px_0px_#1F2720]">
                  <span className="absolute top-0 right-0 bg-[#1F2720] text-[#fdd400] text-[8px] font-mono uppercase font-black tracking-widest px-2.5 py-1 rounded-bl-lg">
                    Visual Aid
                  </span>
                  <div className="font-['Manrope'] text-[9px] text-slate-400 font-black uppercase tracking-widest mb-2">GRAPHIC AID</div>
                  <div className="flex-1 flex items-center justify-center">
                    <LessonVisualizer nodeId={currentNode} />
                  </div>
                </div>
              </div>

              {/* Reward trigger element */}
              <div className="pt-6 border-t-2 border-[#1F2720]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8">
                <p className="text-xs text-slate-500 font-bold m-0">📚 Finished reading the core concept theory segment?</p>
                <button
                  type="button"
                  disabled={readConcept}
                  onClick={() => handleMarkRead("concept")}
                  className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider border-[2.5px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] cursor-pointer transition-all ${
                    readConcept 
                      ? "bg-green-100 text-green-900 shadow-none pointer-events-none" 
                      : "bg-[#79ff8f] text-[#1F2720] hover:bg-[#8aff9e]"
                  }`}
                >
                  {readConcept ? "✓ Logged Understood!" : "Check Off Concept"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: WORKED EXAMPLE */}
          {activeTab === "example" && (
            <div className="space-y-6 flex-1">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1F2720]/10">
                <span className="text-[10px] font-black tracking-wider uppercase text-emerald-800 bg-emerald-100 px-3 py-1 rounded-md border-2 border-[#1F2720]">Worked Example</span>
              </div>

              <div className="space-y-4 markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h3: ({ node, ...props }) => (
                      <h3 className="text-sm font-black text-[#1F2720] uppercase tracking-widest mt-6 mb-3 pb-1 border-b-2 border-[#1F2720]/15 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#fdd400]" />
                        {props.children}
                      </h3>
                    )
                  }}
                >
                  {workedExample.replace(/\\n/g, '\n')}
                </ReactMarkdown>
              </div>

              {/* Reward trigger element */}
              <div className="pt-6 border-t-2 border-[#1F2720]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8">
                <p className="text-xs text-slate-500 font-bold m-0">✍️ Followed and calculated along with the example steps?</p>
                <button
                  type="button"
                  disabled={readExample}
                  onClick={() => handleMarkRead("example")}
                  className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider border-[2.5px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] cursor-pointer transition-all ${
                    readExample 
                      ? "bg-green-100 text-green-900 shadow-none pointer-events-none" 
                      : "bg-[#79ff8f] text-[#1F2720] hover:bg-[#8aff9e]"
                  }`}
                >
                  {readExample ? "✓ Logged Understood!" : "Check Off Example"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: GUIDED EXPLANATION */}
          {activeTab === "explanation" && (
            <div className="space-y-6 flex-1">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#1F2720]/10">
                <span className="text-[10px] font-black tracking-wider uppercase text-emerald-800 bg-emerald-100 px-3 py-1 rounded-md border-2 border-[#1F2720]">Guided Walkthrough</span>
              </div>

              <div className="space-y-4 markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h3: ({ node, ...props }) => (
                      <h3 className="text-sm font-black text-[#1F2720] uppercase tracking-widest mt-6 mb-3 pb-1 border-b-2 border-[#1F2720]/15 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#fdd400]" />
                        {props.children}
                      </h3>
                    )
                  }}
                >
                  {guidedExplanation.replace(/\\n/g, '\n')}
                </ReactMarkdown>
              </div>

              {/* Reward trigger element */}
              <div className="pt-6 border-t-2 border-[#1F2720]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8">
                <p className="text-xs text-slate-500 font-bold m-0">🗺️ Understood the complete algebraic layout overview?</p>
                <button
                  type="button"
                  disabled={readExplanation}
                  onClick={() => handleMarkRead("explanation")}
                  className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider border-[2.5px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] cursor-pointer transition-all ${
                    readExplanation 
                      ? "bg-green-100 text-green-900 shadow-none pointer-events-none" 
                      : "bg-[#79ff8f] text-[#1F2720] hover:bg-[#8aff9e]"
                  }`}
                >
                  {readExplanation ? "✓ Logged Understood!" : "Check Off Explanation"}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Section */}
        <footer className="pt-4 flex flex-col items-center">
          <button
            onClick={handleStartPractice}
            className="w-full bg-[#fdd400] text-[#1F2720] hover:bg-[#ffe170] border-[4px] border-[#1F2720] py-4 text-sm font-black uppercase tracking-wider transition-all rounded-[24px] shadow-[6px_6px_0px_0px_#1F2720] hover:shadow-[8px_8px_0px_0px_#1F2720] active:translate-y-1 active:translate-x-1 active:shadow-[2px_2px_0px_0px_#1F2720] cursor-pointer flex items-center justify-center gap-2"
          >
            Start Practice Track <ArrowRight className="w-5 h-5 stroke-[3px]" />
          </button>
        </footer>

      </div>
    </div>
  );
}

function resolveLessonText(content: ContentResponse): string {
  const simplified = content.simplified_lesson_text;
  if (!simplified) {
    return content.lesson;
  }
  try {
    const parsed = JSON.parse(simplified) as { lesson?: string };
    if (parsed.lesson) {
      return parsed.lesson;
    }
  } catch {
    return simplified;
  }
  return content.lesson;
}