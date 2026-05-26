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
  Trophy,
  TrendingUp,
  Compass,
  ArrowRight,
  ChevronRight,
  Lock,
  Flame,
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

      const newSession = await createSession({ topic_entry_node: nodeId });
      await skipDiagnostic(newSession.id);

      router.push(`/session/${newSession.id}/lesson`);
    } catch (err: any) {
      if (err.status === 409 && err?.detail?.session_id) {
        router.push(`/session/${err.detail.session_id}/lesson`);
      } else {
        setErrorMsg("Failed to launch lesson path. Please try again.");
      }
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
              const chain = topicChains[topic.node_id] || [];
              const orderedChain = [...chain].reverse();
              
              // Calculate topic-specific track mastery percentage [1]
              const trackTotal = orderedChain.length;
              const trackMastered = orderedChain.filter((n) => nodeStatuses[n.node_id] === "mastered").length;
              const trackPct = trackTotal > 0 ? Math.round((trackMastered / trackTotal) * 100) : 0;

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

                  {/* Prerequisite Node Timeline Map [1] */}
                  {orderedChain.length > 0 ? (
                    <div className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      <div className="space-y-4">
                        {orderedChain.map((node, index) => {
                          const status = nodeStatuses[node.node_id];
                          const badge = getStatusBadge(status);
                          const isNodeLoading = launchingNodeId === node.node_id;
                          
                          const isAccessible = index === 0 || orderedChain.slice(0, index).every(n => nodeStatuses[n.node_id] === "mastered");
                          const isTarget = index === orderedChain.length - 1;

                          return (
                            <div 
                              key={node.node_id} 
                              className={`relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border transition-all group ${
                                isTarget 
                                  ? "bg-gradient-to-r from-amber-50 to-yellow-50/50 border-[#fdd400]/50 shadow-[0_0_15px_rgba(253,212,0,0.15)]" 
                                  : "bg-slate-50/50 border-slate-100 hover:bg-white hover:border-slate-300"
                              } ${!isAccessible ? "opacity-60 bg-slate-100/50" : ""}`}
                            >
                              {/* Glowing timeline dot indicator */}
                              <div className={`absolute -left-[22px] top-5 md:top-1/2 md:-translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-slate-300 bg-white group-hover:border-[#001a54] transition-colors duration-200 ${
                                status === "mastered" ? "border-green-500 bg-green-500" : status === "in_progress" ? "border-[#fdd400] bg-[#fdd400]" : ""
                              } ${isTarget ? "ring-4 ring-[#fdd400]/20" : ""}`} />

                              <div className="flex items-start gap-3">
                                <div>
                                  <h4 className={`text-sm font-bold font-['Hanken_Grotesk',_sans-serif] ${isTarget ? 'text-[#001a54] text-base' : 'text-[#001a54]'}`}>
                                    {isTarget && <Trophy size={14} className="inline-block mr-2 text-[#fdd400] mb-0.5" />}
                                    {node.node_label}
                                  </h4>
                                  <p className="font-mono text-[9px] text-slate-400 mt-0.5">
                                    Grade {node.grade} • NODE ID: {node.node_id}
                                    {isTarget && " • TARGET TOPIC"}
                                  </p>
                                </div>
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
                                    onClick={() => isAccessible && handleStudyNode(node.node_id)}
                                    disabled={!isAccessible || launchingNodeId !== null}
                                    className={`p-2 text-[9px] font-mono font-bold uppercase rounded-lg transition-all flex items-center gap-1 ${
                                      !isAccessible 
                                        ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed" 
                                        : "bg-white hover:bg-slate-50 text-[#001a54] border border-slate-200 hover:border-[#001a54]/40 cursor-pointer"
                                    }`}
                                  >
                                    {isNodeLoading ? (
                                      <Loader2 size={10} className="animate-spin" />
                                    ) : !isAccessible ? (
                                      <Lock size={10} />
                                    ) : (
                                      <BookOpen
                                        size={14}
                                        className="stroke-[3px]"
                                      />
                                    )}
                                    {isAccessible ? "Study Node [1]" : "Locked"}
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