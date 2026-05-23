"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSession, getContent, ContentResponse } from "../../../../lib/api";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export default function LessonPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [content, setContent] = useState<ContentResponse | null>(null);
  const [errorType, setErrorType] = useState<"no_content" | "general" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLessonContent = async () => {
    setErrorType(null);
    setErrorMsg(null);

    try {
      const session = await getSession(sessionId);
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
    router.push("/dashboard");
  };

  // Shared outer template wrapper for uniform alignment
  const ErrorWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-8 shadow-[0_15px_30px_rgba(0,26,84,0.05)] text-center relative overflow-hidden">
        {/* Glow Details */}
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

  const lessonBody = resolveLessonText(content);

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 py-8 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Premium Bento Header (Navy with Gold Accents) */}
        <header className="bg-[#001a54] rounded-2xl p-6 md:p-8 border border-white/10 shadow-[0_0_30px_rgba(0,26,84,0.4)] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          {/* Subtle ambient gold and navy glow offsets */}
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

        {/* Content Modules Stack (Crisp high-contrast White cards) */}
        <main className="space-y-6">
          
          {/* Primary Lesson Segment */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-[0_4px_12px_rgba(0,26,84,0.02)]">
            <h2 className="text-xs font-mono font-bold text-[#001a54] uppercase tracking-widest mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#fdd400] shadow-[0_0_6px_#fdd400]" />
              Core Concept
            </h2>
            <div className="font-sans text-sm md:text-base leading-relaxed space-y-4 text-slate-700 markdown-content">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {lessonBody}
              </ReactMarkdown>
            </div>
          </section>

          {/* Worked Example Segment */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-[0_4px_12px_rgba(0,26,84,0.02)]">
            <h2 className="text-xs font-mono font-bold text-[#001a54] uppercase tracking-widest mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#fdd400] shadow-[0_0_6px_#fdd400]" />
              Worked Example
            </h2>
            <div className="font-sans text-sm md:text-base leading-relaxed space-y-4 text-slate-700 markdown-content">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {content.worked_example}
              </ReactMarkdown>
            </div>
          </section>

          {/* Guided Explanation Segment */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-[0_4px_12px_rgba(0,26,84,0.02)]">
            <h2 className="text-xs font-mono font-bold text-[#001a54] uppercase tracking-widest mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#fdd400] shadow-[0_0_6px_#fdd400]" />
              Guided Explanation
            </h2>
            <div className="font-sans text-sm md:text-base leading-relaxed space-y-4 text-slate-700 markdown-content">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {content.guided_explanation}
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