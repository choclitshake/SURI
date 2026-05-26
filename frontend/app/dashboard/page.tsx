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
        <div className="w-full aspect-[2/1] rounded-[32px] bg-[#e6e8ea]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
          <div className="bg-[#e6e8ea] rounded-[32px]" />
          <div className="bg-[#e6e8ea] rounded-[32px]" />
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
      color: "from-emerald-400 to-green-600 text-white"
    },
    {
      id: "bramble_pruner",
      title: "Thorn Tamer",
      desc: "Confronted mistakes by logging and inspecting misconceptions in the brambles.",
      unlocked: misconceptions.length > 0,
      badge: "✂️",
      color: "from-orange-400 to-red-500 text-white"
    },
    {
      id: "dewdrop_master",
      title: "Essence Hoarder",
      desc: "Harnessed 150+ Forest Dewdrops from your mathematical exploits.",
      unlocked: dewdrops >= 150,
      badge: "✨",
      color: "from-[#fdd400] to-yellow-500 text-[#221b00]"
    },
    {
      id: "canopy_conqueror",
      title: "Verdant Conqueror",
      desc: "Paved a path to completion and fully conquered at least one topic chain.",
      unlocked: completedSessions.length > 0,
      badge: "🏆",
      color: "from-blue-400 to-violet-600 text-white"
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
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
        @keyframes leafSway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(8deg); }
        }
        @keyframes bounceJelly {
          0%, 100% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-6px) scale(0.95, 1.05); }
          50% { transform: translateY(0) scale(1.05, 0.95); }
          70% { transform: translateY(-2px) scale(0.98, 1.02); }
        }
        .firefly {
          position: absolute;
          background: #fdd400;
          border-radius: 50%;
          filter: drop-shadow(0 0 5px #ffe170);
          pointer-events: none;
        }
        .bramble-item:hover .bramble-leaf {
          animation: leafSway 0.4s ease-in-out infinite;
        }
        .animate-jelly:hover {
          animation: bounceJelly 0.8s ease-in-out infinite;
        }
        .cartoon-tooltip {
          filter: drop-shadow(4px 4px 0px #1F2720);
        }
      ` }} />

      {showSaved && (
        <div className="mb-6 border-[3px] border-[#1F2720] bg-green-200 text-green-900 p-4 text-center text-sm font-black rounded-[24px] shadow-[4px_4px_0px_0px_#1F2720] animate-bounce">
          🌿 Progress cataloged in the Forest Archives! Let the flowers bloom!
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 border-[3px] border-[#1F2720] bg-red-100 p-4 text-sm text-red-900 font-black rounded-[24px] flex items-center gap-2 shadow-[4px_4px_0px_0px_#1F2720]">
          <ShieldAlert className="w-5 h-5 text-red-700 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6 items-stretch">
        {/* Left Content Area */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">

          {/* Gamified Cartoony Adventure Map */}
          <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-b from-[#1b261c] to-[#2e3e2d] p-6 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] group">
            {/* Background Forest Silhouette */}
            <div className="absolute inset-0 opacity-20 bg-cover bg-bottom mix-blend-overlay pointer-events-none" 
                 style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAEXma6INVd0pxsf2NimA83gxdCqv-1PqJrcWOioIbkPEtj3Z7oIxOvuUvLYNc4Dp9x3Y1BdR1CuvLCFJx5RSzJA9_Kk02IsPNQSy0DeGhX33fZvqV6ZTAci5gEWEnXt3d5H0IqVOBVrHAtZ0wRSpSPEhIZkwT8lWCqZo0inU40TzVsVWo-vjMqvT5w8nLCUkx-agKpKsnu_I62S8u6WesHawWnmWYTE_400YVkv8YcJ_L_q-lbQ4H0O-Ey3ld_l4PtBxxi-Kv7vQ8')" }} />

            {/* Glowing Forest Gradients */}
            <div className="absolute top-0 right-1/4 w-44 h-44 bg-yellow-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-4 left-1/3 w-36 h-36 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />

            {/* Floating CSS Fireflies */}
            <div className="firefly w-2 h-2" style={{ left: "10%", bottom: "8%", animation: "floatFirefly 6s ease-in-out infinite" }} />
            <div className="firefly w-2.5 h-2.5" style={{ left: "25%", bottom: "5%", animation: "floatFirefly 9s ease-in-out infinite 1.5s" }} />
            <div className="firefly w-1.5 h-1.5" style={{ left: "42%", bottom: "10%", animation: "floatFirefly 5s ease-in-out infinite 0.5s" }} />
            <div className="firefly w-3 h-3" style={{ left: "60%", bottom: "12%", animation: "floatFirefly 8s ease-in-out infinite 2.5s" }} />
            <div className="firefly w-2 h-2" style={{ left: "78%", bottom: "6%", animation: "floatFirefly 7s ease-in-out infinite 3.5s" }} />

            {/* Map Header Overlay with Mascot integration */}
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-3 border-b-4 border-[#1F2720]">
              <div className="flex items-center gap-3">
                <img 
                  alt="Suri the Snake Ranger Guide" 
                  src="/suri-snake-right.png" 
                  className="h-21 w-auto object-contain select-none shrink-0" 
                  style={{ animationDuration: "3s" }}
                />
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black tracking-widest text-[#1F2720] bg-[#fdd400] uppercase border-[3px] border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">
                    <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "10s" }} /> Mascot Guide
                  </span>
                  <h2 className="font-['Hanken_Grotesk'] text-2xl text-white font-black tracking-tight mt-1.5 drop-shadow-[2px_2px_0px_#1F2720]">
                    Welcome Back, {name}!
                  </h2>
                </div>
              </div>
              
              {/* Speech Bubble */}
              <div className="relative bg-[#ffe170] text-[#1F2720] font-['Manrope'] font-black text-[11px] p-3 rounded-2xl border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] max-w-[250px] self-start md:self-auto flex items-center">
                <span>💬 "Let's explore the Mathwood! Sss-implifying algebra trails is my favorite hobby!"</span>
                {/* bubble speech triangles */}
                <div className="absolute top-1/2 -left-[10px] -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-r-[10px] border-r-[#1F2720] border-b-[8px] border-b-transparent hidden md:block" />
                <div className="absolute top-1/2 -left-[6px] -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-[#ffe170] border-b-[6px] border-b-transparent hidden md:block" />
              </div>
            </div>

            {/* Path Winding Map Area */}
<div
  className="relative w-full aspect-[21/10] md:aspect-[2/1] rounded-[28px] border-[4px] border-[#1F2720] flex items-center justify-center overflow-hidden bg-cover bg-center"
  style={{
    backgroundImage:
      "url('/bg.png')",
  }}
>              
              {/* SVG Winding Path Trail */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Thick Comic Trail base */}
                <path
                  d="M 10 50 Q 25 15, 38 68 T 63 32 T 90 55"
                  fill="none"
                  stroke="#1F2720"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                {/* Earthy middle dirt path */}
                <path
                  d="M 10 50 Q 25 15, 38 68 T 63 32 T 90 55"
                  fill="none"
                  stroke="#8f7129"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                {/* Glowing Dotted Magic Trail */}
                <path
                  d="M 10 50 Q 25 15, 38 68 T 63 32 T 90 55"
                  fill="none"
                  stroke="#ffe170"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray="2.5 2.5"
                  style={{
                    animation: "glowingTrail 6s linear infinite",
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
                {/* Cartoon Tooltip Card */}
                <div className="absolute bottom-18 bg-white border-[3.5px] border-[#1F2720] p-3.5 rounded-2xl w-48 text-center text-xs opacity-0 scale-90 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-50 text-[#1F2720] font-['Manrope'] cartoon-tooltip">
                  <div className="font-black text-green-700 mb-1 flex items-center justify-center gap-1">
                    <Check className="w-4 h-4 stroke-[3px]" /> Trail Clear!
                  </div>
                  <div className="font-extrabold text-[#1F2720] truncate">
                    {completedSessions.length > 0 ? completedSessions[0].topic_label : "Green Meadow Basecamp"}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold mt-1.5 border-t-2 border-[#1F2720]/15 pt-1.5">
                    Click to replay lesson!
                  </div>
                </div>

                <div className="w-14 h-14 rounded-full bg-[#79ff8f] border-[4px] border-[#1F2720] flex items-center justify-center text-[#1b4320] shadow-[3px_3px_0px_0px_#1F2720] group-hover:scale-110 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all relative">
                  <Check className="w-7 h-7 stroke-[4px]" />
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#fdd400] text-[9px] font-black text-[#1F2720] border-2 border-[#1F2720]">✓</span>
                </div>
                <span className="mt-2.5 bg-white text-[#1F2720] px-3 py-1 rounded-full text-[9px] font-black tracking-wider uppercase border-[3.5px] border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">
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
                <div className="absolute w-20 h-20 rounded-full pointer-events-none z-0 bg-[#fdd400]" 
                     style={{ animation: "pulseGlow 2s infinite" }} />

                {/* Cartoon Tooltip Card */}
                <div className="absolute bottom-22 bg-[#ffe170] border-[4.5px] border-[#1F2720] p-4 rounded-2xl w-56 text-center text-xs opacity-0 scale-90 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-50 text-[#1F2720] font-['Manrope'] cartoon-tooltip">
                  <div className="font-black text-[#1F2720] mb-1 flex items-center justify-center gap-1 animate-bounce">
                    <Flame className="w-4.5 h-4.5 text-[#1F2720] fill-[#1F2720]" /> ACTIVE QUEST
                  </div>
                  <div className="font-black text-sm text-[#1F2720] truncate">
                    {activeSessions.length > 0 ? activeSessions[0].topic_label : "No Active Topic"}
                  </div>
                  <div className="text-[10px] text-[#1F2720] font-bold mt-1.5 flex justify-between bg-white/40 px-2 py-1 rounded-lg border-2 border-[#1F2720]">
                    <span>Task Score:</span>
                    <span className="text-[#1F2720] font-black">{activeSessions.length > 0 ? `${activeSessions[0].mastered_count}/${activeSessions[0].total_in_chain}` : "0/0"}</span>
                  </div>
                  <div className="w-full bg-white rounded-full h-3.5 mt-2 border-2 border-[#1F2720] p-0.5 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full border-r-2 border-[#1F2720]" style={{ width: `${coursePct}%` }}></div>
                  </div>
                  <div className="text-[10px] text-[#1F2720] font-black mt-2 pt-2 border-t-2 border-[#1F2720]/15 animate-pulse">
                    TAP TO EXPLORE NOW!
                  </div>
                </div>

                <div className="w-16 h-16 rounded-full bg-[#fdd400] border-[4px] border-[#1F2720] flex items-center justify-center text-[#221b00] shadow-[4px_4px_0px_0px_#1F2720] relative z-10 animate-jelly transition-all active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720]">
                  <Flame className="w-9 h-9 fill-[#221b00] text-[#221b00]" />
                </div>
                <span className="mt-2.5 bg-[#fdd400] text-[#221b00] px-4.5 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase border-[3.5px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720]">
                  {activeSessions.length > 0 ? activeSessions[0].topic_label.slice(0, 12) + "..." : "Quest"}
                </span>
              </div>

              {/* NODE 3: LOCKED CANOPY */}
              <div className="absolute left-[63%] top-[32%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center island-node group opacity-60 z-10">
                {/* Cartoon Tooltip Card */}
                <div className="absolute bottom-18 bg-white border-[3.5px] border-[#1F2720] p-3 rounded-2xl w-48 text-center text-xs opacity-0 scale-90 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-50 text-[#1F2720] font-['Manrope'] cartoon-tooltip">
                  <div className="font-black text-slate-500 mb-1 flex items-center justify-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Locked Canopy
                  </div>
                  <div className="text-[10px] text-slate-600 font-bold leading-normal">
                    Conquer the active quest to clear the thorns and unlock this trail!
                  </div>
                </div>

                <div className="w-14 h-14 rounded-full bg-[#ccd3cd] border-[4px] border-[#1F2720] flex items-center justify-center text-[#525f54] shadow-[3px_3px_0px_0px_#1F2720]">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="mt-2 bg-[#ccd3cd] text-[#1F2720]/70 px-3 py-1 rounded-full text-[9px] font-black uppercase border-[3.5px] border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">
                  Quadratics
                </span>
              </div>

              {/* NODE 4: ANCIENT PEAK */}
              <div className="absolute left-[90%] top-[55%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center island-node group opacity-60 z-10">
                {/* Cartoon Tooltip Card */}
                <div className="absolute bottom-18 bg-white border-[3.5px] border-[#1F2720] p-3 rounded-2xl w-48 text-center text-xs opacity-0 scale-90 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-50 text-[#1F2720] font-['Manrope'] cartoon-tooltip">
                  <div className="font-black text-slate-500 mb-1 flex items-center justify-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Ancient Peaks
                  </div>
                  <div className="text-[10px] text-slate-600 font-bold leading-normal">
                    The ultimate trial of the Mathwood! Requires master ranking.
                  </div>
                </div>

                <div className="w-14 h-14 rounded-full bg-[#ccd3cd] border-[4px] border-[#1F2720] flex items-center justify-center text-[#525f54] shadow-[3px_3px_0px_0px_#1F2720]">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="mt-2 bg-[#ccd3cd] text-[#1F2720]/70 px-3 py-1 rounded-full text-[9px] font-black uppercase border-[3.5px] border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">
                  Exponents
                </span>
              </div>

            </div>
          </section>

          {/* Active Lessons + Tangled Brambles - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            
            {/* Guild Quests (Active Lessons) */}
            <section className="bg-[#faf8f5] rounded-[32px] p-6 border-4 border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_#1F2720] transition-all flex flex-col">
              <div className="flex items-center justify-between mb-5 border-b-4 border-[#1F2720] pb-3">
                <h3 className="flex items-center gap-2 font-['Hanken_Grotesk'] text-xl text-[#1F2720] font-black">
                  <Compass className="w-6 h-6 text-[#1F2720]" />
                  Active Quests
                </h3>
                <button
                  type="button"
                  onClick={() => router.push("/topics")}
                  className="font-['Manrope'] text-[11px] font-black text-[#1F2720] inline-flex items-center gap-1 bg-[#ffe170] hover:bg-[#fdd400] px-4 py-2 rounded-full border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer shrink-0"
                >
                  All Paths
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {activeSessions.length === 0 ? (
                <div className="text-center py-10 flex flex-col items-center justify-center flex-1 bg-white rounded-2xl border-4 border-dashed border-[#1F2720]/30 shadow-inner">
                  <Sprout className="w-12 h-12 text-[#1F2720]/40 mb-3 animate-pulse" />
                  <p className="text-[#1F2720] text-sm font-black mb-4">No active quests logged.</p>
                  <button
                    type="button"
onClick={() => {
  const hasCompletedPrerequisite = completedSessions.length > 0;

  if (!hasCompletedPrerequisite) {
    setErrorMsg("You must first complete the prerequisite trail before embarking on a new quest.");
    return;
  }

  router.push("/topics");
}}
className={`px-6 py-3.5 rounded-full font-['Manrope'] text-[12px] font-black border-[3.5px] border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720] transition-all
${
  completedSessions.length > 0
    ? "bg-[#fdd400] text-[#1F2720] hover:bg-[#ffe170] cursor-pointer"
    : "bg-gray-300 text-gray-500 cursor-not-allowed opacity-70"
}`}                  >
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
                        className="flex items-center gap-3.5 w-full bg-white p-3.5 rounded-2xl border-[3px] border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[6px_6px_0px_0px_#1F2720] active:translate-y-0 active:translate-x-0 active:shadow-[2px_2px_0px_0px_#1F2720] transition-all group"
                      >
                        <span className="w-11 h-11 rounded-xl bg-[#1F2720] text-white flex items-center justify-center shrink-0 border-2 border-[#1F2720] shadow-md group-hover:scale-105 transition-transform">
                          <Leaf className="w-5 h-5 text-[#fdd400] fill-[#fdd400]" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-['Manrope'] text-sm font-black text-[#1F2720] truncate m-0">{s.topic_label}</h4>
                          <p className="font-['Manrope'] text-xs font-bold text-slate-500 truncate m-0 mt-0.5">{s.current_node_label}</p>
                          
                          {/* Vine Styled Progress Bar */}
                          <div className="relative mt-3 w-full h-4 bg-white rounded-full overflow-visible border-2 border-[#1F2720] p-0.5">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-600 to-green-400 rounded-full transition-all relative border-r-2 border-[#1F2720]"
                              style={{ width: `${pct}%` }}
                            >
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#fdd400] border-2 border-[#1F2720] shadow-[0_0_6px_#fdd400]" />
                            </div>
                            {/* Gold blossom marker points */}
                            <div className="absolute left-[33%] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border-2 border-[#1f2720]" />
                            <div className="absolute left-[66%] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border-2 border-[#1f2720]" />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-1">
                          <span className="font-['Manrope'] text-[9px] font-black px-2.5 py-1 rounded-md bg-[#ffe170]/40 text-[#1F2720] border-[2.5px] border-[#1F2720] uppercase whitespace-nowrap">
                            {s.mastered_count}/{s.total_in_chain} Clear
                          </span>
                          <button
                            type="button"
                            onClick={() => handleResume(s.id)}
                            className="p-2 rounded-xl bg-[#fdd400] text-[#1F2720] border-[3px] border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[0px_0px_0px_0px_#1F2720] transition-all cursor-pointer shrink-0"
                            title="Resume Quest"
                          >
                            <ChevronRight className="w-4 h-4 stroke-[3px]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Tangled Brambles (Error History / Mascot Remediations) */}
            <section className="bg-[#faf8f5] rounded-[32px] p-6 border-4 border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_#1F2720] transition-all flex flex-col group">
              <div className="flex items-center justify-between mb-5 border-b-4 border-[#1F2720] pb-3">
                <h3 className="flex items-center gap-2 font-['Hanken_Grotesk'] text-xl text-[#1F2720] font-black">
                  <ShieldAlert className="w-6 h-6 text-[#ba1a1a]" />
                  Tangled Thorns
                </h3>
                <button
                  type="button"
                  onClick={() => setShowErrors((v) => !v)}
                  className={`font-['Manrope'] text-[11px] font-black px-4.5 py-2 rounded-full transition-all cursor-pointer border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] shrink-0 ${
                    showErrors 
                      ? "bg-red-200 text-red-800" 
                      : "bg-[#f2f4f6] text-[#434656] hover:bg-[#e6e8ea]"
                  }`}
                >
                  {showErrors ? "Hide Thorns" : `Inspect (${misconceptions.length})`}
                </button>
              </div>

              <div className="flex-1 flex flex-col justify-between">
                {!showErrors ? (
                  <div className="text-center py-6 flex flex-col items-center justify-center flex-1 bg-red-100/40 rounded-2xl border-4 border-dashed border-red-300 shadow-inner p-4 relative overflow-hidden">
                    <img 
                      alt="Suri worried mascot" 
                      src="/suri-snake-sad.png" 
                      className="h-16 w-auto object-contain select-none mb-2 animate-pulse hover:scale-110 transition-transform duration-200" 
                    />
                    <p className="text-sm font-black text-[#1F2720] mt-1">
                      {misconceptions.length} active brambles blocking your path.
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold max-w-[220px] mt-1 leading-normal">
                      Suri is ss-sad! Prune these thorny misconceptions to restore canopy light and get <strong className="text-[#1F2720] bg-[#fdd400] px-1.5 py-0.5 rounded border border-[#1F2720] shadow-[1.5px_1.5px_0px_0px_#1F2720] font-black">+50 dewdrops</strong>!
                    </p>
                  </div>
                ) : misconceptions.length === 0 ? (
                  <div className="text-center py-8 flex flex-col items-center justify-center flex-1 bg-green-100 rounded-2xl border-4 border-dashed border-green-300 shadow-inner p-4 relative overflow-hidden">
                    <img 
                      alt="Suri happy mascot" 
                      src="/suri-snake-happy.png" 
                      className="h-16 w-auto object-contain select-none mb-2 animate-bounce"
                      style={{ animationDuration: "2.5s" }}
                    />
                    <p className="text-sm font-black text-green-800">Clear Canopy!</p>
                    <p className="text-[10px] text-green-700 font-bold max-w-[220px] mt-1">
                      Suri is ss-so proud! The mathwood is blooming and completely safe!
                    </p>
                  </div>
                ) : (
                  <div className="divide-y-4 divide-[#1F2720]/15 max-h-[220px] overflow-y-auto pr-1 relative">
                    {/* Peeking Mascot inside errors list */}
                    <div className="sticky top-0 float-right z-10 pointer-events-none opacity-20 group-hover:opacity-100 transition-opacity duration-300">
                      <img 
                        alt="Suri peeking" 
                        src="/suri-snake-left.png" 
                        className="h-12 w-auto object-contain" 
                      />
                    </div>
                    {misconceptions.slice(0, 5).map((item, idx) => (
                      <div
                        key={`${item.node_id}-${item.logged_at}-${idx}`}
                        className="py-3.5 flex justify-between items-start gap-3 w-full bramble-item"
                      >
                        <span className="w-9 h-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 border-2 border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720] group mt-0.5">
                          <Leaf className="w-4.5 h-4.5 fill-red-600 bramble-leaf" />
                        </span>
                        <div className="min-w-0 flex-1 ml-1">
                          <p className="font-['Manrope'] text-xs font-black text-[#1F2720] m-0">{item.node_label}</p>
                          <p className="font-['Manrope'] text-[11px] font-bold text-slate-600 mt-1 m-0 line-clamp-2 leading-relaxed bg-white p-2 rounded-xl border-2 border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]/5">
                            {item.step_description}
                          </p>
                          <p className="text-[9px] text-[#737688] font-black mt-2">
                            Overgrown: {formatDate(item.logged_at)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReviewAgain(item.node_id)}
                          className="px-3.5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-[10px] font-black tracking-wider uppercase border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer shrink-0"
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
          <section className="bg-[#faf8f5] p-6 md:p-8 rounded-[32px] border-4 border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_#1F2720] transition-all h-full flex flex-col">
            
            {/* Header / Ranger License */}
            <div className="flex justify-between items-center mb-6 pb-2 border-b-4 border-[#1F2720] relative">
              <div className="flex items-center gap-1.5">
                <img 
                  alt="Suri badge mascot icon" 
                  src="/suri-snake-left.png" 
                  className="h-10 w-auto object-contain select-none shrink-0" 
                />
                <h2 className="font-['Hanken_Grotesk'] text-xl text-[#1F2720] font-black">Ranger Badge</h2>
              </div>
              <span className="text-[10px] font-black uppercase text-[#1F2720] bg-[#fdd400] px-3 py-1 rounded-md border-[2.5px] border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">Lv. {level}</span>
            </div>

            {/* Profile Avatar & Level Meter */}
            <div className="flex flex-col items-center mb-6 bg-white p-5 rounded-[28px] border-[3px] border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720] relative overflow-hidden">
              
              {/* Circular Leaf Wreath / Progress Gauge */}
              <div className="relative w-28 h-28 mb-3 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                  {/* Background Sand Wreath Circle */}
                  <circle
                    cx="56"
                    cy="56"
                    r="46"
                    className="stroke-[#e6e8ea] fill-transparent"
                    strokeWidth="10"
                  />
                  {/* Active Forest Wreath progress */}
                  <circle
                    cx="56"
                    cy="56"
                    r="46"
                    className="stroke-[#1F2720] fill-transparent transition-all"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 46}
                    strokeDashoffset={2 * Math.PI * 46 * (1 - levelPct / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                
                {/* Center Badge Avatar */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#1F2720] to-[#253224] flex items-center justify-center overflow-hidden border-[4px] border-[#1F2720] shadow-inner">
                  <span className="font-['Hanken_Grotesk'] text-3xl font-black text-[#fdd400] drop-shadow-[2px_2px_0px_#1F2720] select-none">
                    {name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
                  </span>
                </div>
              </div>

              <h3 className="font-['Hanken_Grotesk'] text-lg font-black text-[#1F2720] m-0">{name || "Ranger"}</h3>
              
              {/* Guild Title Badge */}
              <div className={`mt-2.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border-[3px] border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720] ${rankColor}`}>
                {levelEmoji} {rankTitle}
              </div>

              {/* Dewdrop Points Accumulator */}
              <div className="mt-4 flex items-center gap-1.5 text-[#221b00] bg-[#fdd400] px-5 py-2.5 rounded-full border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-default">
                <Flame className="w-5 h-5 fill-[#221b00] text-[#221b00]" />
                <span className="font-black text-sm tracking-tight">{dewdrops} Dewdrops</span>
              </div>
            </div>

            {/* Progression & Leveling Meter */}
            <div className="mb-6 bg-white p-4.5 rounded-[28px] border-[3px] border-[#1F2720] shadow-[4px_4px_0px_0px_#1F2720]">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-['Manrope'] text-[11px] font-black text-[#1f2720]">Level Progress</span>
                <span className="font-['Manrope'] text-[11px] font-black text-[#1F2720] bg-[#ffe170] px-2 py-0.5 rounded-md border-2 border-[#1F2720]">{Math.round(levelPct)}%</span>
              </div>
              <div className="h-5 w-full bg-[#e6e8ea] rounded-full overflow-hidden border-[3px] border-[#1F2720] p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-[#fdd400] rounded-full transition-all border-r-2 border-[#1F2720]"
                  style={{ width: `${levelPct}%` }}
                />
              </div>
              {pointsNeeded > 0 ? (
                <p className="font-['Manrope'] text-[10px] font-black text-slate-500 mt-2 mb-0">
                  ⭐ Collect <strong>{pointsNeeded} more dewdrops</strong> to level up your Ranger Badge!
                </p>
              ) : (
                <p className="font-['Manrope'] text-[10px] font-black text-emerald-800 mt-2 mb-0 flex items-center gap-1">
                  🦉 You have conquered the trails! Elder rank attained.
                </p>
              )}
            </div>

            {/* Achievements Backpack */}
            <div className="mt-auto pt-4 border-t-4 border-[#1F2720]">
              <div className="flex items-center gap-1.5 mb-3.5">
                <Compass className="w-4.5 h-4.5 text-[#1F2720]" />
                <h4 className="font-['Hanken_Grotesk'] text-sm font-black text-[#1F2720]">Backpack Gear</h4>
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
                          desc: ach.unlocked ? ach.desc : `🔒 Locked Gear. ${ach.desc}`
                        });
                      }}
                      className={`relative aspect-square rounded-2xl flex items-center justify-center text-2xl cursor-pointer transition-all border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] ${
                        ach.unlocked
                          ? `bg-gradient-to-br ${ach.color} hover:-translate-y-1 hover:shadow-[5px_5px_0px_0px_#1F2720] active:translate-y-0 active:shadow-[1px_1px_0px_0px_#1F2720]`
                          : "bg-gray-100 text-gray-400 opacity-60 hover:bg-gray-200"
                      }`}
                      title={`${ach.title}: ${ach.desc}`}
                    >
                      <span className="select-none">{ach.badge}</span>
                      {!ach.unlocked && (
                        <div className="absolute inset-0 bg-white/30 backdrop-blur-[0.5px] rounded-2xl flex items-center justify-center">
                          <Lock className="w-4 h-4 text-[#1F2720]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Interactive Achievement Detail Box */}
              <div className="min-h-[75px] mt-4 p-3 rounded-2xl bg-white border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] flex flex-col justify-center">
                {selectedBadge ? (
                  <>
                    <h5 className="font-['Manrope'] text-xs font-black text-[#1F2720] m-0">{selectedBadge.title}</h5>
                    <p className="font-['Manrope'] text-[10px] font-bold text-slate-500 m-0 mt-1 leading-normal">{selectedBadge.desc}</p>
                  </>
                ) : (
                  <p className="font-['Manrope'] text-[10px] font-black text-slate-400 text-center m-0 italic">
                    🎒 Tap backpack items to inspect your Ranger records!
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Course Mastery Stats */}
            <div className="mt-5 pt-4 border-t-4 border-[#1F2720]">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-['Manrope'] text-[11px] font-black text-[#191c1e]">Total Math Mastery</span>
                <span className="font-['Manrope'] text-[11px] font-black text-[#1F2720] bg-emerald-100 border-2 border-[#1F2720] px-2 py-0.5 rounded-md">{coursePct}%</span>
              </div>
              <div className="h-4.5 w-full bg-white rounded-full overflow-hidden border-[3px] border-[#1F2720] p-0.5">
                <div
                  className="h-full bg-[#1F2720] rounded-full transition-all"
                  style={{ width: `${coursePct}%` }}
                />
              </div>
              <p className="font-['Manrope'] text-[9px] text-slate-500 mt-2.5 m-0 font-extrabold leading-normal">
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
