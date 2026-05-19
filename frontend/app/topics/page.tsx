"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTopics, createSession, TopicInfo } from "../../lib/api";

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks node_id being processed

  useEffect(() => {
    getTopics()
      .then((data) => {
        setTopics(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.detail || "Failed to load topics. Are you logged in?");
        setLoading(false);
      });
  }, []);

  const handleStart = async (nodeId: string, mode: "diagnostic" | "lesson") => {
    setActionLoading(nodeId + "-" + mode);
    setError(null);
    try {
      const session = await createSession({ topic_entry_node: nodeId });
      if (mode === "diagnostic") {
        router.push(`/session/${session.id}/diagnostic`);
      } else {
        router.push(`/session/${session.id}/lesson`);
      }
    } catch (err: any) {
      setError(err.detail || "Failed to create learning session.");
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans p-8 max-w-4xl mx-auto">
      <header className="border-b border-black pb-4 mb-8">
        <h1 className="text-3xl font-mono uppercase tracking-wider">SURI — Mathematics</h1>
        <p className="text-sm mt-1 text-gray-600 font-mono">Available Learning Tracks</p>
      </header>

      {error && (
        <div className="border border-black p-4 mb-6 text-sm font-mono bg-white">
          [ERROR] {error}
        </div>
      )}

      {loading ? (
        <p className="font-mono text-sm">Loading topics...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {topics.map((topic) => {
            const isDiagnosing = actionLoading === topic.node_id + "-diagnostic";
            const isLessoning = actionLoading === topic.node_id + "-lesson";
            const isDisabled = !!actionLoading;

            return (
              <div key={topic.node_id} className="border border-black p-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-mono font-bold uppercase">{topic.label}</h2>
                  <p className="text-xs font-mono text-gray-500 mt-1">
                    Grade {topic.grade} • ID: {topic.node_id}
                  </p>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleStart(topic.node_id, "diagnostic")}
                    disabled={isDisabled}
                    className="flex-1 border border-black py-2 px-4 text-sm font-mono uppercase text-center transition-all bg-white hover:bg-black hover:text-white disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black cursor-pointer"
                  >
                    {isDiagnosing ? "Starting..." : "Take Diagnostic"}
                  </button>
                  <button
                    onClick={() => handleStart(topic.node_id, "lesson")}
                    disabled={isDisabled}
                    className="flex-1 border border-black py-2 px-4 text-sm font-mono uppercase text-center transition-all bg-white hover:bg-black hover:text-white disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-black cursor-pointer"
                  >
                    {isLessoning ? "Starting..." : "Go to Lesson"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
