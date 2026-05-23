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
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  PlayCircle,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";

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

  const totalMastered = activeSessions.reduce((sum, s) => sum + s.mastered_count, 0);
  const totalCompetencies = activeSessions.reduce((sum, s) => sum + s.total_in_chain, 0);
  const overallMastery = activeSessions.length > 0
    ? Math.round(activeSessions.reduce((sum, s) => sum + (parseFloat(String(s.completion_percentage)) || 0), 0) / activeSessions.length)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <MainPage>
      {showSaved && (
        <div className="mb-6 border border-green-600 bg-green-50 text-green-800 p-4 text-center text-sm rounded-xl">
          Progress saved.
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 border border-red-600 bg-red-50 p-4 text-sm text-red-600 rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* Welcome */}
      <section className="flex justify-between items-start gap-8 mb-6 max-sm:flex-col max-sm:gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-['Hanken_Grotesk',system-ui,sans-serif] text-[32px] font-extrabold m-0 leading-tight">
            Welcome back, {name}! 👋
          </h2>
          <p className="text-[#434656] text-base max-w-[520px] m-0">
            {activeSessions.length > 0
              ? `Continue where you left off on "${activeSessions[0].topic_label}".`
              : "Ready to start a new learning adventure?"}
          </p>
        </div>
        <div className="flex gap-3 max-sm:w-full max-sm:flex-col">
          {activeSessions.length > 0 && (
            <button
              type="button"
              onClick={() => handleResume(activeSessions[0].id)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#fdd400] text-[#221b00] rounded-xl text-xs font-bold shadow-[0_10px_18px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              <PlayCircle className="w-[26px] h-[26px]" />
              Resume {activeSessions[0].topic_label}
            </button>
          )}
        </div>
      </section>

      {/* Grid Row 1 */}
      <section className="grid grid-cols-12 gap-4 mb-5">
        {/* Overall Mastery */}
        <div className="col-span-12 lg:col-span-8 bg-[#001a54] text-white rounded-2xl p-5 shadow-[0_14px_32px_rgba(0,0,0,0.12)] border border-[rgba(195,197,217,0.25)] relative overflow-hidden flex flex-col justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-white/20 uppercase tracking-[0.08em]">
              <TrendingUp className="w-[14px] h-[14px]" />
              Overall Mastery
            </span>
            <h3 className="font-['Hanken_Grotesk',system-ui,sans-serif] text-[56px] font-extrabold m-0 mt-2 mb-1 leading-none">
              {overallMastery}%
            </h3>
            <p className="text-[#dde1ff] max-w-[320px] m-0 text-sm">
              {activeSessions.length > 0
                ? `${totalMastered} of ${totalCompetencies} competencies mastered across ${activeSessions.length} topic${activeSessions.length !== 1 ? "s" : ""}.`
                : "Start a topic to begin tracking your mastery."}
            </p>
          </div>
          {activeSessions.length > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Progress</span>
                <span>{overallMastery}% complete</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#69ff87] rounded-full shadow-[0_0_14px_rgba(105,255,135,0.6)] transition-all"
                  style={{ width: `${overallMastery}%` }}
                />
              </div>
            </div>
          )}
          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-white/[0.08] rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Completed Topics */}
        <div className="col-span-12 lg:col-span-4 bg-[#fdd400] text-[#221b00] rounded-2xl p-5 shadow-[0_14px_32px_rgba(0,0,0,0.12)] border border-[rgba(195,197,217,0.25)] relative overflow-hidden flex flex-col justify-between">
          {completedSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center flex-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-white/20 uppercase tracking-[0.08em] mb-3">
                <Trophy className="w-[14px] h-[14px]" />
                Completed Topics
              </span>
              <h3 className="font-['Hanken_Grotesk',system-ui,sans-serif] text-[56px] font-extrabold m-0 leading-none">
                {completedSessions.length}
              </h3>
              <p className="m-0 mt-2 opacity-80 text-sm">Topics mastered</p>
            </div>
          ) : (
            <>
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-white/20 uppercase tracking-[0.08em]">
                  <Trophy className="w-[14px] h-[14px]" />
                  Completed Topics
                </span>
                <h3 className="font-['Hanken_Grotesk',system-ui,sans-serif] text-[56px] font-extrabold m-0 mt-2 mb-1 leading-none">
                  {completedSessions.length}
                </h3>
                <p className="m-0 opacity-80 text-sm">
                  {completedSessions.length === 1 ? "Topic mastered" : "Topics mastered"}
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {completedSessions.slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-white/45 rounded-lg p-2 gap-2">
                    <span className="text-xs font-bold truncate">{s.topic_label}</span>
                    <button
                      type="button"
                      onClick={() => handleReviewAgain(s.topic_entry_node)}
                      className="text-[10px] font-bold px-2 py-1 rounded bg-[#221b00]/10 hover:bg-[#221b00]/20 transition-colors shrink-0 cursor-pointer"
                    >
                      Review
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Grid Row 2 */}
      <section className="grid grid-cols-12 gap-4">
        {/* Recent Activity */}
        <div className="col-span-12 lg:col-span-6 bg-[#f2f4f6] rounded-2xl p-7 shadow-[0_14px_32px_rgba(0,0,0,0.12)] border border-[rgba(195,197,217,0.25)]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="flex items-center gap-2 font-['Hanken_Grotesk',system-ui,sans-serif] text-xl m-0">
              <CheckCircle2 className="w-[26px] h-[26px] text-[#001a54]" />
              Recent Activity
            </h3>
            <button
              type="button"
              onClick={() => router.push("/topics")}
              className="border-none bg-transparent text-xs font-bold text-[#001a54] inline-flex items-center gap-1.5 cursor-pointer hover:underline"
            >
              View All
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {activeSessions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[#434656] text-sm mb-4">No activity yet.</p>
              <button
                type="button"
                onClick={() => router.push("/topics")}
                className="bg-[#fdd400] text-[#221b00] px-6 py-3 rounded-xl text-xs font-bold shadow-[0_10px_18px_rgba(0,0,0,0.08)] cursor-pointer"
              >
                Start a Topic
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {activeSessions.slice(0, 5).map((s) => {
                const pct = parseFloat(String(s.completion_percentage)) || 0;
                return (
                  <div key={s.id} className="flex items-center gap-4">
                    <span className="w-10 h-10 rounded-xl bg-[rgba(0,26,84,0.1)] text-[#001a54] grid place-items-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold m-0 mb-0.5">{s.topic_label}</h4>
                      <p className="text-xs text-[#434656] m-0 truncate">{s.current_node_label}</p>
                      <div className="mt-2 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#69ff87] rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-[#dde1ff] text-[#001452] uppercase shrink-0">
                      {s.mastered_count}/{s.total_in_chain}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleResume(s.id)}
                      className="p-2 text-[#001a54] hover:text-[#fdd400] transition-colors cursor-pointer shrink-0"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Error History */}
        <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl p-7 shadow-[0_14px_32px_rgba(0,0,0,0.12)] border border-[rgba(195,197,217,0.25)]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="flex items-center gap-2 font-['Hanken_Grotesk',system-ui,sans-serif] text-xl m-0">
              <Sparkles className="w-[26px] h-[26px] text-[#001a54]" />
              Error History
            </h3>
            <button
              type="button"
              onClick={() => setShowErrors((v) => !v)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#f2f4f6] text-[#434656] hover:bg-[#e6e8ea] transition-colors cursor-pointer"
            >
              {showErrors ? "Hide" : "Show"}
            </button>
          </div>

          {!showErrors ? (
            <p className="text-[#434656] text-sm text-center py-4">
              {misconceptions.length} error{misconceptions.length !== 1 ? "s" : ""} logged. Click show to view.
            </p>
          ) : misconceptions.length === 0 ? (
            <p className="text-[#434656] text-sm text-center py-4">No errors logged yet.</p>
          ) : (
            <div className="divide-y divide-[#c3c5d9] max-h-[320px] overflow-y-auto">
              {misconceptions.slice(0, 5).map((item, idx) => (
                <div
                  key={`${item.node_id}-${item.logged_at}-${idx}`}
                  className="py-3 flex justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold m-0">{item.node_label}</p>
                    <p className="text-xs text-[#434656] mt-0.5 m-0 truncate">{item.step_description}</p>
                  </div>
                  <p className="text-xs text-gray-500 whitespace-nowrap m-0 shrink-0">
                    {formatDate(item.logged_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
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