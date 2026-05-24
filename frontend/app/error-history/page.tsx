"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import MainPage from "@/components/mainpage";
import { 
  getMe, 
  getStudentProgress, 
  createSession, 
  skipDiagnostic, // Imported to bypass diagnostics on newly created sessions
  MisconceptionHistoryItem 
} from "../../lib/api";
import { BookOpen, Calendar, Loader2, Sparkles } from "lucide-react";

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
      <div className="bg-slate-50 min-h-screen text-slate-800 py-4 px-4 md:px-6 space-y-4">
        <div className="max-w-5xl mx-auto space-y-4">

         {/* Bento Grid Header Block */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Main Display panel */}
      <div className="lg:col-span-2 bg-[#001a54] rounded-2xl p-6 md:p-8 border border-white/10 shadow-[0_0_30px_rgba(0,26,84,0.4)] relative overflow-hidden flex flex-col justify-between min-h-[180px]">
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400]" />
            <span className="font-mono text-xs text-slate-300 tracking-[0.2em] uppercase">SYSTEM LOG</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400 bg-black/30 px-2 py-1 rounded border border-white/5">ENG_MODE</span>
        </div>
        
        <div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white font-['Hanken_Grotesk',_sans-serif]">
            Error <span className="text-[#fdd400]">History</span>
          </h1>
          <p className="font-mono text-xs text-slate-300 mt-2 tracking-wide">
            ANALYZING CONCEPTUAL ANOMALIES AND REASONING DISCREPANCIES
          </p>
        </div>
      </div>

            {/* Metric Bento block */}
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-[0_15px_30px_rgba(0,26,84,0.05)] flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-bold">LOGGED ITEMS</span>
                <span className="text-[9px] font-mono text-[#001a54] bg-[#fdd400] px-2.5 py-1 rounded-full font-extrabold tracking-wider">ACTIVE</span>
              </div>
              <div className="my-2">
                <span className="font-mono text-5xl font-black text-[#001a54] tracking-tighter">
                  {loading ? "--" : String(misconceptions.length).padStart(2, '0')}
                </span>
              </div>
              <p className="font-mono text-[10px] text-slate-500 leading-relaxed">
                Total cognitive friction points recorded in this cycle.
              </p>
            </div>
          </div>

          {/* System Error Notification Banner */}
          {errorMsg && (
            <div className="bg-red-50/50 border border-red-200 rounded-2xl p-5 shadow-[0_10px_20px_rgba(239,68,68,0.03)] flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-red-600 mt-1.5 shrink-0" />
              <div>
                <span className="font-mono text-xs text-red-700 font-bold uppercase tracking-widest block mb-1">[WORKSPACE EXCEPTION]</span>
                <p className="font-mono text-sm text-red-800">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Primary Log Feed Container */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 md:p-6 shadow-[0_20px_40px_rgba(0,26,84,0.03)]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-[#fdd400] shadow-[0_0_6px_#fdd400]" />
                <h2 className="font-['Hanken_Grotesk',_sans-serif] text-base font-bold text-[#001a54] tracking-tight">Active Logs</h2>
              </div>
              <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest">STREAM // SECURE</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                  <div className="absolute inset-0 border-4 border-[#001a54] border-t-[#fdd400] rounded-full animate-spin" />
                </div>
                <p className="font-mono text-[10px] text-slate-500 tracking-widest uppercase animate-pulse">Initializing Streams...</p>
              </div>
            ) : misconceptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3 border border-green-100 shadow-sm">
                  <span className="text-green-600 font-bold">✓</span>
                </div>
                <p className="font-['Hanken_Grotesk',_sans-serif] text-base font-semibold text-[#001a54]">Log Clean & Clear</p>
                <p className="font-mono text-xs text-slate-500 mt-1">No conceptual errors found in the registry.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {misconceptions.map((item, idx) => {
                  const isNodeLoading = loadingNodeId === item.node_id;
                  const reviewTip = REVIEW_TIPS[item.node_id] || "Review variables, factors, and coordinate signs related to this section.";

                  return (
                    <div
                      key={`${item.node_id}-${item.logged_at}-${idx}`}
                      className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 hover:border-[#001a54]/30 transition-all duration-300 shadow-[0_4px_12px_rgba(0,26,84,0.01)] hover:shadow-[0_15px_30px_rgba(0,26,84,0.05)] flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        {/* Gold status marker line */}
                        <div className="w-1 h-16 bg-[#fdd400] rounded-full self-center shrink-0 shadow-[0_0_6px_rgba(253,212,0,0.4)] transition-all group-hover:scale-y-110" />
                        
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[9px] text-[#001a54] font-extrabold bg-[#fdd400]/20 border border-[#fdd400]/40 px-2 py-0.5 rounded uppercase">
                              ERROR RECORD #{String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="font-mono text-[9px] text-slate-400 font-semibold">
                              NODE: {item.node_id}
                            </span>
                          </div>
                          
                          <h3 className="font-['Hanken_Grotesk',_sans-serif] text-base font-extrabold text-[#001a54] tracking-tight leading-snug">
                            {item.node_label}
                          </h3>
                          
                          <p className="font-mono text-xs text-slate-400 leading-normal">
                            Attempted Step: <span className="text-slate-600 font-medium italic">"{item.step_description}"</span>
                          </p>

                          {/* Friendly Tutor Explainer Tip Block */}
                          <div className="mt-2.5 bg-[#001a54]/5 rounded-xl p-3 border border-slate-100 text-slate-600">
                            <p className="text-[9px] font-mono uppercase tracking-widest font-extrabold text-[#001a54] mb-1 flex items-center gap-1">
                              <Sparkles size={8} /> SURI's Recovery Tip
                            </p>
                            <p className="text-xs font-medium leading-relaxed font-sans">
                              {reviewTip}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Active Action Section */}
                      <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center shrink-0 gap-3 border-t border-slate-100 md:border-t-0 pt-3 md:pt-0">
                        <div className="text-left md:text-right flex items-center md:items-end gap-1 font-mono text-[10px] text-slate-500">
                          <Calendar size={10} className="text-slate-400" />
                          <span>{formatDate(item.logged_at)}</span>
                        </div>

                        {/* Interactive practice recovery launcher */}
                        <button
                          onClick={() => handleReviewNode(item.node_id)}
                          disabled={loadingNodeId !== null}
                          className="bg-[#001a54] text-white hover:bg-[#001545] py-2.5 px-4 text-xs font-mono font-bold uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                          {isNodeLoading ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <BookOpen size={12} />
                          )}
                          {isNodeLoading ? "Launching..." : "Review Lesson"}
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
            <div className="absolute inset-0 border-4 border-[#001a54] border-t-[#fdd400] rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <ErrorHistoryContent />
    </Suspense>
  );
}