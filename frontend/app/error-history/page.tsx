"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import MainPage from "@/components/mainpage";
import { 
  getMe, 
  getStudentProgress, 
  createSession, 
  skipDiagnostic, 
  MisconceptionHistoryItem 
} from "../../lib/api";
import { 
  BookOpen, 
  Calendar, 
  Loader2, 
  Sparkles, 
  Compass, 
  Leaf, 
  Flame, 
  ShieldAlert, 
  Sprout, 
  ChevronRight, 
  ArrowRight 
} from "lucide-react";

// Student-friendly review tips mapped directly to active learning codes [1]
const REVIEW_TIPS: Record<string, string> = {
  "QE": "Quadratic equations require isolating variables or factoring trinomials. Remember that quadratics can have up to two solutions. If factoring is difficult, try using the Quadratic Formula.",
  "FP": "Factoring polynomials is about breaking complex expressions down into simpler multiplying components. Always check if there is a Greatest Common Factor (GCF) you can factor out first.",
  "SP": "Polynomial multiplication relies heavily on distribution. When multiplying binomials, use FOIL (First, Outer, Inner, Last) and watch exponent addition rules carefully.",
  "LE": "When working with exponents, remember: when multiplying like bases, add the powers ($x^a \\cdot x^b = x^{a+b}$). When raising a power to a power, multiply them ($(x^a)^b = x^{ab}$).",
  "OI": "Be extra mindful of negative signs! Subtracting a negative is equivalent to adding a positive value ($a - (-b) = a + b$). Re-verify sign distributions at each intermediate step.",
  "FD": "Fractions and decimals require common denominators before adding or subtracting. When dividing fractions, remember the reciprocal rule: multiply by the flipped second term.",
  "SLE": "Systems of Linear Equations find the common point where two equations overlap. You can systematically solve them using substitution, elimination, or graphing.",
  "L2V": "When graphing linear equations in two variables, identify the y-intercept first to plot your starting point, then use the slope (rise over run) to locate your second coordinate.",
  "L1V": "Linear equations in one variable require isolating the variable on one side. Whatever algebraic operations you apply to the left side must also be applied identically to the right side.",
  "AE": "Evaluating algebraic expressions simply means substituting given constant numbers in place of the variables. Complete calculations following strict order of operations (PEMDAS).",
  "RER": "Rational exponents can be rewritten directly as radicals: $x^{a/b} = \\sqrt[b]{x^a}$. Radical terms can only be combined if they share identical base radicands.",
  "PE": "Higher-degree polynomial equations require finding roots. Try grouping terms or utilizing the Factor Theorem to find at least one linear divisor.",
  "PD": "Polynomial division can be solved using long division or synthetic division. Keep placeholder terms (like $0x^2$) visible so columns align correctly.",
  "PO": "When combining polynomials, remember you can only add or subtract like terms. Terms with different variable degrees (like $x^3$ and $x^2$) cannot be merged."
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ErrorHistoryContent() {
  const router = useRouter();
  const [misconceptions, setMisconceptions] = useState<MisconceptionHistoryItem[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Tracking loading state for targeted launch buttons
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await getMe();
        const progress = await getStudentProgress(me.student_id);
        setActiveSessions(progress.active_sessions || []);
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
          err instanceof Error ? err.message : "Failed to load error history."
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  // Launches or resumes the targeted learning path [1]
  const handleReviewNode = async (nodeId: string) => {
    setLoadingNodeId(nodeId);
    setErrorMsg(null);
    try {
      // 1. Check if there is already an active session in progress for this topic node
      const existingSession = activeSessions.find(
        (s) => s.topic_entry_node === nodeId
      );

      if (existingSession) {
        // If in progress, redirect straight to the lesson workspace [1]
        router.push(`/session/${existingSession.id}/lesson`);
        return;
      }

      // 2. If no session exists, create a new one
      const newSession = await createSession({ topic_entry_node: nodeId });
      
      // 3. Immediately bypass the diagnostic phase [1]
      await skipDiagnostic(newSession.id);
      router.push(`/session/${newSession.id}/lesson`);
    } catch (err: any) {
      setErrorMsg("Could not load the lesson. Please try again.");
    } finally {
      setLoadingNodeId(null);
    }
  };

  return (
    <MainPage>
      {/* Inline styles for custom animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatFirefly {
          0% { transform: translateY(110%) translateX(0); opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-20px) translateX(30px); opacity: 0; }
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
      ` }} />

      <div className=" min-h-screen text-[#1F2720] py-4 px-2 md:px-4 relative overflow-hidden">
        <div className="w-full max-w-[1800px] mx-auto space-y-6 relative z-10">

          {/* Gamified Header Bento Blocks */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Block: Main Title Panel */}
            <div className="lg:col-span-8 bg-gradient-to-b from-[#1b261c] to-[#2e3e2d] rounded-[32px] p-6 md:p-8 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] relative overflow-hidden flex flex-col justify-between min-h-[190px]">
              
              {/* Backing glow */}
              <div className="absolute top-0 right-1/4 w-32 h-32 bg-yellow-400/25 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between mb-4 border-b-4 border-[#1F2720]/30 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400] border border-[#1F2720]" />
                  <span className="font-['Manrope'] text-[10px] text-emerald-300 tracking-widest uppercase font-black">RANGER EXPEDITION REPORTS</span>
                </div>
                <span className="text-[9px] font-black text-[#1F2720] bg-[#fdd400] px-2.5 py-1 rounded-md border-2 border-[#1F2720]">ERROR LOG</span>
              </div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-auto">
                <div className="flex items-center gap-4">
                  <img 
                    src="/suri-snake-sad.png" 
                    alt="Suri" 
                    className="h-20 w-auto object-contain select-none shrink-0 animate-jelly"
                  />
                  <div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white font-['Hanken_Grotesk'] drop-shadow-[2px_2px_0px_#1F2720]">
                      Tangled <span className="text-[#fdd400]">Thorns</span>
                    </h1>
                    <p className="font-['Manrope'] text-xs text-emerald-200 mt-1.5 leading-relaxed font-bold">
Clean up the tangled steps so the path is clear again and Suri can move safely through the Mathwood trails!                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Block: Live Score Indicator */}
            <div className="lg:col-span-4 bg-[#faf8f5] rounded-[32px] p-6 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] flex flex-col justify-between relative overflow-hidden hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[10px_10px_0px_0px_#1F2720] transition-all group">
              <div className="flex justify-between items-start">
                <span className="font-['Manrope'] text-[10px] text-slate-500 uppercase tracking-widest font-black">Active Obstructions</span>
                <span className="text-[9px] font-black text-red-800 bg-red-100 border-[2px] border-[#1F2720] px-2.5 py-1 rounded-full font-extrabold tracking-wider uppercase">Active</span>
              </div>
              <div className="my-3 flex items-baseline gap-2">
                <span className="font-['Hanken_Grotesk'] text-5xl font-black text-[#1F2720] tracking-tighter">
                  {loading ? "--" : String(misconceptions.length).padStart(2, '0')}
                </span>
                <span className="text-slate-400 font-extrabold text-sm">thorns logged</span>
              </div>
              <p className="font-['Manrope'] text-[10px] text-slate-500 leading-relaxed font-bold">
                Clear these obstacles to unlock new areas and claim bonus <strong className="text-[#1F2720] bg-[#fdd400] px-1 py-0.5 rounded">+50 Forest Dewdrops</strong>.
              </p>
            </div>
          </div>

          {/* Error Notification Banner */}
          {errorMsg && (
            <div className="bg-red-100 border-[3.5px] border-[#1F2720] rounded-[24px] p-5 shadow-[4px_4px_0px_0px_#1F2720] flex items-start gap-4 animate-bounce">
              <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-['Manrope'] text-[11px] text-red-900 font-black uppercase tracking-widest block mb-1">WORKSPACE EXCEPTION DETECTED</span>
                <p className="font-['Manrope'] text-xs text-red-900 font-extrabold">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Primary Log Feed Container */}
          <div className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] p-6 shadow-[8px_8px_0px_0px_#1F2720]">
            
            <div className="flex items-center justify-between pb-3.5 border-b-[4px] border-[#1F2720]/15 mb-5">
              <div className="flex items-center gap-2">
                <Leaf className="w-5 h-5 text-emerald-700 fill-emerald-700" />
                <h2 className="font-['Hanken_Grotesk'] text-lg font-black text-[#1F2720] tracking-tight">Active Logs</h2>
              </div>
              <span className="font-['Manrope'] text-[10px] text-slate-400 uppercase tracking-wider font-black">SECURE DATA STREAM</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white/50 rounded-2xl border-4 border-dashed border-[#1F2720]/20">
                <Loader2 size={36} className="animate-spin text-[#1F2720]" />
                <p className="font-['Manrope'] text-[11px] text-slate-500 tracking-widest uppercase font-black animate-pulse">Initializing Streams...</p>
              </div>
            ) : misconceptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border-4 border-dashed border-[#1F2720]/20 rounded-2xl bg-white p-4">
                <div className="w-14 h-14 rounded-full bg-[#79ff8f] flex items-center justify-center mb-3 border-[3px] border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">
                  <span className="text-emerald-900 font-black text-xl">✓</span>
                </div>
                <p className="font-['Hanken_Grotesk'] text-lg font-black text-[#1F2720]">Log Clean & Clear!</p>
                <p className="font-['Manrope'] text-xs text-slate-500 font-bold max-w-sm mt-1 leading-normal">
                  Suri is so proud! No conceptual brambles are currently obstructing your canopy path. Enjoy the sunshine!
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {misconceptions.map((item, idx) => {
                  const isNodeLoading = loadingNodeId === item.node_id;
                  const reviewTip = REVIEW_TIPS[item.node_id] || "Review variables, factors, and coordinate signs related to this section.";

                  return (
                    <div
                      key={`${item.node_id}-${item.logged_at}-${idx}`}
                      className="bg-white border-[3.5px] border-[#1F2720] rounded-[24px] p-5 hover:border-emerald-600 transition-all duration-300 shadow-[4px_4px_0px_0px_#1F2720] hover:shadow-[8px_8px_0px_0px_#1F2720] hover:-translate-y-1 hover:-translate-x-1 active:translate-y-0 active:translate-x-0 active:shadow-[2px_2px_0px_0px_#1F2720] flex flex-col md:flex-row md:items-center justify-between gap-5 group bramble-item"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        
                        {/* Status Icon Wrapper */}
                        <span className="w-11 h-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] mt-0.5">
                          <Leaf className="w-5 h-5 fill-red-600 bramble-leaf" />
                        </span>

                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-['Manrope'] text-[9px] text-red-900 font-black bg-red-100 border-2 border-[#1F2720] px-2 py-0.5 rounded-md uppercase tracking-wider">
                              RECORD #{String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="font-['Manrope'] text-[9px] text-[#1F2720] font-black bg-slate-100 border-2 border-[#1F2720] px-2 py-0.5 rounded-md">
                              NODE ID: {item.node_id}
                            </span>
                          </div>
                          
                          <h3 className="font-['Hanken_Grotesk'] text-lg font-black text-[#1F2720] tracking-tight leading-snug truncate">
                            {item.node_label}
                          </h3>
                          
                          <p className="font-['Manrope'] text-xs font-bold text-slate-500 leading-normal bg-slate-50 border-2 border-[#1F2720]/10 rounded-xl p-2.5 max-w-full inline-block">
                            Logged Obstacle: <span className="text-[#1F2720] font-black">"{item.step_description}"</span>
                          </p>

                          {/* Friendly Tutor Explainer Tip Block */}
                          <div className="mt-2.5 bg-[#ffe170]/15 rounded-2xl p-4 border-[3px] border-[#1F2720] text-slate-600 relative overflow-hidden shadow-[2px_2px_0px_0px_#1F2720]/5">
                            <div className="absolute right-2 -bottom-2 opacity-5 pointer-events-none">
                              <img src="/suri-snake-left.png" alt="watermark" className="w-16 h-auto" />
                            </div>
                            <p className="text-[10px] font-['Manrope'] uppercase tracking-widest font-black text-[#1F2720] mb-1.5 flex items-center gap-1">
                              <Sparkles size={11} className="text-[#fdd400] fill-[#fdd400] stroke-[2.5px]" /> SURI'S RECOVERY DISPATCH
                            </p>
                            <p className="text-xs font-bold leading-relaxed text-[#1F2720] font-sans">
                              {reviewTip}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Active Action Section */}
                      <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center shrink-0 gap-3 border-t-2 border-[#1F2720]/10 md:border-t-0 pt-3 md:pt-0">
                        <div className="text-left md:text-right flex items-center md:items-end gap-1.5 font-['Manrope'] text-[10px] text-slate-500 font-black">
                          <Calendar size={12} className="text-slate-400 stroke-[2.5px]" />
                          <span>{formatDate(item.logged_at)}</span>
                        </div>

                        {/* Interactive Practice Recovery Button */}
                        <button
                          onClick={() => handleReviewNode(item.node_id)}
                          disabled={loadingNodeId !== null}
                          className="bg-[#fdd400] text-[#1F2720] py-3.5 px-5 text-xs font-['Manrope'] font-black uppercase rounded-2xl tracking-wider transition-all cursor-pointer border-[3.5px] border-[#1F2720] shadow-[3.5px_3.5px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
                        >
                          {isNodeLoading ? (
                            <Loader2 size={13} className="animate-spin text-[#1F2720] stroke-[2.5px]" />
                          ) : (
                            <BookOpen size={13} className="stroke-[2.5px]" />
                          )}
                          {isNodeLoading ? "Clearing..." : "Prune Trail"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </MainPage>
  );
}

export default function ErrorHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1b261c] flex items-center justify-center">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-[#1F2720]/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-[#1F2720] border-t-[#fdd400] rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <ErrorHistoryContent />
    </Suspense>
  );
}