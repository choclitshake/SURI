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
  Leaf,
  Trophy,
  Compass,
  ShieldAlert,
  Sun,
  Sprout,
  Activity,
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
    <div className="grid grid-cols-12 gap-6 animate-pulse items-stretch">
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
        <div className="w-full aspect-[2/1] rounded-[24px] bg-[#e6e8ea]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
          <div className="bg-[#e6e8ea] rounded-[24px]" />
          <div className="bg-[#e6e8ea] rounded-[24px]" />
        </div>
      </div>
      <div className="col-span-12 lg:col-span-4">
        <div className="bg-[#e6e8ea] rounded-[32px] h-full" />
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
  // Active achievement card overlay description state
  const [selectedBadge, setSelectedBadge] = useState<{title: string, desc: string} | null>(null);
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
  const coursePct = activeSessions.length > 0
    ? Math.round(activeSessions.reduce((sum, s) => sum + (parseFloat(String(s.completion_percentage)) || 0), 0) / activeSessions.length)
    : 0;
  // --- Dynamic Gamification Stats ---
  const completedSessionsBonus = completedSessions.length * 50;
  const dewdrops = totalMastered * 10 + completedSessionsBonus; // points count
  // Ranks & Levels
  let level = 1;
  let rankTitle = "Sprout Explorer";
  let minPoints = 0;
  let maxPoints = 100;
  let levelEmoji = "🌱";
  let rankColor = "text-emerald-700 bg-emerald-100 border-emerald-300";
  if (dewdrops >= 1000) {
    level = 5;
    rankTitle = "Elder Canopy Sage";
    minPoints = 1000;
    maxPoints = 1000;
    levelEmoji = "🦉";
    rankColor = "text-[#705d00] bg-[#fdd400]/20 border-[#fdd400]/40";
  } else if (dewdrops >= 600) {
    level = 4;
    rankTitle = "Wildwood Ranger";
    minPoints = 600;
    maxPoints = 1000;
    levelEmoji = "🌲";
    rankColor = "text-[#005b21] bg-green-100 border-green-300";
  } else if (dewdrops >= 300) {
    level = 3;
    rankTitle = "Dewdrop Pathfinder";
    minPoints = 300;
    maxPoints = 600;
    levelEmoji = "🌿";
    rankColor = "text-yellow-800 bg-[#ffe170]/40 border-yellow-400";
  } else if (dewdrops >= 100) {
    level = 2;
    rankTitle = "Fern Scout";
    minPoints = 100;
    maxPoints = 300;
    levelEmoji = "💧";
    rankColor = "text-teal-800 bg-teal-100 border-teal-300";
  }
  const levelPct = maxPoints === minPoints ? 100 : ((dewdrops - minPoints) / (maxPoints - minPoints)) * 100;
  const pointsNeeded = maxPoints === minPoints ? 0 : maxPoints - dewdrops;
  // Collectible Backpack Achievements
  const achievements = [
    {
      id: "green_thumb",
      title: "Green Thumb",
      desc: "Planted your seeds by embarking on your first learning quest.",
      unlocked: activeSessions.length > 0 || completedSessions.length > 0,
      badge: "🌱",
      color: "from-emerald-400 to-green-600 text-white shadow-emerald-200"
    },
    {
      id: "bramble_pruner",
      title: "Thorn Tamer",
      desc: "Confronted mistakes by logging and inspecting misconceptions in the brambles.",
      unlocked: misconceptions.length > 0,
      badge: "✂️",
      color: "from-amber-400 to-orange-500 text-white shadow-orange-200"
    },
    {
      id: "dewdrop_master",
      title: "Essence Hoarder",
      desc: "Harnessed 150+ Forest Dewdrops from your mathematical exploits.",
      unlocked: dewdrops >= 150,
      badge: "✨",
      color: "from-[#fdd400] to-yellow-600 text-[#221b00] shadow-yellow-300"
    },
    {
      id: "canopy_conqueror",
      title: "Verdant Conqueror",
      desc: "Paved a path to completion and fully conquered at least one topic chain.",
      unlocked: completedSessions.length > 0,
      badge: "🏆",
      color: "from-blue-400 to-violet-600 text-white shadow-violet-200"
    }
  ];
  if (loading) {
    return <DashboardSkeleton />;
  }
  return (
    <>
      {/* Inline styles for custom gamification animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatFirefly {
          0% { transform: translateY(110%) translateX(0); opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-20px) translateX(30px); opacity: 0; }
        }
        @keyframes glowingTrail {
          to { stroke-dashoffset: -40; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(253, 212, 0, 0.4), inset 0 0 5px rgba(253, 212, 0, 0.2); }
          50% { box-shadow: 0 0 25px rgba(253, 212, 0, 0.8), inset 0 0 10px rgba(253, 212, 0, 0.4); }
        }
        @keyframes leafSway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(5deg); }
        }
        .firefly {
          position: absolute;
          background: #fdd400;
          border-radius: 50%;
          filter: drop-shadow(0 0 4px #ffe170);
          pointer-events: none;
        }
        .bramble-item:hover .bramble-leaf {
          animation: leafSway 0.5s ease-in-out infinite;
        }
      ` }} />
      {showSaved && (
        <div className="mb-6 border border-green-600 bg-green-50 text-green-800 p-4 text-center text-sm font-semibold rounded-[24px] shadow-sm animate-bounce">
          🌿 Progress successfully cataloged in the Forest Archives!
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 border border-red-300 bg-red-50 p-4 text-sm text-red-700 rounded-[24px] flex items-center gap-2 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      <div className="grid grid-cols-12 gap-6 items-stretch">
        {/* Left Content Area */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          {/* Gamified Adventure Map */}
          <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-b from-[#141b15] to-[#253224] p-6 shadow-xl border-4 border-[#2e3b2e] group">
            {/* Background Forest Silhouette */}
            <div className="absolute inset-0 opacity-15 bg-cover bg-bottom mix-blend-overlay pointer-events-none" 
                 style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAEXma6INVd0pxsf2NimA83gxdCqv-1PqJrcWOioIbkPEtj3Z7oIxOvuUvLYNc4Dp9x3Y1BdR1CuvLCFJx5RSzJA9_Kk02IsPNQSy0DeGhX33fZvqV6ZTAci5gEWEnXt3d5H0IqVOBVrHAtZ0wRSpSPEhIZkwT8lWCqZo0inU40TzVsVWo-vjMqvT5w8nLCUkx-agKpKsnu_I62S8u6WesHawWnmWYTE_400YVkv8YcJ_L_q-lbQ4H0O-Ey3ld_l4PtBxxi-Kv7vQ8')" }} />
            {/* Glowing Forest Gradients */}
            <div className="absolute top-0 right-1/4 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-4 left-1/3 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            {/* Floating CSS Fireflies */}
            <div className="firefly w-1.5 h-1.5" style={{ left: "12%", bottom: "10%", animation: "floatFirefly 7s ease-in-out infinite" }} />
            <div className="firefly w-2 h-2" style={{ left: "28%", bottom: "5%", animation: "floatFirefly 10s ease-in-out infinite 2s" }} />
            <div className="firefly w-1 h-1" style={{ left: "45%", bottom: "8%", animation: "floatFirefly 6s ease-in-out infinite 1s" }} />
            <div className="firefly w-2 h-2" style={{ left: "62%", bottom: "12%", animation: "floatFirefly 9s ease-in-out infinite 3s" }} />
            <div className="firefly w-1.5 h-1.5" style={{ left: "80%", bottom: "6%", animation: "floatFirefly 8s ease-in-out infinite 4s" }} />
            {/* Map Header Overlay */}
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-2 border-b border-white/10">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-widest text-[#fdd400] bg-[#fdd400]/10 uppercase border border-[#fdd400]/20">
                  <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "12s" }} /> Active Expedition Trail
                </span>
                <h2 className="font-['Hanken_Grotesk'] text-2xl text-white font-black tracking-tight mt-1">
                  Welcome Back, {name}!
                </h2>
              </div>
              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5 self-start md:self-auto">
                <span className="text-[12px] font-extrabold text-white/80 font-['Manrope']">Quest Focus:</span>
                <span className="text-sm font-black text-[#fdd400]">
                  {activeSessions.length > 0 ? activeSessions[0].topic_label : "Ready for a new Quest!"}
                </span>
              </div>
            </div>
            {/* Path Winding Map Area */}
            <div className="relative w-full aspect-[21/10] md:aspect-[2/1] rounded-[24px] bg-[#1a231b]/80 border border-white/5 flex items-center justify-center">
              
              {/* SVG Winding Path Trail */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Thick Earthy Trail base */}
                <path
                  d="M 10 50 Q 25 15, 38 68 T 63 32 T 90 55"
                  fill="none"
                  stroke="#382e14"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Glowing Dotted Magic Trail */}
                <path
                  d="M 10 50 Q 25 15, 38 68 T 63 32 T 90 55"
                  fill="none"
                  stroke="#ffe170"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeDasharray="2.5 2.5"
                  style={{
                    animation: "glowingTrail 8s linear infinite",
                  }}
                />
              </svg>
              {/* NODE 1: COMPLETED BASECAMP */}
              <div 
                className="absolute left-[10%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center island-node group cursor-pointer z-10"
                onClick={() => {
                  if (completedSessions.length > 0) {
                    handleReviewAgain(completedSessions[0].topic_entry_node);
                  }
                }}
              >
                {/* Tooltip Card */}
                <div className="absolute bottom-16 bg-[#1a231b]/95 border border-[#2e3b2e] shadow-2xl p-3.5 rounded-2xl w-48 text-center text-xs opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-50 text-white font-['Manrope']">
                  <div className="font-extrabold text-[#79ff8f] mb-1 flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Stage Complete!
                  </div>
                  <div className="font-semibold text-white/95 truncate">
                    {completedSessions.length > 0 ? completedSessions[0].topic_label : "Green Meadow Basecamp"}
                  </div>
                  <div className="text-[10px] text-white/60 mt-1.5 border-t border-white/5 pt-1.5">
                    Click to review this completed milestone!
                  </div>
                </div>
                <div className="w-13 h-13 rounded-full bg-[#1b4320] border-4 border-[#79ff8f] flex items-center justify-center text-[#79ff8f] shadow-lg group-hover:scale-110 transition-transform relative">
                  <Check className="w-6 h-6 stroke-[3px]" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#79ff8f] text-[8px] font-bold text-[#1b4320] border border-white">✓</span>
                </div>
                <span className="mt-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black tracking-wider uppercase text-white/90 border border-white/5">
                  {completedSessions.length > 0 ? completedSessions[0].topic_label.slice(0, 10) + "..." : "Basecamp"}
                </span>
              </div>
              {/* NODE 2: THE ACTIVE CAMPFIRE */}
              <div 
                className="absolute left-[38%] top-[68%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center island-node group cursor-pointer z-20 scale-110"
                onClick={() => {
                  if (activeSessions.length > 0) {
                    handleResume(activeSessions[0].id);
                  } else {
                    router.push("/topics");
                  }
                }}
              >
                {/* Glowing Aura Ring */}
                <div className="absolute w-20 h-20 rounded-full pointer-events-none z-0" 
                     style={{ animation: "pulseGlow 2.5s infinite" }} />
                {/* Tooltip Card */}
                <div className="absolute bottom-20 bg-[#2b240b]/95 border border-[#ffe170]/30 shadow-2xl p-4 rounded-2xl w-56 text-center text-xs opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-50 text-white font-['Manrope']">
                  <div className="font-black text-[#fdd400] mb-1 flex items-center justify-center gap-1.5 animate-pulse">
                    <Flame className="w-4 h-4 text-[#fdd400] fill-[#fdd400]" /> ACTIVE QUEST
                  </div>
                  <div className="font-extrabold text-white text-sm truncate">
                    {activeSessions.length > 0 ? activeSessions[0].topic_label : "No Active Topic"}
                  </div>
                  <div className="text-[10px] text-white/70 mt-1 flex justify-between">
                    <span>Task Mastery:</span>
                    <span className="text-[#ffe170] font-black">{activeSessions.length > 0 ? `${activeSessions[0].mastered_count}/${activeSessions[0].total_in_chain}` : "0/0"}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-yellow-400 to-[#fdd400]" style={{ width: `${coursePct}%` }}></div>
                  </div>
                  <div className="text-[10px] text-[#ffe170] font-bold mt-2 pt-2 border-t border-white/5 animate-bounce">
                    Click to resume exploration!
                  </div>
                </div>
                <div className="w-16 h-16 rounded-full bg-[#fdd400] border-4 border-white flex items-center justify-center text-[#221b00] shadow-2xl relative z-10 hover:rotate-6 transition-transform">
                  <Flame className="w-8 h-8 fill-[#221b00] text-[#221b00] animate-bounce" />
                </div>
                <span className="mt-2.5 bg-[#fdd400] text-[#221b00] px-4.5 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase shadow-md border border-white/20">
                  {activeSessions.length > 0 ? activeSessions[0].topic_label.slice(0, 12) + "..." : "Begin Expedition"}
                </span>
              </div>
              {/* NODE 3: LOCKED CANOPY */}
              <div className="absolute left-[63%] top-[32%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center island-node group opacity-55 z-10">
                {/* Tooltip Card */}
                <div className="absolute bottom-16 bg-[#1a231b]/95 border border-[#2e3b2e] shadow-xl p-3 rounded-2xl w-48 text-center text-xs opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-50 text-white font-['Manrope']">
                  <div className="font-extrabold text-white/50 mb-1 flex items-center justify-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Locked Canopy
                  </div>
                  <div className="text-[10px] text-white/60">
                    Conquer your active mathematics quest to prune roots and unlock this region!
                  </div>
                </div>
                <div className="w-13 h-13 rounded-full bg-[#303831] border-4 border-[#525f54] flex items-center justify-center text-[#525f54] shadow-lg">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="mt-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-bold uppercase text-white/60 border border-white/5">
                  Quadratics
                </span>
              </div>
              {/* NODE 4: ANCIENT PEAK */}
              <div className="absolute left-[90%] top-[55%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center island-node group opacity-55 z-10">
                {/* Tooltip Card */}
                <div className="absolute bottom-16 bg-[#1a231b]/95 border border-[#2e3b2e] shadow-xl p-3 rounded-2xl w-48 text-center text-xs opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-50 text-white font-['Manrope']">
                  <div className="font-extrabold text-white/50 mb-1 flex items-center justify-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Ancient Peaks
                  </div>
                  <div className="text-[10px] text-white/60">
                    The ultimate trial of SURI. Locked until master status is attained.
                  </div>
                </div>
                <div className="w-13 h-13 rounded-full bg-[#303831] border-4 border-[#525f54] flex items-center justify-center text-[#525f54] shadow-lg">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="mt-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-bold uppercase text-white/60 border border-white/5">
                  Exponents
                </span>
              </div>
            </div>
          </section>
          {/* Active Lessons + Tangled Brambles - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            
            {/* Guild Quests (Active Lessons) */}
            <section className="bg-white rounded-[32px] p-6 shadow-md border border-[#c3c5d9]/20 flex flex-col hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-5 border-b border-[#e6e8ea] pb-3">
                <h3 className="flex items-center gap-2.5 font-['Hanken_Grotesk'] text-xl text-[#1F2720] font-black">
                  <Compass className="w-6 h-6 text-[#1F2720]" />
                  Active Expeditions
                </h3>
                <button
                  type="button"
                  onClick={() => router.push("/topics")}
                  className="font-['Manrope'] text-[11px] font-black text-[#705d00] hover:text-[#fdd400] inline-flex items-center gap-1 bg-[#fdd400]/10 hover:bg-[#221b00] px-3 py-1.5 rounded-full transition-colors cursor-pointer shrink-0"
                >
                  View All Paths
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {activeSessions.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center flex-1 bg-[#DBD4C7]/10 rounded-2xl border border-dashed border-[#1F2720]/20">
                  <Sprout className="w-10 h-10 text-[#1F2720]/40 mb-3 animate-pulse" />
                  <p className="text-[#434656] text-sm font-semibold mb-4">Your log of active expeditions is empty.</p>
                  <button
                    type="button"
                    onClick={() => router.push("/topics")}
                    className="bg-[#fdd400] text-[#221b00] hover:bg-[#221b00] hover:text-white px-6 py-3 rounded-full font-['Manrope'] text-[12px] font-black shadow-md cursor-pointer transition-colors border border-[#fdd400]/30"
                  >
                    Embark on a Quest
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4 flex-1 max-h-[300px] overflow-y-auto pr-1">
                  {activeSessions.slice(0, 5).map((s) => {
                    const pct = parseFloat(String(s.completion_percentage)) || 0;
                    return (
                      <div 
                        key={s.id} 
                        className="flex items-center gap-3.5 w-full bg-[#DBD4C7]/15 hover:bg-[#DBD4C7]/30 p-3.5 rounded-2xl transition-all border border-[#1F2720]/5 hover:border-l-4 hover:border-l-[#fdd400] group"
                      >
                        <span className="w-11 h-11 rounded-xl bg-[#1F2720] text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                          <Leaf className="w-5 h-5 text-[#fdd400] fill-[#fdd400]" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-['Manrope'] text-sm font-black text-[#1F2720] truncate m-0">{s.topic_label}</h4>
                          <p className="font-['Manrope'] text-xs font-semibold text-[#434656]/90 truncate m-0 mt-0.5">{s.current_node_label}</p>
                          
                          {/* Vine Styled Progress Bar */}
                          <div className="relative mt-2.5 w-full h-2 bg-[#e6e8ea] rounded-full overflow-visible">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-800 to-green-500 rounded-full transition-all relative"
                              style={{ width: `${pct}%` }}
                            >
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#fdd400] shadow-[0_0_6px_#fdd400]" />
                            </div>
                            {/* Gold blossom marker points */}
                            <div className="absolute left-[33%] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/80 border border-[#1f2720]/20" />
                            <div className="absolute left-[66%] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/80 border border-[#1f2720]/20" />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                          <span className="font-['Manrope'] text-[9px] font-black px-2 py-1 rounded-md bg-[#1F2720]/10 text-[#1F2720] border border-[#1F2720]/10 uppercase whitespace-nowrap">
                            {s.mastered_count}/{s.total_in_chain} Mastered
                          </span>
                          <button
                            type="button"
                            onClick={() => handleResume(s.id)}
                            className="p-1.5 rounded-xl bg-white hover:bg-[#fdd400] text-[#1F2720] border border-[#e6e8ea] hover:border-[#fdd400] shadow-sm transition-all cursor-pointer"
                            title="Resume Lesson"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            {/* Tangled Brambles (Error History / Remediations) */}
            <section className="bg-white rounded-[32px] p-6 shadow-md border border-[#c3c5d9]/20 flex flex-col hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-5 border-b border-[#e6e8ea] pb-3">
                <h3 className="flex items-center gap-2.5 font-['Hanken_Grotesk'] text-xl text-[#1F2720] font-black">
                  <ShieldAlert className="w-6 h-6 text-[#ba1a1a]" />
                  Tangled Brambles
                </h3>
                <button
                  type="button"
                  onClick={() => setShowErrors((v) => !v)}
                  className={`font-['Manrope'] text-[11px] font-black px-4.5 py-1.5 rounded-full transition-all cursor-pointer border shrink-0 ${
                    showErrors 
                      ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" 
                      : "bg-[#f2f4f6] text-[#434656] border-[#c3c5d9]/30 hover:bg-[#e6e8ea]"
                  }`}
                >
                  {showErrors ? "Collapse Roots" : `Prune Roots (${misconceptions.length})`}
                </button>
              </div>
              <div className="flex-1 flex flex-col justify-between">
                {!showErrors ? (
                  <div className="text-center py-6 flex flex-col items-center justify-center flex-1 bg-[#ba1a1a]/5 rounded-2xl border border-dashed border-[#ba1a1a]/15">
                    <Activity className="w-10 h-10 text-red-700/30 mb-2 animate-pulse" />
                    <p className="text-sm font-semibold text-[#1F2720] mt-1">
                      {misconceptions.length} overgrown bramble{misconceptions.length !== 1 ? "s" : ""} detected.
                    </p>
                    <p className="text-[11px] text-[#434656] max-w-[220px] mt-1">
                      Clear overgrown misconceptions to restore path safety and earn <strong className="text-[#705d00]">+50 Dewdrops</strong>!
                    </p>
                  </div>
                ) : misconceptions.length === 0 ? (
                  <div className="text-center py-8 flex flex-col items-center justify-center flex-1 bg-green-50 rounded-2xl border border-dashed border-green-200">
                    <Sun className="w-10 h-10 text-green-600/40 mb-2 animate-spin" style={{ animationDuration: "16s" }} />
                    <p className="text-sm font-bold text-green-800">Clear Canopy!</p>
                    <p className="text-[11px] text-green-700 max-w-[220px] mt-1">The path is safe and glowing with mathematical truth. No brambles found!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#c3c5d9]/30 max-h-[220px] overflow-y-auto pr-1">
                    {misconceptions.slice(0, 5).map((item, idx) => (
                      <div
                        key={`${item.node_id}-${item.logged_at}-${idx}`}
                        className="py-3.5 flex justify-between items-start gap-3 w-full bramble-item"
                      >
                        <span className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100 group mt-0.5">
                          <Leaf className="w-4 h-4 fill-red-600 bramble-leaf" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-['Manrope'] text-xs font-black text-[#1F2720] m-0">{item.node_label}</p>
                          <p className="font-['Manrope'] text-[11px] font-semibold text-[#434656] mt-1 m-0 line-clamp-2 leading-relaxed bg-[#ba1a1a]/5 p-2 rounded-xl border border-red-100/30">
                            {item.step_description}
                          </p>
                          <p className="text-[9px] text-[#737688] font-bold mt-1.5">
                            Overgrown: {formatDate(item.logged_at)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReviewAgain(item.node_id)}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white hover:from-amber-500 hover:to-yellow-500 text-[10px] font-black tracking-wider uppercase border border-red-700/10 hover:border-yellow-400 shadow-sm shrink-0 transition-all cursor-pointer"
                        >
                          Prune
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
        {/* Right Sidebar Area */}
        <aside className="col-span-12 lg:col-span-4">
          <section className="bg-white p-6 md:p-8 rounded-[32px] shadow-md border border-[#c3c5d9]/20 h-full flex flex-col hover:shadow-lg transition-shadow">
            
            {/* Header / Ranger License */}
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-[#e6e8ea]">
              <h2 className="font-['Hanken_Grotesk'] text-xl text-[#1F2720] font-black">Explorer Profile</h2>
              <span className="text-[10px] font-black uppercase text-[#737688] bg-[#f2f4f6] px-2.5 py-1 rounded-md border border-[#c3c5d9]/30">Lv. {level}</span>
            </div>
            {/* Profile Avatar & Level Meter */}
            <div className="flex flex-col items-center mb-6 bg-[#DBD4C7]/15 p-5 rounded-[24px] border border-[#1F2720]/5 relative overflow-hidden">
              
              {/* Circular Leaf Wreath / Progress Gauge */}
              <div className="relative w-28 h-28 mb-3 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                  {/* Background Sand Wreath Circle */}
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    className="stroke-[#e6e8ea] fill-transparent"
                    strokeWidth="7"
                  />
                  {/* Active Forest Wreath progress */}
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    className="stroke-[#1F2720] fill-transparent transition-all"
                    strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - levelPct / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                
                {/* Center Badge Avatar */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#1F2720] to-[#253224] flex items-center justify-center overflow-hidden border-2 border-white shadow-inner">
                  <span className="font-['Hanken_Grotesk'] text-3xl font-black text-[#fdd400] drop-shadow-sm select-none">
                    {name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
                  </span>
                </div>
              </div>
              <h3 className="font-['Hanken_Grotesk'] text-lg font-black text-[#1F2720] m-0">{name || "Student Explorer"}</h3>
              
              {/* Guild Title Badge */}
              <div className={`mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${rankColor}`}>
                {levelEmoji} {rankTitle}
              </div>
              {/* Dewdrop Points Accumulator */}
              <div className="mt-4 flex items-center gap-1.5 text-[#705d00] bg-[#ffe170]/40 px-5 py-2 rounded-full border border-yellow-400/40 shadow-sm relative group hover:scale-105 transition-transform cursor-default">
                <Flame className="w-5 h-5 fill-[#705d00] text-[#705d00] animate-pulse" />
                <span className="font-black text-sm tracking-tight">{dewdrops} Forest Dewdrops</span>
              </div>
            </div>
            {/* Progression & Leveling Meter */}
            <div className="mb-6 bg-[#DBD4C7]/15 p-4.5 rounded-[24px] border border-[#1F2720]/5">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-['Manrope'] text-[11px] font-black text-[#1f2720]/80">Level Progression</span>
                <span className="font-['Manrope'] text-[11px] font-black text-[#1F2720]">{Math.round(levelPct)}%</span>
              </div>
              <div className="h-3 w-full bg-[#e6e8ea] rounded-full overflow-hidden border border-[#c3c5d9]/20 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-[#fdd400] rounded-full transition-all"
                  style={{ width: `${levelPct}%` }}
                />
              </div>
              {pointsNeeded > 0 ? (
                <p className="font-['Manrope'] text-[10px] font-bold text-[#434656] mt-2 mb-0">
                  ⭐ Gather <strong>{pointsNeeded} more Dewdrops</strong> to attain the next guild tier rank!
                </p>
              ) : (
                <p className="font-['Manrope'] text-[10px] font-black text-emerald-800 mt-2 mb-0 flex items-center gap-1">
                  🦉 You have mastered the forest trails! Max Level attained.
                </p>
              )}
            </div>
            {/* Achievements Backpack */}
            <div className="mt-auto pt-4 border-t border-[#e6e8ea]">
              <div className="flex items-center gap-1.5 mb-3.5">
                <Compass className="w-4 h-4 text-[#1F2720]" />
                <h4 className="font-['Hanken_Grotesk'] text-sm font-black text-[#1F2720]">Explorer's Backpack</h4>
              </div>
              {/* Achievements Grid */}
              <div className="grid grid-cols-4 gap-3 relative">
                {achievements.map((ach) => {
                  return (
                    <div
                      key={ach.id}
                      onClick={() => {
                        setSelectedBadge({
                          title: ach.title,
                          desc: ach.unlocked ? ach.desc : `🔒 Locked Badge. ${ach.desc}`
                        });
                      }}
                      className={`relative aspect-square rounded-2xl flex items-center justify-center text-xl cursor-pointer transition-all border shadow-sm ${
                        ach.unlocked
                          ? `bg-gradient-to-br ${ach.color} border-white/20 hover:scale-110 active:scale-95 shadow-md`
                          : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"
                      }`}
                      title={`${ach.title}: ${ach.desc}`}
                    >
                      <span>{ach.badge}</span>
                      {!ach.unlocked && (
                        <div className="absolute inset-0 bg-white/20 backdrop-blur-[0.5px] rounded-2xl flex items-center justify-center">
                          <Lock className="w-3.5 h-3.5 text-gray-400/90" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Interactive Achievement Detail Box */}
              <div className="min-h-[75px] mt-4 p-3 rounded-2xl bg-[#DBD4C7]/20 border border-[#1F2720]/10 flex flex-col justify-center">
                {selectedBadge ? (
                  <>
                    <h5 className="font-['Manrope'] text-xs font-black text-[#1F2720] m-0">{selectedBadge.title}</h5>
                    <p className="font-['Manrope'] text-[10px] font-semibold text-[#434656] m-0 mt-1 leading-normal">{selectedBadge.desc}</p>
                  </>
                ) : (
                  <p className="font-['Manrope'] text-[10px] font-semibold text-[#737688]/80 text-center m-0 italic">
                    🎒 Tap badges in your Backpack to view achievement records.
                  </p>
                )}
              </div>
            </div>
            {/* Bottom Course Mastery Stats */}
            <div className="mt-5 pt-4 border-t border-[#e6e8ea]">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-['Manrope'] text-[11px] font-black text-[#191c1e]">Total Math Mastery</span>
                <span className="font-['Manrope'] text-[11px] font-black text-[#1F2720]">{coursePct}%</span>
              </div>
              <div className="h-2 w-full bg-[#e6e8ea] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1F2720] rounded-full transition-all"
                  style={{ width: `${coursePct}%` }}
                />
              </div>
              <p className="font-['Manrope'] text-[9px] text-[#434656]/90 mt-2 m-0 font-bold">
                🎯 {totalMastered} of {totalCompetencies} skills fully mapped across your learning logs.
              </p>
            </div>
          </section>
        </aside>
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

