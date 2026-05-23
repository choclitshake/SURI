"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainPage from "@/components/mainpage";
import {
  getMe,
  getStudentProgress,
  getSession,
  createSession,
  ActiveSessionProgress,
  MisconceptionHistoryItem,
} from "../../lib/api";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [activeSessions, setActiveSessions] = useState<ActiveSessionProgress[]>([]);
  const [completedSessions, setCompletedSessions] = useState<ActiveSessionProgress[]>([]);
  const [misconceptions, setMisconceptions] = useState<MisconceptionHistoryItem[]>(
    []
  );
  const [showErrors, setShowErrors] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("saved") === "true") {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await getMe();
        setName(me.name);
        const progress = await getStudentProgress(me.student_id);
        setActiveSessions(progress.active_sessions || []);
        setCompletedSessions(progress.completed_sessions || []);
        setMisconceptions(progress.misconception_history || []);
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "status" in err
            ? (err as { status: number }).status
            : 0;
        if (status === 401) {
          router.replace("/login");
          return;
        }
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to load dashboard."
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const handleResume = async (sessionId: string) => {
    try {
      await getSession(sessionId);
      router.push(`/session/${sessionId}/lesson`);
    } catch {
      setErrorMsg("Could not resume session.");
    }
  };

  const handleReviewAgain = async (topicEntryNode: string) => {
    try {
      const newSession = await createSession({ topic_entry_node: topicEntryNode });
      router.push(`/session/${newSession.id}/diagnostic`);
    } catch {
      setErrorMsg("Could not create review session.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black font-sans flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <MainPage>
      {showSaved && (
        <div className="mb-6 border border-green-600 bg-green-50 text-green-800 p-4 text-center font-mono text-sm">
          Progress saved.
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 border border-black p-4 text-sm font-mono text-red-600">
          [ERROR] {errorMsg}
        </div>
      )}

      <header className="border-b border-black pb-4 mb-8">
        <h1 className="text-2xl font-mono font-bold uppercase">
          {name}&apos;s Dashboard
        </h1>
      </header>

      <section className="mb-10">
        <h2 className="text-lg font-mono font-bold uppercase mb-4">
          Active Topics
        </h2>

        {activeSessions.length === 0 ? (
          <div className="border border-black p-6 text-center">
            <p className="font-mono text-sm mb-6">No active topics yet.</p>
            <button
              type="button"
              onClick={() => router.push("/topics")}
              className="border border-black py-3 px-6 text-sm font-mono uppercase font-bold bg-white hover:bg-black hover:text-white cursor-pointer"
            >
              Start a Topic
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {activeSessions.map((s) => {
              const pct = parseFloat(String(s.completion_percentage)) || 0;
              return (
                <div key={s.id} className="border border-black p-6">
                  <p className="text-lg font-bold font-mono uppercase">
                    {s.topic_label}
                  </p>
                  <p className="text-sm font-mono text-gray-600 mt-1">
                    Currently on: {s.current_node_label}
                  </p>

                  <div className="mt-4">
                    <div className="w-full h-3 bg-gray-200 border border-black">
                      <div
                        className="h-full bg-black transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="font-mono text-xs mt-2">
                      {pct}%
                    </p>
                  </div>

                  <p className="font-mono text-sm mt-3 text-gray-700">
                    {s.mastered_count} of {s.total_in_chain} competencies mastered
                    ({s.diagnostic_count} from diagnostic, {s.practice_count} from
                    practice)
                  </p>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleResume(s.id)}
                      className="border border-black py-2 px-5 text-sm font-mono uppercase font-bold bg-white hover:bg-black hover:text-white cursor-pointer"
                    >
                      Resume
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {completedSessions.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-mono font-bold uppercase mb-4">
            Completed Topics
          </h2>
          <div className="space-y-6">
            {completedSessions.map((s) => (
              <div key={s.id} className="border border-black p-6 bg-white">
                <p className="text-lg font-bold font-mono uppercase">
                  {s.topic_label}
                </p>
                <p className="text-sm font-mono text-gray-600 mt-1">
                  All {s.total_in_chain} competencies mastered
                </p>

                <div className="mt-4">
                  <div className="w-full h-3 bg-gray-200 border border-black">
                    <div
                      className="h-full bg-black transition-all"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <p className="font-mono text-xs mt-2">
                    100%
                  </p>
                </div>

                <p className="font-mono text-sm mt-3 text-gray-700">
                  Completed on: {s.completed_at ? formatDate(s.completed_at) : ""}
                </p>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleReviewAgain(s.topic_entry_node)}
                    className="border border-black py-2 px-5 text-sm font-mono uppercase font-bold bg-white hover:bg-black hover:text-white cursor-pointer"
                  >
                    Review Again
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-mono font-bold uppercase">
            Error History
          </h2>
          <button
            type="button"
            onClick={() => setShowErrors((v) => !v)}
            className="border border-black py-1 px-3 text-xs font-mono uppercase hover:bg-black hover:text-white cursor-pointer"
          >
            {showErrors ? "Hide" : "Show"}
          </button>
        </div>

        {showErrors && (
          <div className="border border-black divide-y divide-black">
            {misconceptions.length === 0 ? (
              <p className="p-4 font-mono text-sm text-gray-600">
                No errors logged yet.
              </p>
            ) : (
              misconceptions.map((item, idx) => (
                <div
                  key={`${item.node_id}-${item.logged_at}-${idx}`}
                  className="p-4 flex justify-between gap-4"
                >
                  <div>
                    <p className="font-mono text-sm font-bold">
                      {item.node_label}
                    </p>
                    <p className="font-mono text-xs text-gray-700 mt-1">
                      {item.step_description}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(item.logged_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => router.push("/topics")}
        className="w-full border border-black py-4 text-base font-mono uppercase font-bold tracking-wider bg-white hover:bg-black hover:text-white cursor-pointer"
      >
        Start a New Topic
      </button>
    </MainPage>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
