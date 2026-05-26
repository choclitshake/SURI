"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainPage from "@/components/mainpage";
import { getTopics, TopicInfo, getMe, getStudentProgress, createSession } from "../../lib/api";

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [activeTopics, setActiveTopics] = useState<Record<string, string>>({});
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [data, me] = await Promise.all([getTopics(), getMe()]);
        const progress = await getStudentProgress(me.student_id);
        
        const activeMap: Record<string, string> = {};
        for (const s of progress.active_sessions || []) {
          activeMap[s.topic_entry_node] = s.id;
        }
        
        const completedSet = new Set<string>();
        for (const s of progress.completed_sessions || []) {
          completedSet.add(s.topic_entry_node);
        }
        
        setActiveTopics(activeMap);
        setCompletedTopics(completedSet);
        setTopics(data);
      } catch (err: any) {
        setError(err.detail || err.message || "Failed to load topics. Are you logged in?");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleResume = (sessionId: string) => {
    router.push(`/session/${sessionId}/lesson`);
  };

  const handleReviewAgain = (nodeId: string) => {
    router.push(`/topics/${nodeId}`);
  };

  const handleStartTopic = (nodeId: string) => {
    router.push(`/topics/${nodeId}`);
  };

  return (
    <MainPage>
      <div className="min-h-screen text-[#1F2720] py-4 px-2 md:px-4">
        <div className="w-full max-w-[1800px] mx-auto space-y-6">

          {/* Bento Grid Header Block */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
  
            {/* Main Branding Display Header Card */}
            <div className="lg:col-span-2 bg-[#223324] rounded-[32px] p-6 md:p-8 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
              
              <div className="absolute top-0 right-0 opacity-50 z-0">
                <img src="/suri-snake-left.png" alt="Suri Mascot" className="w-48 h-auto object-contain translate-x-4 translate-y-4 pointer-events-none" />
              </div>
              
              <div className="flex items-center justify-between mb-4 z-10">
                <div className="flex items-center gap-2 bg-[#1b261c] px-3 py-1.5 rounded-full border-[2px] border-[#1F2720]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse border border-[#1F2720]" />
                  <span className="font-['Manrope'] text-xs text-[#fdd400] font-black tracking-[0.2em] uppercase">CURRICULUM MAP</span>
                </div>
              </div>
              
              <div className="z-10 mt-6">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white font-['Hanken_Grotesk'] drop-shadow-[2px_2px_0px_#1F2720]">
                  Forest <span className="text-[#fdd400] relative inline-block">Trails</span>
                </h1>
                <p className="font-['Manrope'] text-sm text-[#ffe170] mt-2 font-bold uppercase drop-shadow-[1px_1px_0px_#1F2720]">
                  Choose a trail to begin your adventure
                </p>
              </div>
            </div>

            {/* Total Tracks Status Indicator */}
            <div className="bg-[#faf8f5] rounded-[32px] p-6 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_#1F2720] transition-all">
              <div className="flex justify-between items-start">
                <span className="font-['Manrope'] text-xs text-[#1F2720] font-black uppercase tracking-wider">TOTAL TRAILS</span>
                <span className="text-[10px] font-black font-['Manrope'] text-[#1F2720] bg-[#e6e8ea] px-2.5 py-0.5 rounded-md border-2 border-[#1F2720]">MAPPED</span>
              </div>
              <div className="my-3">
                <span className="font-['Hanken_Grotesk'] text-5xl font-black text-[#1F2720] tracking-tighter drop-shadow-[2px_2px_0px_#e6e8ea] group-hover:text-[#005b21] transition-colors">
                  {loading ? "--" : String(topics.length).padStart(2, '0')}
                </span>
              </div>
              <p className="font-['Manrope'] text-xs text-slate-500 font-bold">
                Paths structured for your active learning layout.
              </p>
            </div>

            {/* In-Progress Status Indicator */}
            <div className="bg-[#faf8f5] rounded-[32px] p-6 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_#1F2720] transition-all">
              <div className="flex justify-between items-start">
                <span className="font-['Manrope'] text-xs text-[#1F2720] font-black uppercase tracking-wider">ACTIVE QUESTS</span>
                <span className="text-[10px] font-black font-['Manrope'] text-[#1F2720] bg-[#fdd400] px-2.5 py-0.5 rounded-md border-2 border-[#1F2720]">RUNNING</span>
              </div>
              <div className="my-3">
                <span className="font-['Hanken_Grotesk'] text-5xl font-black text-[#1F2720] tracking-tighter drop-shadow-[2px_2px_0px_#fdd400] group-hover:text-[#005b21] transition-colors">
                  {loading ? "--" : String(Object.keys(activeTopics).length).padStart(2, '0')}
                </span>
              </div>
              <p className="font-['Manrope'] text-xs text-slate-500 font-bold">
                Tracks you are currently processing.
              </p>
            </div>
          </div>

          {/* System Error Notification Banner */}
          {error && (
            <div className="bg-red-100 border-[3px] border-[#1F2720] rounded-[24px] p-5 shadow-[4px_4px_0px_0px_#1F2720] flex items-start gap-4">
              <img src="/suri-snake-sad.png" alt="Sad Suri" className="w-10 h-10 object-contain shrink-0" />
              <div>
                <span className="font-['Manrope'] text-xs text-red-800 font-black uppercase tracking-widest block mb-1">Oh no! A thorny problem!</span>
                <p className="font-['Manrope'] text-sm text-red-900 font-bold">{error}</p>
              </div>
            </div>
          )}

          {/* Timeline Layout of Tracks */}
          {loading ? (
            <div className="bg-[#faf8f5] rounded-[32px] border-[4px] border-[#1F2720] p-12 shadow-[8px_8px_0px_0px_#1F2720] flex flex-col items-center justify-center space-y-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-4 border-[#e6e8ea] rounded-full" />
                <div className="absolute inset-0 border-4 border-[#1F2720] border-t-[#fdd400] rounded-full animate-spin" />
              </div>
              <p className="font-['Manrope'] text-xs text-[#1F2720] font-black tracking-widest uppercase animate-pulse">Mapping Forest Trails...</p>
            </div>
          ) : (
            <div className="relative pl-10 md:pl-0">
              <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-1 md:-translate-x-1/2 bg-[#1F2720] rounded-full" />

              <div className="space-y-6">
              {topics.map((topic, index) => {
                const isActive = topic.node_id in activeTopics;
                const isCompleted = completedTopics.has(topic.node_id);
                const isLeft = index % 2 === 0;
                const trackPct = isCompleted ? 100 : isActive ? 50 : 0;
                const statusText = isCompleted ? "Mastered" : isActive ? "In Progress" : "Not Attempted";
                const statusClass = isCompleted
                  ? "bg-emerald-600 text-white"
                  : isActive
                  ? "bg-[#fdd400] text-[#1F2720]"
                  : "bg-slate-100 text-slate-600";

                return (
                  <div key={topic.node_id} className="relative grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-stretch">
                    <div className={`${isLeft ? "md:order-1" : "md:order-2"}`}>
                      <div className="bg-white rounded-[24px] p-6 flex flex-col justify-between transition-all duration-300 relative group overflow-hidden border-[4px] border-[#1F2720] shadow-[6px_6px_0px_0px_#1F2720] min-h-[220px]">
                        <div className="pl-2">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-['Manrope'] text-[9px] text-[#1F2720] font-black uppercase tracking-widest bg-[#e6e8ea] px-2 py-1 rounded-md border-2 border-[#1F2720]">
                              TRAIL: {topic.node_id}
                            </span>
                          </div>

                          <h2 className="text-2xl font-black font-['Hanken_Grotesk'] text-[#1F2720] tracking-tight mt-3">
                            {topic.label}
                          </h2>

                          <p className="text-xs font-['Manrope'] font-bold text-slate-500 mt-2">
                            Grade {topic.grade}
                          </p>
                        </div>

                        <div className="mt-8 pl-2 flex flex-col sm:flex-row gap-3">
                          {isActive && (
                            <button
                              onClick={() => {
                                handleResume(activeTopics[topic.node_id]);
                              }}
                              className="flex-1 bg-[#fdd400] text-[#1F2720] hover:bg-[#ffe170] py-3 px-4 text-xs font-['Manrope'] font-black uppercase rounded-[16px] tracking-wider text-center transition-all cursor-pointer border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720]"
                            >
                              Resume Quest
                            </button>
                          )}

                          {isCompleted && (
                            <button
                              onClick={() => {
                                handleReviewAgain(topic.node_id);
                              }}
                              className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] py-3 px-4 text-xs font-['Manrope'] font-black uppercase rounded-[16px] tracking-wider text-center transition-all cursor-pointer"
                            >
                              Review Again
                            </button>
                          )}

                          {!isActive && !isCompleted && (
                            <button
                              onClick={() => {
                                handleStartTopic(topic.node_id);
                              }}
                              className="flex-1 bg-white hover:bg-slate-50 text-[#1F2720] border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#1F2720] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1F2720] py-3 px-4 text-xs font-['Manrope'] font-black uppercase rounded-[16px] tracking-wider text-center transition-all cursor-pointer"
                            >
                              Embark
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={`${isLeft ? "md:order-2" : "md:order-1"}`}>
                      <div className="bg-[#faf8f5] rounded-[24px] p-6 border-[4px] border-[#1F2720] shadow-[6px_6px_0px_0px_#1F2720] min-h-[220px] flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-['Manrope'] text-[10px] text-[#1F2720] font-black uppercase tracking-widest bg-[#e6e8ea] px-2 py-1 rounded-md border-2 border-[#1F2720]">
                            Progress Log
                          </span>
                          <span className={`font-['Manrope'] text-[10px] font-black uppercase px-2.5 py-1 rounded-md border-2 border-[#1F2720] ${statusClass}`}>
                            {statusText}
                          </span>
                        </div>

                        <div className="mt-5 space-y-3">
                          <div className="flex items-end justify-between">
                            <span className="font-['Manrope'] text-xs font-black uppercase text-slate-500">Completion</span>
                            <span className="font-['Hanken_Grotesk'] text-4xl font-black leading-none tabular-nums text-[#1F2720]">
                              {String(trackPct).padStart(2, "0")}%
                            </span>
                          </div>

                          <div className="h-4 bg-[#e6e8ea] rounded-full overflow-hidden border-[3px] border-[#1F2720] p-0.5">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCompleted
                                  ? "bg-gradient-to-r from-emerald-500 to-green-400"
                                  : isActive
                                  ? "bg-gradient-to-r from-[#f4c400] to-[#fdd400]"
                                  : "bg-slate-300"
                              }`}
                              style={{ width: `${trackPct}%` }}
                            />
                          </div>
                        </div>

                        <p className="font-['Manrope'] text-xs text-slate-500 font-bold mt-4">
                          {isCompleted
                            ? "Trail fully cleared. Review anytime."
                            : isActive
                            ? "You have an active quest in this trail."
                            : "No attempts yet. Ready to begin this trail."}
                        </p>
                      </div>
                    </div>

                    <div className="flex absolute left-4 md:left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#fdd400] border-[3px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] items-center justify-center">
                      <span className="font-['Manrope'] text-[10px] font-black text-[#1F2720]">{index + 1}</span>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

        </div>
      </div>
    </MainPage>
  );
}
