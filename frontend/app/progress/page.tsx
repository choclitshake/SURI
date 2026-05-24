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
  skipDiagnostic 
} from "../../lib/api";
import { 
  BookOpen, 
  CheckCircle2, 
  Loader2, 
  Trophy, 
  TrendingUp, 
  Compass, 
  ArrowRight,
  ChevronRight
} from "lucide-react";

// Standard Friendly Algebra Lookups
const NODE_LABELS: Record<string, string> = {
  QE: "Quadratic Equations",
  FP: "Factoring Polynomials",
  SP: "Special Products & Polynomial Multiplication",
  LE: "Laws of Exponents",
  OI: "Operations on Integers",
  FD: "Fractions & Decimals",
  SLE: "Systems of Linear Equations",
  L2V: "Linear Equations in 2 Variables",
  L1V: "Linear Equations in 1 Variable",
  AE: "Algebraic Expressions & Evaluation",
  RPP: "Ratio, Proportion, Percent",
  RER: "Rational Exponents & Radicals",
  PE: "Polynomial Equations",
  PD: "Polynomial Division",
  PO: "Polynomial Operations"
};

interface ChainNode {
  node_id: string;
  node_label: string;
  grade: number;
}

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
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, "mastered" | "in_progress" | "unresolved" | "not_attempted">>({});
  const [topicChains, setTopicChains] = useState<Record<string, ChainNode[]>>({});
  const [launchingNodeId, setLaunchingNodeId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [me, topicsData] = await Promise.all([getMe(), getTopics()]);
        const progress = await getStudentProgress(me.student_id);
        setActiveSessions(progress.active_sessions || []);

        // 1. Compile universal single ground-truth node statuses across all sessions
        const statuses: Record<string, "mastered" | "in_progress" | "unresolved" | "not_attempted"> = {};
        
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
            if (statuses[n.node_id] !== "mastered" && statuses[n.node_id] !== "in_progress") {
              statuses[n.node_id] = "unresolved";
            }
          });
        };

        progress.active_sessions?.forEach(scanSession);
        progress.completed_sessions?.forEach(scanSession);

        setNodeStatuses(statuses);
        setTopics(topicsData);

        // 2. Concurrently load prerequisite chains for all topic entries [1]
        const chainsMap: Record<string, ChainNode[]> = {};
        await Promise.all(
          topicsData.map(async (topic) => {
            try {
              const chainData = await getGraphChain(topic.node_id);
              chainsMap[topic.node_id] = chainData.chain || [];
            } catch (err) {
              console.error(`Failed to load chain for ${topic.node_id}`, err);
              chainsMap[topic.node_id] = [];
            }
          })
        );
        setTopicChains(chainsMap);

      } catch (err: any) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load progress metrics.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Compute overall curriculum metrics
  const uniqueNodeIds = new Set<string>();
  Object.values(topicChains).forEach((chain) => {
    chain.forEach((node) => uniqueNodeIds.add(node.node_id));
  });

  const totalCurriculumNodes = uniqueNodeIds.size;
  const masteredNodesCount = Array.from(uniqueNodeIds).filter(
    (nodeId) => nodeStatuses[nodeId] === "mastered"
  ).length;

  const overallCurriculumMastery = totalCurriculumNodes > 0
    ? Math.round((masteredNodesCount / totalCurriculumNodes) * 100)
    : 0;

  const handleStudyNode = async (nodeId: string) => {
    setLaunchingNodeId(nodeId);
    setErrorMsg(null);
    try {
      // 1. Check if there's already an active session in progress for this prerequisite
      const existingSession = activeSessions.find(
        (s) => s.topic_entry_node === nodeId
      );

      if (existingSession) {
        router.push(`/session/${existingSession.id}/lesson`);
        return;
      }

      // 2. Otherwise create a new session and immediately skip diagnostic to go straight to the lesson
      const newSession = await createSession({ topic_entry_node: nodeId });
      await skipDiagnostic(newSession.id);
      router.push(`/session/${newSession.id}/lesson`);
    } catch {
      setErrorMsg("Failed to launch lesson path. Please try again.");
    } finally {
      setLaunchingNodeId(null);
    }
  };

  const getStatusBadge = (status: "mastered" | "in_progress" | "unresolved" | "not_attempted" | undefined) => {
    switch (status) {
      case "mastered":
        return { text: "Mastered", bg: "bg-green-50 text-green-700 border-green-200" };
      case "unresolved":
        return { text: "Needs Work", bg: "bg-red-50 text-red-700 border-red-200" };
      case "in_progress":
        return { text: "In Progress", bg: "bg-yellow-50 text-yellow-700 border-yellow-200" };
      default:
        return { text: "Not Attempted", bg: "bg-slate-100 text-slate-400 border-slate-200" };
    }
  };

  return (
    <MainPage>
      <div className="bg-slate-50 min-h-screen text-slate-800 py-4 px-4 md:px-8 space-y-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Premium Compact Bento Header */}
          <header className="bg-[#001a54] rounded-2xl p-6 md:p-8 border border-white/10 shadow-[0_0_30px_rgba(0,26,84,0.4)] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
            {/* Ambient gold and navy glows */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#fdd400]/10 rounded-full blur-[50px] pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#fdd400]/5 rounded-full blur-[50px] pointer-events-none" />
            
            <div className="flex items-center justify-between mb-4 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400]" />
                <span className="font-mono text-xs text-slate-300 font-bold tracking-[0.2em] uppercase">CURRICULUM FLOW</span>
              </div>
              <span className="font-mono text-[10px] text-slate-400 bg-black/30 px-3 py-1.5 rounded-xl border border-white/5 uppercase">MAP_ACTIVE</span>
            </div>

            <div className="z-10">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white font-['Hanken_Grotesk',_sans-serif]">
                Curriculum <span className="text-[#fdd400]">Progress Map</span>
              </h1>
              <p className="font-mono text-[10px] text-slate-300 mt-2 tracking-wide uppercase">
                Diagnostic prerequisite tracking and mastery index of algebra nodes [1].
              </p>
            </div>
          </header>

          {/* System Error Notification Banner */}
          {errorMsg && (
            <div className="bg-red-50/50 border border-red-200 rounded-2xl p-5 shadow-[0_10px_20px_rgba(239,68,68,0.03)] flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-red-600 mt-1.5 shrink-0" />
              <div>
                <span className="font-mono text-xs text-red-700 font-bold uppercase tracking-widest block mb-1">[CURRICULUM EXCEPTION]</span>
                <p className="font-mono text-sm text-red-800">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Topics & Prerequisite timelines map */}
          <div className="space-y-6">
            {topics.map((topic) => {
              const chain = topicChains[topic.node_id] || [];
              
              // Calculate topic-specific track mastery percentage [1]
              const trackTotal = chain.length;
              const trackMastered = chain.filter((n) => nodeStatuses[n.node_id] === "mastered").length;
              const trackPct = trackTotal > 0 ? Math.round((trackMastered / trackTotal) * 100) : 0;

              return (
                <div 
                  key={topic.node_id} 
                  className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_4px_12px_rgba(0,26,84,0.02)] space-y-6"
                >
                  {/* Track Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-[#001a54] font-extrabold bg-[#fdd400]/20 border border-[#fdd400]/40 px-2 py-0.5 rounded uppercase">
                        GRADE {topic.grade} • ID: {topic.node_id} [1]
                      </span>
                      <h3 className="font-['Hanken_Grotesk',_sans-serif] text-lg md:text-xl font-extrabold text-[#001a54] leading-snug">
                        {topic.label}
                      </h3>
                    </div>

                    {/* Progress tracking indicator */}
                    <div className="w-full md:w-64 space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                        <span>Track Mastery</span>
                        <span className="text-[#001a54]">{trackPct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#fdd400] rounded-full transition-all duration-300"
                          style={{ width: `${trackPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Prerequisite Node Timeline Map [1] */}
                  {chain.length > 0 ? (
                    <div className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      <div className="space-y-4">
                        {chain.map((node) => {
                          const status = nodeStatuses[node.node_id];
                          const badge = getStatusBadge(status);
                          const isNodeLoading = launchingNodeId === node.node_id;

                          return (
                            <div 
                              key={node.node_id} 
                              className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all group"
                            >
                              {/* Glowing timeline dot indicator */}
                              <div className={`absolute -left-[22px] top-5 md:top-1/2 md:-translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-slate-300 bg-white group-hover:border-[#001a54] transition-colors duration-200 ${
                                status === "mastered" ? "border-green-500 bg-green-500" : status === "in_progress" ? "border-[#fdd400] bg-[#fdd400]" : ""
                              }`} />

                              <div className="flex items-start gap-3">
                                <div>
                                  <h4 className="text-sm font-bold font-['Hanken_Grotesk',_sans-serif] text-[#001a54]">
                                    {node.node_label}
                                  </h4>
                                  <p className="font-mono text-[9px] text-slate-400 mt-0.5">
                                    Grade {node.grade} • NODE ID: {node.node_id}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 self-start md:self-auto">
                                <span className={`inline-block border font-mono text-[9px] uppercase px-2 py-0.5 rounded font-bold tracking-wider ${badge.bg}`}>
                                  {badge.text}
                                </span>

                                {/* Launch button to directly study this prerequisite */}
                                {status !== "mastered" && (
                                  <button
                                    onClick={() => handleStudyNode(node.node_id)}
                                    disabled={launchingNodeId !== null}
                                    className="bg-white hover:bg-slate-50 text-[#001a54] border border-slate-200 hover:border-[#001a54]/40 p-2 text-[9px] font-mono font-bold uppercase rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                  >
                                    {isNodeLoading ? (
                                      <Loader2 size={10} className="animate-spin" />
                                    ) : (
                                      <BookOpen size={10} />
                                    )}
                                    Study Node [1]
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <p className="font-mono text-xs text-slate-400">Prerequisite chain configuration mapping unavailable [1].</p>
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