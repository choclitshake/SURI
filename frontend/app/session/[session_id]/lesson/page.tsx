"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSession, getContent, ContentResponse } from "../../../../lib/api";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { BookOpen, Loader2 } from "lucide-react";

// ── Client-Side Text Pre-Processor (Converts Wall of Text to Spaced Lessons) ── [2]
function formatLessonMarkdown(text: string): string {
  if (!text) return "";

  // 1. Convert computer asterisks (*) into beautiful mathematical dots (\cdot) [2]
  let cleaned = text
    .replace(/\s\*\s/g, " \\cdot ")
    .replace(/\*/g, " \\cdot ");

  // 2. Identify common step transitions and auto-inject clear step headings [1]
  const stepRules = [
    { trigger: "Distribute the 2/3", heading: "### Step 1: Distribute Fractional Coefficients" },
    { trigger: "Simplify the multiplication", heading: "### Step 2: Simplify Term Calculations" },
    { trigger: "To eliminate the fraction", heading: "### Step 3: Eliminate Fractional Denominators" },
    { trigger: "Distribute the 3 on both sides", heading: "### Step 4: Apply Left/Right Distribution" },
    { trigger: "Now, we want to arrange", heading: "### Step 5: Group Variables on One Side" },
    { trigger: "Move the constant", heading: "### Step 6: Isolate Variable Terms" },
    { trigger: "The standard form usually", heading: "### Step 7: Standardize Leading Coefficients" }
  ];

  stepRules.forEach(({ trigger, heading }) => {
    cleaned = cleaned.replace(trigger, `\n\n${heading}\n\n${trigger}`);
  });

  // 3. Find equations containing "=" and convert them to centered block math ($$) for breathing room [2]
  cleaned = cleaned.replace(/\$([^$]+=[^$]+)\$/g, "\n\n$$\n$1\n$$\n\n");

  return cleaned;
}

// ── Dynamic Lesson Graphic Visualizer Component ─────────────────────────────
function LessonVisualizer({ nodeId }: { nodeId: string }) {
  const id = nodeId?.toUpperCase() || "";

  if (id.includes("QE")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-2">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <line x1="10" y1="60" x2="190" y2="60" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="100" y1="10" x2="100" y2="110" stroke="#cbd5e1" strokeWidth="1" />
          <path d="M 45 25 Q 100 120 155 25" fill="none" stroke="#001a54" strokeWidth="2.5" />
          <circle cx="68" cy="60" r="4" fill="#fdd400" stroke="#001a54" strokeWidth="1.5" className="animate-pulse" />
          <circle cx="132" cy="60" r="4" fill="#fdd400" stroke="#001a54" strokeWidth="1.5" className="animate-pulse" />
          <text x="54" y="52" className="text-[9px] font-mono font-extrabold fill-[#001a54]">x₁</text>
          <text x="138" y="52" className="text-[9px] font-mono font-extrabold fill-[#001a54]">x₂</text>
        </svg>
        <p className="text-[9px] font-mono text-slate-400 text-center uppercase mt-1 tracking-wider">Parabola Roots [1]</p>
      </div>
    );
  }

  if (id.includes("SLE")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-2">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <line x1="10" y1="60" x2="190" y2="60" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="100" y1="10" x2="100" y2="110" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="30" y1="100" x2="170" y2="20" stroke="#001a54" strokeWidth="2.5" />
          <line x1="30" y1="20" x2="170" y2="100" stroke="#001a54" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="100" cy="60" r="5" fill="#fdd400" stroke="#001a54" strokeWidth="1.5" className="animate-ping" />
          <circle cx="100" cy="60" r="3.5" fill="#fdd400" stroke="#001a54" strokeWidth="1.5" />
          <text x="110" y="55" className="text-[9px] font-mono font-extrabold fill-[#001a54]">(x, y)</text>
        </svg>
        <p className="text-[9px] font-mono text-slate-400 text-center uppercase mt-1 tracking-wider">Line intersection [1]</p>
      </div>
    );
  }

  if (id.includes("RER")) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-3 py-4">
        <div className="flex items-center gap-2 text-center">
          <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
            <span className="font-['Hanken_Grotesk'] text-lg font-extrabold text-[#001a54]">x</span>
            <sup className="text-[10px] font-mono font-bold text-[#fdd400] bg-[#001a54] px-1 rounded ml-0.5">a/b</sup>
          </div>
          <span className="text-[#001a54] font-bold">⟺</span>
          <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm relative flex items-center">
            <sup className="text-[8px] font-mono font-bold text-slate-400 absolute left-1 top-1">b</sup>
            <span className="font-['Hanken_Grotesk'] text-lg font-extrabold text-[#001a54] pl-1">√x</span>
            <sup className="text-[8px] font-mono font-bold text-[#fdd400] bg-[#001a54] px-0.5 rounded ml-0.5">a</sup>
          </div>
        </div>
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-center">
          Exponent to Radical Rule [1]
        </p>
      </div>
    );
  }

  if (id.includes("FP")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-2">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <rect x="30" y="10" width="70" height="70" fill="#001a54" fillOpacity="0.05" stroke="#001a54" strokeWidth="1.5" />
          <text x="65" y="50" className="text-[10px] font-mono font-bold fill-[#001a54]">x²</text>
          <rect x="100" y="10" width="45" height="70" fill="#fdd400" fillOpacity="0.1" stroke="#001a54" strokeWidth="1" strokeDasharray="2 2" />
          <text x="120" y="50" className="text-[10px] font-mono font-bold fill-[#001a54]">3x</text>
          <rect x="30" y="80" width="70" height="30" fill="#fdd400" fillOpacity="0.1" stroke="#001a54" strokeWidth="1" strokeDasharray="2 2" />
          <text x="60" y="100" className="text-[10px] font-mono font-bold fill-[#001a54]">2x</text>
          <rect x="100" y="80" width="45" height="30" fill="#fdd400" stroke="#001a54" strokeWidth="1.5" />
          <text x="120" y="100" className="text-[10px] font-mono font-bold fill-[#001a54]">+6</text>
          <text x="65" y="5" className="text-[8px] font-mono fill-slate-400 text-center">x</text>
          <text x="122" y="5" className="text-[8px] font-mono fill-[#fdd400] font-extrabold text-center">+3</text>
          <text x="20" y="50" className="text-[8px] font-mono fill-slate-400">x</text>
          <text x="18" y="98" className="text-[8px] font-mono fill-[#fdd400] font-extrabold">+2</text>
        </svg>
        <p className="text-[9px] font-mono text-slate-400 text-center uppercase mt-1 tracking-wider">Area Factoring Model [1]</p>
      </div>
    );
  }

  if (id.includes("OI")) {
    return (
      <div className="w-full max-w-[200px] mx-auto py-3">
        <svg viewBox="0 0 200 120" className="w-full h-auto">
          <line x1="10" y1="60" x2="190" y2="60" stroke="#001a54" strokeWidth="1.5" />
          <polygon points="10,56 10,64 2,60" fill="#001a54" />
          <polygon points="190,56 190,64 198,60" fill="#001a54" />
          <line x1="40" y1="55" x2="40" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="70" y1="55" x2="70" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="100" y1="53" x2="100" y2="67" stroke="#001a54" strokeWidth="2" />
          <line x1="130" y1="55" x2="130" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="160" y1="55" x2="160" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          <text x="37" y="76" className="text-[8px] font-mono fill-slate-400">-2</text>
          <text x="67" y="76" className="text-[8px] font-mono fill-slate-400">-1</text>
          <text x="98" y="78" className="text-[9px] font-mono font-extrabold fill-[#001a54]">0</text>
          <text x="127" y="76" className="text-[8px] font-mono fill-slate-400">+1</text>
          <text x="157" y="76" className="text-[8px] font-mono fill-slate-400">+2</text>
          <path d="M 40 60 Q 70 20 100 60" fill="none" stroke="#fdd400" strokeWidth="2" strokeDasharray="2 2" />
          <polygon points="98,53 103,58 97,61" fill="#fdd400" />
          <text x="65" y="32" className="text-[8px] font-mono font-bold fill-[#001a54]">+2</text>
        </svg>
        <p className="text-[9px] font-mono text-slate-400 text-center uppercase mt-1 tracking-wider">Number Line Vector [1]</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <BookOpen size={24} className="text-[#001a54]/40" />
      <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-center mt-2">Theory Workspace [1]</p>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────
export default function LessonPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [content, setContent] = useState<ContentResponse | null>(null);
  const [currentNode, setCurrentNode] = useState<string>(""); // Saves the active node ID [1]
  const [errorType, setErrorType] = useState<"no_content" | "general" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLessonContent = async () => {
    setErrorType(null);
    setErrorMsg(null);

    try {
      const session = await getSession(sessionId);
      setCurrentNode(session.current_node); // Store node code [1]
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

  const ErrorWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-8 shadow-[0_15px_30px_rgba(0,26,84,0.05)] text-center relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#fdd400]/10 rounded-full blur-[40px] pointer-events-none" />
        {children}
      </div>
    </div>
  );

  if (errorType === "no_content") {
    return (
      <ErrorWrapper>
        <span className="font-mono text-[10px] text-[#001a54] bg-[#fdd400]/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">SYSTEM WARN</span>
        <h2 className="text-xl font-bold font-['Hanken_Grotesk',_sans-serif] text-[#001a54] mt-3 mb-2">
          Content Unavailable
        </h2>
        <p className="font-mono text-xs text-slate-500 mb-8 leading-relaxed">
          The node curriculum stream is currently unpopulated for this active track section.
        </p>
        <button
          onClick={handleExit}
          className="w-full sm:w-auto bg-[#001a54] text-white hover:bg-[#001545] border border-transparent py-3 px-8 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)]"
        >
          Exit Session
        </button>
      </ErrorWrapper>
    );
  }

  if (errorType === "general") {
    return (
      <ErrorWrapper>
        <span className="font-mono text-[9px] text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider">DIAGNOSTIC FAULT</span>
        <h2 className="text-xl font-bold font-['Hanken_Grotesk',_sans-serif] text-[#001a54] mt-3 mb-2">System Error</h2>
        <p className="font-mono text-xs text-red-600 bg-red-50/50 border border-red-100 rounded-lg p-3 my-4 break-all text-left">
          [FAULT_LOG] {errorMsg}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button
            onClick={loadLessonContent}
            className="bg-[#001a54] text-white hover:bg-[#001545] py-3 px-6 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)]"
          >
            Retry Connection
          </button>
          <button
            onClick={handleExit}
            className="bg-white hover:bg-slate-50 text-[#001a54] border border-slate-200 hover:border-slate-300 py-3 px-6 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer"
          >
            Exit Workspace
          </button>
        </div>
      </ErrorWrapper>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
          <div className="absolute inset-0 border-4 border-[#001a54] border-t-[#fdd400] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Pre-process raw lesson and math parameters into structured formatted markdown [2]
  const lessonBody = formatLessonMarkdown(resolveLessonText(content));
  const workedExample = formatLessonMarkdown(content.worked_example || "");
  const guidedExplanation = formatLessonMarkdown(content.guided_explanation || "");

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 py-8 px-4 md:px-8">
      
      {/* Dynamic style block to frame, center, and highlight math symbols inside lessons */}
      <style dangerouslySetInnerHTML={{ __html: `
        .markdown-content {
          line-height: 1.8;
        }
        .markdown-content p {
          margin-bottom: 1rem;
          color: #334155;
        }
        /* Beautiful inline math highlighting [2] */
        .markdown-content .katex {
          font-size: 1.05em;
          color: #001a54 !important;
          background-color: rgba(253, 212, 0, 0.12) !important;
          padding: 2px 6px !important;
          border-radius: 6px !important;
          border: 1px solid rgba(253, 212, 0, 0.25) !important;
          font-family: inherit;
        }
        /* Centered mathematical block framing [2] */
        .markdown-content .katex-display {
          margin: 1.25rem 0 !important;
          padding: 0 !important;
        }
        .markdown-content .katex-display .katex {
          background-color: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          padding: 10px 20px !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 12px rgba(0, 26, 84, 0.01) !important;
          display: inline-block !important;
        }
      `}} />

      <div className="max-w-3xl mx-auto space-y-6">

        {/* Premium Bento Header (Navy with Gold Accents) */}
        <header className="bg-[#001a54] rounded-2xl p-6 md:p-8 border border-white/10 shadow-[0_0_30px_rgba(0,26,84,0.4)] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#fdd400]/10 rounded-full blur-[50px] pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#fdd400]/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4 z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400]" />
              <span className="font-mono text-xs text-slate-300 font-bold tracking-[0.2em] uppercase">LESSON STRUCTURE</span>
            </div>
            <button
              onClick={handleExit}
              className="font-mono text-[10px] text-black bg-[#fdd400] hover:bg-black hover:text-white px-3 py-1.5 rounded-xl border border-white/5 transition-all cursor-pointer font-bold uppercase tracking-wider"
            >
              Exit
            </button>
          </div>

          <div className="z-10">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white font-['Hanken_Grotesk',_sans-serif] leading-tight">
              {content.node_label}
            </h1>
            <p className="font-mono text-[10px] text-slate-300 mt-2 tracking-wide uppercase">
              Source document: <span className="text-[#fdd400]">{content.source_doc}</span>
            </p>
          </div>
        </header>

        {/* Content Modules Stack with Dynamic Graphical Visual Aids [1] */}
        <main className="space-y-6">
          
          {/* Primary Lesson Segment with Split Visual Aid Bento Layout [1] */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-[0_4px_12px_rgba(0,26,84,0.02)]">
            <h2 className="text-xs font-mono font-bold text-[#001a54] uppercase tracking-widest mb-6 pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#fdd400]" />
              Core Concept
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left 2 Cols: Markdown Text [1] */}
              <div className="lg:col-span-2 font-sans text-sm md:text-base leading-relaxed space-y-4 text-slate-700 markdown-content">
                <ReactMarkdown 
                  remarkPlugins={[remarkMath]} 
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h3: ({ node, ...props }) => (
                      <h3 className="text-sm font-mono font-bold text-[#001a54] uppercase tracking-widest mt-6 mb-3 pb-1 border-b border-slate-100 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#fdd400]" />
                        {props.children}
                      </h3>
                    )
                  }}
                >
                  {lessonBody}
                </ReactMarkdown>
              </div>
              
              {/* Right 1 Col: Dynamic Concept Visual Sandbox [1] */}
              <div className="lg:col-span-1 bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col justify-between min-h-[220px] relative overflow-hidden group">
                <span className="absolute top-0 right-0 bg-[#001a54] text-[#fdd400] text-[8px] font-mono uppercase font-bold tracking-widest px-2.5 py-1 rounded-bl-lg border-l border-b border-slate-200/10">
                  Visual Aid [1]
                </span>
                <div className="font-mono text-[9px] text-slate-400 uppercase tracking-widest mb-2">Graphic Model [1]</div>
                <div className="flex-1 flex items-center justify-center">
                  <LessonVisualizer nodeId={currentNode} />
                </div>
              </div>
            </div>
          </section>

          {/* Worked Example Segment [1] */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-[0_4px_12px_rgba(0,26,84,0.02)]">
            <h2 className="text-xs font-mono font-bold text-[#001a54] uppercase tracking-widest mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#fdd400]" />
              Worked Example
            </h2>
            <div className="font-sans text-sm md:text-base leading-relaxed space-y-4 text-slate-700 markdown-content">
              <ReactMarkdown 
                remarkPlugins={[remarkMath]} 
                rehypePlugins={[rehypeKatex]}
                components={{
                  h3: ({ node, ...props }) => (
                    <h3 className="text-sm font-mono font-bold text-[#001a54] uppercase tracking-widest mt-6 mb-3 pb-1 border-b border-slate-100 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#fdd400]" />
                      {props.children}
                    </h3>
                  )
                }}
              >
                {workedExample}
              </ReactMarkdown>
            </div>
          </section>

          {/* Guided Explanation Segment [1] */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-[0_4px_12px_rgba(0,26,84,0.02)]">
            <h2 className="text-xs font-mono font-bold text-[#001a54] uppercase tracking-widest mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#fdd400]" />
              Guided Explanation
            </h2>
            <div className="font-sans text-sm md:text-base leading-relaxed space-y-4 text-slate-700 markdown-content">
              <ReactMarkdown 
                remarkPlugins={[remarkMath]} 
                rehypePlugins={[rehypeKatex]}
                components={{
                  h3: ({ node, ...props }) => (
                    <h3 className="text-sm font-mono font-bold text-[#001a54] uppercase tracking-widest mt-6 mb-3 pb-1 border-b border-slate-100 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#fdd400]" />
                      {props.children}
                    </h3>
                  )
                }}
              >
                {guidedExplanation}
              </ReactMarkdown>
            </div>
          </section>

        </main>

        {/* Footer Navigation Section */}
        <footer className="mt-8 pt-6 border-t border-slate-200">
          <button
            onClick={handleStartPractice}
            className="w-full bg-[#001a54] text-white hover:bg-[#001545] border border-transparent py-4 text-sm font-mono uppercase font-bold tracking-wider transition-all rounded-2xl shadow-[0_4px_20px_rgba(0,26,84,0.12)] hover:shadow-[0_0_25px_rgba(253,212,0,0.15)] cursor-pointer flex items-center justify-center gap-2"
          >
            Start Practice Track <span className="text-[#fdd400]">→</span>
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