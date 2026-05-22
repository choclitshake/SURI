"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTopics, TopicInfo, getMe, getStudentProgress, createSession } from "../../lib/api";

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [activeTopics, setActiveTopics] = useState<Record<string, string>>({}); // node_id -> session_id
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
    <div className="min-h-screen bg-white text-black font-sans p-8 max-w-4xl mx-auto">
      <header className="border-b border-black pb-4 mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-mono uppercase tracking-wider">SURI — Mathematics</h1>
          <p className="text-sm mt-1 text-gray-600 font-mono">Available Learning Tracks</p>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="border border-black py-2 px-4 text-xs font-mono uppercase hover:bg-black hover:text-white cursor-pointer"
        >
          Go Back to Dashboard
        </button>
      </header>

      {error && (
        <div className="border border-black p-4 mb-6 text-sm font-mono bg-white text-red-600">
          [ERROR] {error}
        </div>
      )}

      {loading ? (
        <p className="font-mono text-sm">Loading topics...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {topics.map((topic) => {
            const isActive = topic.node_id in activeTopics;
            const isCompleted = completedTopics.has(topic.node_id);

            return (
              <div 
                key={topic.node_id} 
                className={`border border-black p-6 flex flex-col justify-between ${!isActive && !isCompleted ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={() => {
                  if (!isActive && !isCompleted) handleStartTopic(topic.node_id);
                }}
              >
                <div>
                  <h2 className="text-xl font-mono font-bold uppercase">{topic.label}</h2>
                  <p className="text-xs font-mono text-gray-500 mt-1">
                    Grade {topic.grade} • ID: {topic.node_id}
                  </p>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  {isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleResume(activeTopics[topic.node_id]); }}
                      className="flex-1 border border-black py-2 px-4 text-sm font-mono uppercase text-center transition-all bg-black text-white hover:bg-gray-800 cursor-pointer"
                    >
                      Resume
                    </button>
                  )}
                  {isCompleted && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReviewAgain(topic.node_id); }}
                      className="flex-1 border border-black py-2 px-4 text-sm font-mono uppercase text-center transition-all bg-white hover:bg-black hover:text-white cursor-pointer"
                    >
                      Review Again
                    </button>
                  )}
                  {!isActive && !isCompleted && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartTopic(topic.node_id); }}
                      className="flex-1 border border-black py-2 px-4 text-sm font-mono uppercase text-center transition-all bg-white hover:bg-black hover:text-white cursor-pointer"
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
  );
}
