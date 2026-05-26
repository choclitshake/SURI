"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  BookOpen,
  TrendingUp,
  Lock,
  Check,
  Flame,
  Sparkles,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className="w-full aspect-[2/1] rounded-[24px] bg-[#e6e8ea]" />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-[#e6e8ea] rounded-[32px] h-72" />
        </div>
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-6">
          <div className="bg-[#e6e8ea] rounded-[24px] h-64" />
        </div>
        <div className="col-span-12 lg:col-span-6">
          <div className="bg-[#e6e8ea] rounded-[24px] h-64" />
        </div>
      </div>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [activeSessions, setActiveSessions] = useState<ActiveSessionProgress[]>([]);
  const [completedSessions, setCompletedSessions] = useState<ActiveSessionProgress[]>([]);
  const [misconceptions, setMisconceptions] = useState<MisconceptionHistoryItem[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("saved") === "true") {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, []);

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

  const coursePct = activeSessions.length > 0
    ? Math.round(activeSessions.reduce((sum, s) => sum + (parseFloat(String(s.completion_percentage)) || 0), 0) / activeSessions.length)
    : 0;

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      {showSaved && (
        <div className="mb-6 border border-green-600 bg-green-50 text-green-800 p-4 text-center text-sm rounded-[24px]">
          Progress saved.
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 border border-red-600 bg-red-50 p-4 text-sm text-red-600 rounded-[24px]">
          {errorMsg}
        </div>
      )}

      {/* Row 1: Challenge + Performance Report */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-12 lg:col-span-8">
          <section>
            <div className="relative w-full aspect-[2/1] rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] bg-[#88C154] group">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAEXma6INVd0pxsf2NimA83gxdCqv-1PqJrcWOioIbkPEtj3Z7oIxOvuUvLYNc4Dp9x3Y1BdR1CuvLCFJx5RSzJA9_Kk02IsPNQSy0DeGhX33fZvqV6ZTAci5gEWEnXt3d5H0IqVOBVrHAtZ0wRSpSPEhIZkwT8lWCqZo0inU40TzVsVWo-vjMqvT5w8nLCUkx-agKpKsnu_I62S8u6WesHawWnmWYTE_400YVkv8YcJ_L_q-lbQ4H0O-Ey3ld_l4PtBxxi-Kv7vQ8')" }}
              />
              <div className="absolute inset-0 bg-black/20" />

              <div className="absolute top-8 left-8 z-10">
                <h2 className="font-['Hanken_Grotesk'] text-5xl md:text-6xl font-extrabold text-white leading-tight">
                  Welcome back, {name}!
                </h2>
                <p className="text-white/70 text-base md:text-lg mt-2 font-['Manrope'] font-medium">
                  {activeSessions.length > 0
                    ? `Continue "${activeSessions[0].topic_label}"`
                    : "Ready for a new challenge?"}
                </p>
              </div>

              <div className="absolute left-[15%] top-[35%] flex flex-col items-center island-node cursor-pointer">
                <div className="w-14 h-14 rounded-full bg-[#1F2720] border-4 border-white flex items-center justify-center text-white shadow-xl">
                  <Check className="w-7 h-7" />
                </div>
                <span className="mt-2 bg-white px-3 py-1 rounded-full text-[10px] font-bold uppercase text-[#1F2720] shadow-sm">
                  {completedSessions.length > 0 ? completedSessions[0].topic_label.slice(0, 10) : "Getting Started"}
                </span>
              </div>

              <div className="absolute left-[35%] top-[55%] flex flex-col items-center island-node cursor-pointer scale-110">
                <div className="w-16 h-16 rounded-full bg-[#fdd400] border-4 border-white flex items-center justify-center text-[#221b00] shadow-2xl animate-pulse">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <span className="mt-2 bg-[#fdd400] text-[#221b00] px-4 py-1.5 rounded-full text-[12px] font-black uppercase shadow-md">
                  {activeSessions.length > 0 ? activeSessions[0].topic_label.slice(0, 12) : "No Active"}
                </span>
              </div>

              <div className="absolute left-[60%] top-[40%] flex flex-col items-center island-node opacity-60">
                <div className="w-14 h-14 rounded-full bg-[#e0e3e5] border-4 border-white flex items-center justify-center text-[#c3c5d9] shadow-lg">
                  <Lock className="w-7 h-7" />
                </div>
                <span className="mt-2 bg-white/50 px-3 py-1 rounded-full text-[10px] font-bold uppercase text-[#434656]">Quadratics</span>
              </div>

              <div className="absolute right-[15%] top-[60%] flex flex-col items-center island-node opacity-60">
                <div className="w-14 h-14 rounded-full bg-[#e0e3e5] border-4 border-white flex items-center justify-center text-[#c3c5d9] shadow-lg">
                  <Lock className="w-7 h-7" />
                </div>
                <span className="mt-2 bg-white/50 px-3 py-1 rounded-full text-[10px] font-bold uppercase text-[#434656]">Exponents</span>
              </div>
            </div>
          </section>
        </div>

        <aside className="col-span-12 lg:col-span-4">
          <section className="bg-white p-8 rounded-[32px] shadow-[0_4px_20px_rgba(0,0,0,0.04)] h-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-['Hanken_Grotesk'] text-headline-md text-[#191c1e]">Performance Report</h2>
            </div>
            <div className="flex flex-col items-center mb-8">
              <div className="w-24 h-24 rounded-full border-[6px] border-[#fdd400] p-1 relative mb-4">
                <div className="w-full h-full rounded-full bg-[#e6e8ea] flex items-center justify-center overflow-hidden">
                  <span className="font-['Hanken_Grotesk'] text-2xl font-bold text-[#1F2720]">
                    {name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
                  </span>
                </div>
              </div>
              <h3 className="font-['Hanken_Grotesk'] text-headline-md text-[#191c1e]">{name || "Student"}</h3>
              <div className="mt-2 flex items-center gap-1 text-[#705d00] font-black">
                <Flame className="w-5 h-5 fill-[#705d00]" />
                <span>{totalMastered * 10 + completedSessions.length * 50} Points</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-['Manrope'] text-[12px] font-bold text-[#191c1e]">Course Mastery</span>
                  <span className="font-['Manrope'] text-[12px] font-bold text-[#1F2720]">{coursePct}%</span>
                </div>
                <div className="h-3 w-full bg-[#e6e8ea] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1F2720] rounded-full transition-all"
                    style={{ width: `${coursePct}%` }}
                  />
                </div>
                <p className="font-['Manrope'] text-[11px] text-[#434656] mt-1.5">
                  {totalMastered} of {totalCompetencies} competencies mastered
                  {activeSessions.length > 0 ? ` across ${activeSessions.length} topic${activeSessions.length !== 1 ? "s" : ""}` : ""}.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Row 2: Active Lessons + Error History - Full Width */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-6">
          <section className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="flex items-center gap-2 font-['Hanken_Grotesk'] text-headline-md text-[#191c1e] m-0">
                <BookOpen className="w-6 h-6 text-[#1F2720]" />
                Active Lessons
              </h3>
              <button
                type="button"
                onClick={() => router.push("/topics")}
                className="font-['Manrope'] text-[12px] font-bold text-[#1F2720] inline-flex items-center gap-1.5 cursor-pointer hover:underline shrink-0"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {activeSessions.length === 0 ? (
              <div className="text-center py-8 flex flex-col items-center justify-center flex-1">
                <p className="text-[#434656] text-sm mb-4">No active lessons yet.</p>
                <button
                  type="button"
                  onClick={() => router.push("/topics")}
                  className="bg-[#fdd400] text-[#221b00] px-6 py-3 rounded-full font-['Manrope'] text-[12px] font-bold shadow-[0_4px_20px_rgba(0,0,0,0.04)] cursor-pointer"
                >
                  Start a Topic
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 flex-1">
                {activeSessions.slice(0, 5).map((s) => {
                  const pct = parseFloat(String(s.completion_percentage)) || 0;
                  return (
                    <div key={s.id} className="flex items-center gap-3 w-full">
                      <span className="w-10 h-10 rounded-xl bg-[#1F2720]/10 text-[#1F2720] grid place-items-center shrink-0">
                        <BookOpen className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-['Manrope'] text-sm font-bold text-[#191c1e] m-0 mb-0.5 truncate">{s.topic_label}</h4>
                        <p className="font-['Manrope'] text-body-md text-[#434656] m-0 truncate">{s.current_node_label}</p>
                        <div className="mt-2 w-full h-1.5 bg-[#e6e8ea] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1F2720] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="font-['Manrope'] text-[10px] font-bold px-2 py-1 rounded-md bg-[#1F2720]/10 text-[#1F2720] uppercase shrink-0">
                        {s.mastered_count}/{s.total_in_chain}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleResume(s.id)}
                        className="p-2 text-[#1F2720] hover:text-[#fdd400] transition-colors cursor-pointer shrink-0"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <section className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="flex items-center gap-2 font-['Hanken_Grotesk'] text-headline-md text-[#191c1e] m-0">
                <Sparkles className="w-6 h-6 text-[#1F2720]" />
                Error History
              </h3>
              <button
                type="button"
                onClick={() => setShowErrors((v) => !v)}
                className="font-['Manrope'] text-[12px] font-bold px-3 py-1.5 rounded-lg bg-[#f2f4f6] text-[#434656] hover:bg-[#e6e8ea] transition-colors cursor-pointer shrink-0"
              >
                {showErrors ? "Hide" : "Show"}
              </button>
            </div>

            <div className="flex-1">
              {!showErrors ? (
                <p className="text-[#434656] text-sm text-center py-4">
                  {misconceptions.length} error{misconceptions.length !== 1 ? "s" : ""} logged. Click show to view.
                </p>
              ) : misconceptions.length === 0 ? (
                <p className="text-[#434656] text-sm text-center py-4">No errors logged yet.</p>
              ) : (
                <div className="divide-y divide-[#c3c5d9]/50 max-h-[280px] overflow-y-auto">
                  {misconceptions.slice(0, 5).map((item, idx) => (
                    <div
                      key={`${item.node_id}-${item.logged_at}-${idx}`}
                      className="py-3 flex justify-between gap-4 w-full"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-['Manrope'] text-sm font-bold text-[#191c1e] m-0">{item.node_label}</p>
                        <p className="font-['Manrope'] text-body-md text-[#434656] mt-0.5 m-0 truncate">{item.step_description}</p>
                      </div>
                      <p className="font-['Manrope'] text-xs text-[#737688] whitespace-nowrap m-0 shrink-0">
                        {formatDate(item.logged_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <MainPage>
      <DashboardContent />
    </MainPage>
  );
}
