"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSession, getContent, ContentResponse } from "../../../../lib/api";

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

  const handleBackToTopics = () => {
    router.push("/topics");
  };

  if (errorType === "no_content") {
    return (
      <div className="min-h-screen bg-white text-black font-sans p-8 max-w-xl mx-auto flex flex-col justify-center">
        <div className="border border-black p-8 text-center">
          <h2 className="text-xl font-mono uppercase font-bold mb-4">
            Content unavailable
          </h2>
          <button
            onClick={handleBackToTopics}
            className="border border-black py-3 px-6 text-sm font-mono uppercase transition-all bg-white hover:bg-black hover:text-white cursor-pointer font-bold"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (errorType === "general") {
    return (
      <div className="min-h-screen bg-white text-black font-sans p-8 max-w-xl mx-auto flex flex-col justify-center">
        <div className="border border-black p-8 text-center">
          <h2 className="text-xl font-mono uppercase font-bold mb-4">Error</h2>
          <p className="font-mono text-xs text-red-600 mb-8 break-words">
            [ERROR] {errorMsg}
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={loadLessonContent}
              className="border border-black py-3 px-6 text-sm font-mono uppercase transition-all bg-white hover:bg-black hover:text-white cursor-pointer font-bold"
            >
              Retry
            </button>
            <button
              onClick={handleBackToTopics}
              className="border border-black py-3 px-6 text-sm font-mono uppercase transition-all bg-white hover:bg-black hover:text-white cursor-pointer font-bold"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!content) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans p-8 max-w-2xl mx-auto">
      <header className="border-b border-black pb-4 mb-8">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-mono font-bold uppercase tracking-wide">
              {content.node_label}
            </h1>
            <p className="text-xs font-mono text-gray-500 mt-2">
              Source: {content.source_doc}
            </p>
          </div>
          <button
            onClick={handleBackToTopics}
            className="border border-black py-1.5 px-3 text-xs font-mono uppercase transition-all bg-white hover:bg-black hover:text-white cursor-pointer font-bold"
          >
            Exit
          </button>
        </div>
      </header>

      <main className="space-y-12">
        <section className="border border-black p-6">
          <h2 className="text-lg font-mono font-bold uppercase mb-4 pb-2 border-b border-gray-200">
            Lesson
          </h2>
          <div className="font-sans text-sm leading-relaxed space-y-4 whitespace-pre-line text-gray-800">
            {content.lesson}
          </div>
        </section>

        <section className="border border-black p-6">
          <h2 className="text-lg font-mono font-bold uppercase mb-4 pb-2 border-b border-gray-200">
            Worked Example
          </h2>
          <div className="font-sans text-sm leading-relaxed whitespace-pre-line text-gray-800">
            {content.worked_example}
          </div>
        </section>

        <section className="border border-black p-6">
          <h2 className="text-lg font-mono font-bold uppercase mb-4 pb-2 border-b border-gray-200">
            Guided Explanation
          </h2>
          <div className="font-sans text-sm leading-relaxed whitespace-pre-line text-gray-800">
            {content.guided_explanation}
          </div>
        </section>
      </main>

      <footer className="mt-12 pt-8 border-t border-black">
        <button
          onClick={handleStartPractice}
          className="w-full border border-black py-4 text-base font-mono uppercase font-bold tracking-wider transition-all bg-white hover:bg-black hover:text-white cursor-pointer"
        >
          Start Practice
        </button>
      </footer>
    </div>
  );
}
