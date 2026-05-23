"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import MainPage from "@/components/mainpage";
import { getMe, getStudentProgress, MisconceptionHistoryItem } from "../../lib/api";

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
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await getMe();
        const progress = await getStudentProgress(me.student_id);
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

  return (
    <MainPage>
      <div className="space-y-6">
          
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
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_15px_30px_rgba(0,26,84,0.05)] flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="font-mono text-xs text-slate-500 uppercase tracking-wider">LOGGED ITEMS</span>
                <span className="text-[10px] font-mono text-[#001a54] bg-[#fdd400] px-2.5 py-0.5 rounded-full font-bold">ACTIVE</span>
              </div>
              <div className="my-3">
                <span className="font-mono text-5xl font-bold text-[#001a54] tracking-tighter">
                  {loading ? "--" : String(misconceptions.length).padStart(2, '0')}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-500">
                Total cognitive friction points recorded in this cycle.
              </p>
            </div>
          </div>

          {/* System Error Notification Banner */}
          {errorMsg && (
            <div className="bg-red-50/50 border border-red-200 rounded-2xl p-5 shadow-[0_10px_20px_rgba(239,68,68,0.03)] flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-red-600 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(220,38,38,0.4)]" />
              <div>
                <span className="font-mono text-xs text-red-700 font-bold uppercase tracking-widest block mb-1">[SYSTEM ERROR]</span>
                <p className="font-mono text-sm text-red-800">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Primary Log Feed Container */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 md:p-6 shadow-[0_20px_40px_rgba(0,26,84,0.03)]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-[#fdd400] shadow-[0_0_6px_#fdd400]" />
                <h2 className="font-['Hanken_Grotesk',_sans-serif] text-lg font-bold text-[#001a54] tracking-tight">Active Logs</h2>
              </div>
              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">STREAM // SECURE</span>
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
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <div className="w-12 h-12 rounded-full bg-[#fdd400]/10 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-[#001a54]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-['Hanken_Grotesk',_sans-serif] text-base font-semibold text-[#001a54]">Log Clean & Clear</p>
                <p className="font-mono text-xs text-slate-400 mt-1">No conceptual errors found in the registry.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {misconceptions.map((item, idx) => (
                  <div
                    key={`${item.node_id}-${item.logged_at}-${idx}`}
                    className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#001a54]/30 transition-all duration-300 shadow-[0_4px_12px_rgba(0,26,84,0.02)] hover:shadow-[0_15px_30px_rgba(0,26,84,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Left Accent Indicator */}
                      <div className="w-1.5 h-12 bg-[#fdd400] rounded-full self-center shrink-0 transition-all group-hover:scale-y-110" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="font-mono text-[9px] text-[#001a54] font-bold tracking-widest bg-[#fdd400]/20 px-2 py-0.5 rounded uppercase">
                            RECORD #{String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-mono text-[9px] text-slate-400 font-semibold">
                            NODE: {item.node_id}
                          </span>
                        </div>
                        <h3 className="font-['Hanken_Grotesk',_sans-serif] text-base md:text-lg font-bold text-[#001a54] tracking-tight leading-snug transition-colors">
                          {item.node_label}
                        </h3>
                        <p className="font-mono text-xs text-slate-600 mt-1.5 max-w-2xl leading-relaxed">
                          {item.step_description}
                        </p>
                      </div>
                    </div>
                    
                    {/* Timestamp section */}
                    <div className="flex md:flex-col items-end justify-between md:justify-center shrink-0 border-t border-slate-100 md:border-t-0 pt-3 md:pt-0">
                      <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest block md:hidden">LOGGED DATE</span>
                      <span className="font-mono text-xs text-[#001a54] font-bold bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                        {formatDate(item.logged_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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