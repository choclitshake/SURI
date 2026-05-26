"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import MainPage from "@/components/mainpage";

import {
  getMe,
  getTopics,
  getStudentProgress,
  getGraphChain,
  createSession,
  skipDiagnostic,
} from "../../lib/api";

import {
  BookOpen,
  CheckCircle2,
  Loader2,
  Flame,
  Lock,
  AlertTriangle,
} from "lucide-react";

interface ChainNode {
  node_id: string;
  node_label: string;
  grade: number;
}

type NodeStatus =
  | "mastered"
  | "in_progress"
  | "unresolved"
  | "not_attempted";

export default function ProgressPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
            <div className="absolute inset-0 border-4 border-[#001a54] border-t-[#fdd400] rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <ProgressContent />
    </Suspense>
  );
}

function ProgressContent() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [topics, setTopics] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  const [nodeStatuses, setNodeStatuses] = useState<
    Record<string, NodeStatus>
  >({});

  const [topicChains, setTopicChains] = useState<
    Record<string, ChainNode[]>
  >({});

  const [launchingNodeId, setLaunchingNodeId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const [me, topicsData] = await Promise.all([
          getMe(),
          getTopics(),
        ]);

        const progress = await getStudentProgress(me.student_id);

        setActiveSessions(progress.active_sessions || []);

        const statuses: Record<string, NodeStatus> = {};

        const scanSession = (session: any) => {
          session.mastered_nodes?.forEach((n: any) => {
            statuses[n.node_id] = "mastered";
          });

          session.in_progress_nodes?.forEach((n: any) => {
            if (statuses[n.node_id] !== "mastered") {
              statuses[n.node_id] = "in_progress";
            }
          });

          session.unresolved_nodes?.forEach((n: any) => {
            if (
              statuses[n.node_id] !== "mastered" &&
              statuses[n.node_id] !== "in_progress"
            ) {
              statuses[n.node_id] = "unresolved";
            }
          });
        };

        progress.active_sessions?.forEach(scanSession);
        progress.completed_sessions?.forEach(scanSession);

        setNodeStatuses(statuses);
        setTopics(topicsData);

        const chainsMap: Record<string, ChainNode[]> = {};

        await Promise.all(
          topicsData.map(async (topic: any) => {
            try {
              const chainData = await getGraphChain(topic.node_id);

              chainsMap[topic.node_id] = chainData.chain || [];
            } catch (err) {
              console.error(
                `Failed to load chain for ${topic.node_id}`,
                err
              );

              chainsMap[topic.node_id] = [];
            }
          })
        );

        setTopicChains(chainsMap);
      } catch (err: any) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Failed to load progress metrics."
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleStudyNode = async (nodeId: string) => {
    setLaunchingNodeId(nodeId);
    setErrorMsg(null);

    try {
      const existingSession = activeSessions.find(
        (s) => s.topic_entry_node === nodeId
      );

      if (existingSession) {
        router.push(`/session/${existingSession.id}/lesson`);
        return;
      }

      const newSession = await createSession({
        topic_entry_node: nodeId,
      });

      await skipDiagnostic(newSession.id);

      router.push(`/session/${newSession.id}/lesson`);
    } catch {
      setErrorMsg(
        "Failed to launch lesson path. Please try again."
      );
    } finally {
      setLaunchingNodeId(null);
    }
  };

  const getStatusBadge = (
    status: NodeStatus | undefined
  ) => {
    switch (status) {
      case "mastered":
        return {
          text: "Mastered",
          bg: "bg-green-50 text-green-700 border-green-200",
        };

      case "unresolved":
        return {
          text: "Needs Work",
          bg: "bg-red-50 text-red-700 border-red-200",
        };

      case "in_progress":
        return {
          text: "In Progress",
          bg: "bg-yellow-50 text-yellow-700 border-yellow-200",
        };

      default:
        return {
          text: "Not Attempted",
          bg: "bg-slate-100 text-slate-400 border-slate-200",
        };
    }
  };

  if (loading) {
    return (
      <MainPage>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <Loader2 className="w-10 h-10 animate-spin text-[#223324]" />
        </div>
      </MainPage>
    );
  }

  return (
    <MainPage>
      <div className=" min-h-screen text-[#1F2720] py-4 px-2 md:px-4">

        {/* Wider Layout */}
        <div className="w-full max-w-[1800px] mx-auto space-y-6">

          {/* Header */}
          <header className="bg-[#223324] rounded-[32px] p-6 md:p-8 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] relative overflow-hidden flex flex-col justify-between min-h-[160px]">

            <div className="absolute top-0 right-0 opacity-50 z-0">
              <img
                src="/suri-snake-left.png"
                alt="Suri Mascot"
                className="w-48 h-auto object-contain translate-x-4 -translate-y-4 pointer-events-none"
              />
            </div>

            <div className="flex items-center justify-between mb-4 z-10">
              <div className="flex items-center gap-2 bg-[#1b261c] px-3 py-1.5 rounded-full border-[2px] border-[#1F2720]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse border border-[#1F2720]" />

                <span className="font-['Manrope'] text-xs text-[#fdd400] font-black tracking-[0.2em] uppercase">
                  CURRICULUM FLOW
                </span>
              </div>

              <span className="font-['Manrope'] text-[10px] text-[#1F2720] font-black bg-[#fdd400] px-3 py-1.5 rounded-md border-2 border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720] uppercase">
                MAP_ACTIVE
              </span>
            </div>

            <div className="z-10 mt-6">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white font-['Hanken_Grotesk']">
                Curriculum{" "}
                <span className="text-[#fdd400]">
                  Progress Map
                </span>
              </h1>

              <p className="font-['Manrope'] text-sm text-[#ffe170] mt-2 font-bold uppercase">
                Diagnostic prerequisite tracking and mastery
                index of algebra nodes.
              </p>
            </div>
          </header>

          {/* Error */}
          {errorMsg && (
            <div className="bg-red-100 border-[3px] border-[#1F2720] rounded-[24px] p-5 shadow-[4px_4px_0px_0px_#1F2720] flex items-start gap-4">

              <img
                src="/suri-snake-sad.png"
                alt="Sad Suri"
                className="w-10 h-10 object-contain shrink-0"
              />

              <div>
                <span className="font-['Manrope'] text-xs text-red-800 font-black uppercase tracking-widest block mb-1">
                  [CURRICULUM EXCEPTION]
                </span>

                <p className="font-['Manrope'] text-sm text-red-900 font-bold">
                  {errorMsg}
                </p>
              </div>
            </div>
          )}

          {/* Topics */}
          <div className="space-y-6">
            {topics.map((topic) => {
              const chain =
                topicChains[topic.node_id] || [];

              const trackTotal = chain.length;

              const trackMastered = chain.filter(
                (n) =>
                  nodeStatuses[n.node_id] === "mastered"
              ).length;

              const trackPct =
                trackTotal > 0
                  ? Math.round(
                      (trackMastered / trackTotal) * 100
                    )
                  : 0;

              return (
                <div
                  key={topic.node_id}
                  className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] p-6"
                >
                  {/* Topic Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b-4 border-[#1F2720]">

                    <div className="space-y-2">
                      <span className="font-['Manrope'] text-[10px] text-[#1F2720] font-black bg-[#e6e8ea] border-2 border-[#1F2720] px-2 py-1 rounded-md uppercase tracking-wider inline-block">
                        Grade {topic.grade} • ID:{" "}
                        {topic.node_id}
                      </span>

                      <h3 className="font-['Hanken_Grotesk'] text-2xl font-black text-[#1F2720]">
                        {topic.label}
                      </h3>
                    </div>

                    {/* Progress */}
                    <div className="w-full lg:w-72 space-y-2 bg-white p-3 rounded-2xl border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720]">

                      <div className="flex justify-between text-[11px] font-black uppercase">
                        <span>Track Mastery</span>

                        <span className="bg-[#fdd400] px-2 py-0.5 rounded-md border-2 border-[#1F2720]">
                          {trackPct}%
                        </span>
                      </div>

                      <div className="h-4 bg-[#e6e8ea] rounded-full overflow-hidden border-[3px] border-[#1F2720] p-0.5">

                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full"
                          style={{
                            width: `${trackPct}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Chain */}
                  {chain.length > 0 ? (
                    <div className="relative mt-8 bg-[#223324] rounded-[24px] border-[4px] border-[#1F2720] overflow-x-auto overflow-y-hidden p-6">

                      <div
                        className="flex items-center gap-12 min-w-max pb-4 pt-2 px-6"
                        style={{
                          scrollbarWidth: "thin",
                          msOverflowStyle: "auto",
                        }}
                      >
                        {[...chain].reverse().map((node) => {
                            const status: NodeStatus =
                            nodeStatuses[node.node_id] || "not_attempted";

                          const badge =
                            getStatusBadge(status);

                          const isNodeLoading =
                            launchingNodeId ===
                            node.node_id;

                          return (
                            <div
                              key={node.node_id}
                              className="flex flex-col items-center gap-3 min-w-[220px]"
                            >
                              {/* Status Circle */}
                              <div
                                className={`w-16 h-16 rounded-full border-[4px] border-[#1F2720] flex items-center justify-center shadow-[4px_4px_0px_0px_#1F2720]
                                ${
                                  status === "mastered"
                                    ? "bg-[#79ff8f] text-[#1b4320]"
                                    : status ===
                                      "in_progress"
                                    ? "bg-[#fdd400] text-[#221b00]"
                                    : "bg-[#ccd3cd] text-[#525f54]"
                                }`}
                              >
                               {status === "mastered" && (
                                      <CheckCircle2 className="w-8 h-8 stroke-[3px]" />
                                    )}

                                    {status === "in_progress" && (
                                      <Flame className="w-8 h-8 fill-[#221b00]" />
                                    )}

                                    {status === "unresolved" && (
                                      <AlertTriangle className="w-7 h-7 fill-yellow-200" />
                                    )}

                                    {status === "not_attempted" && (
                                      <Lock className="w-7 h-7" />
                                    )}
                              </div>

                              {/* Card */}
                              <div className="bg-white p-4 rounded-[20px] border-[3px] border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720] w-full text-center">

                                <span
                                  className={`inline-block border-[2px] border-[#1F2720] text-[9px] uppercase px-2 py-1 rounded-md font-black tracking-wider mb-2 ${badge.bg}`}
                                >
                                  {badge.text}
                                </span>

                                <h4 className="text-sm font-black text-[#1F2720] leading-tight mb-2">
                                  {node.node_label}
                                </h4>

                                <p className="text-[10px] text-slate-500 font-bold mb-4 uppercase bg-slate-100 px-2 py-1 rounded-md inline-block">
                                  Grade {node.grade}
                                </p>

                                {status !== "mastered" && (
                                  <button
                                    onClick={() =>
                                      handleStudyNode(
                                        node.node_id
                                      )
                                    }
                                    disabled={
                                      launchingNodeId !==
                                      null
                                    }
                                    className="w-full justify-center bg-[#fdd400] hover:bg-[#ffe170] text-[#1F2720] border-[2.5px] border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720] px-3 py-2 text-[11px] font-black uppercase rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
                                  >
                                    {isNodeLoading ? (
                                      <Loader2
                                        size={14}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <BookOpen
                                        size={14}
                                        className="stroke-[3px]"
                                      />
                                    )}

                                    Embark
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-white rounded-[24px] border-[4px] border-dashed border-[#1F2720]/30 shadow-inner mt-6">
                      <p className="text-xs font-black text-slate-400">
                        Prerequisite chain mapping unavailable.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MainPage>
  );
}