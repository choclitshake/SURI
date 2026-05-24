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
      <div className="space-y-6">

          {/* Bento Grid Header Block */}
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
  
  {/* Main Branding Display Header Card */}
  <div className="lg:col-span-2 bg-[#001a54] rounded-2xl p-6 md:p-8 border border-white/10 shadow-[0_0_30px_rgba(0,26,84,0.4)] relative overflow-hidden flex flex-col justify-between min-h-[160px]">
    
    <div className="flex items-center justify-between mb-4 z-10">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#fdd400] animate-pulse shadow-[0_0_8px_#fdd400]" />
        <span className="font-mono text-xs text-slate-300 font-bold tracking-[0.2em] uppercase">CURRICULUM MODULE</span>
      </div>
      <span className="font-mono text-[10px] text-slate-400 bg-black/30 px-2 py-1 rounded border border-white/5">ACTIVE_DB</span>
    </div>
    
    <div className="z-10">
      <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white font-['Hanken_Grotesk',_sans-serif]">
        Learning <span className="text-[#fdd400] relative inline-block">Tracks</span>
      </h1>
      <p className="font-mono text-xs text-slate-300 mt-2 tracking-wide uppercase">
        Choose a node pathways track to begin diagnostics
      </p>
    </div>
  </div>

            {/* Total Tracks Status Indicator */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_15px_30px_rgba(0,26,84,0.05)] flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="font-mono text-xs text-slate-500 uppercase tracking-wider">TOTAL PATHS</span>
                <span className="text-[10px] font-mono text-[#001a54] bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">TRACKED</span>
              </div>
              <div className="my-3">
                <span className="font-mono text-5xl font-bold text-[#001a54] tracking-tighter">
                  {loading ? "--" : String(topics.length).padStart(2, '0')}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-500">
                Paths structured for your active learning layout.
              </p>
            </div>

            {/* In-Progress Status Indicator */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_15px_30px_rgba(0,26,84,0.05)] flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="font-mono text-xs text-slate-500 uppercase tracking-wider">ACTIVE COURSES</span>
                <span className="text-[10px] font-mono text-slate-600 bg-[#fdd400] px-2.5 py-0.5 rounded-full font-bold">RUNNING</span>
              </div>
              <div className="my-3">
                <span className="font-mono text-5xl font-bold text-[#001a54] tracking-tighter">
                  {loading ? "--" : String(Object.keys(activeTopics).length).padStart(2, '0')}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-500">
                Tracks you are currently processing.
              </p>
            </div>
          </div>

          {/* System Error Notification Banner */}
          {error && (
            <div className="bg-red-50/50 border border-red-200 rounded-2xl p-5 shadow-[0_10px_20px_rgba(239,68,68,0.03)] flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-red-600 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(220,38,38,0.4)]" />
              <div>
                <span className="font-mono text-xs text-red-700 font-bold uppercase tracking-widest block mb-1">[SYSTEM ANOMALY]</span>
                <p className="font-mono text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Grid Layout of Tracks */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 shadow-[0_20_40_rgba(0,26,84,0.03)] flex flex-col items-center justify-center space-y-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                <div className="absolute inset-0 border-4 border-[#001a54] border-t-[#fdd400] rounded-full animate-spin" />
              </div>
              <p className="font-mono text-[10px] text-slate-500 tracking-widest uppercase animate-pulse">Retrieving Curriculum Path data...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {topics.map((topic) => {
                const isActive = topic.node_id in activeTopics;
                const isCompleted = completedTopics.has(topic.node_id);

                return (
                  <div 
                    key={topic.node_id} 
                    className={`bg-white border rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 relative group overflow-hidden ${
                      !isActive && !isCompleted 
                        ? 'border-slate-200 hover:border-[#001a54]/30 cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.02)] hover:shadow-[0_15px_30px_rgba(0,26,84,0.06)]' 
                        : 'border-slate-200 shadow-[0_4px_12px_rgba(0,26,84,0.02)]'
                    }`}
                    onClick={() => {
                      if (!isActive && !isCompleted) handleStartTopic(topic.node_id);
                    }}
                  >
                    {/* Status accent side-tabs */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      isActive 
                        ? 'bg-[#001a54]' 
                        : isCompleted 
                        ? 'bg-[#001a54]' 
                        : 'bg-slate-200 group-hover:bg-[#001a54]/40'
                    } transition-colors`} />

                    <div className="pl-2">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                          TRACK ENTRY CODE
                        </span>
                        {isActive && (
                          <span className="font-mono text-[9px] text-[#001a54] font-bold bg-[#fdd400] px-2 py-0.5 rounded-md uppercase">
                            IN PROGRESS
                          </span>
                        )}
                        {isCompleted && (
                          <span className="font-mono text-[9px] text-white font-bold bg-[#001a54] px-2 py-0.5 rounded-md uppercase">
                            COMPLETED
                          </span>
                        )}
                      </div>

                      <h2 className="text-xl font-bold font-['Hanken_Grotesk',_sans-serif] text-[#001a54] tracking-tight group-hover:text-[#001a54]/85 transition-colors">
                        {topic.label}
                      </h2>
                      
                      <p className="text-xs font-mono text-slate-500 mt-2">
                        Grade {topic.grade} • ID: {topic.node_id}
                      </p>
                    </div>

                    <div className="mt-8 pl-2 flex flex-col sm:flex-row gap-3">
                      {isActive && (
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleResume(activeTopics[topic.node_id]); 
                          }}
                          className="flex-1 bg-[#001a54] text-white hover:bg-[#fdd400] hover:text-black border border-transparent py-2.5 px-4 text-xs font-mono font-bold uppercase rounded-xl tracking-wider text-center transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,26,84,0.1)]"
                        >
                          Resume
                        </button>
                      )}
                      
                      {isCompleted && (
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleReviewAgain(topic.node_id); 
                          }}
                          className="flex-1 bg-white hover:bg-slate-50 text-[#001a54] border border-[#001a54]/20 hover:border-[#001a54] py-2.5 px-4 text-xs font-mono font-bold uppercase rounded-xl tracking-wider text-center transition-all cursor-pointer"
                        >
                          Review Again
                        </button>
                      )}
                      
                      {!isActive && !isCompleted && (
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleStartTopic(topic.node_id); 
                          }}
                          className="flex-1 bg-white hover:bg-slate-50 text-[#001a54] border border-slate-200 hover:border-[#001a54] py-2.5 px-4 text-xs font-mono font-bold uppercase rounded-xl tracking-wider text-center transition-all cursor-pointer"
                        >
                          Start Topic
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

      </div>
    </MainPage>
  );
}