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
      <header className="border-b border-black pb-4 mb-8">
        <h1 className="text-2xl font-mono font-bold uppercase">Error History</h1>
      </header>

      {errorMsg && (
        <div className="mb-6 border border-black p-4 text-sm font-mono text-red-600">
          [ERROR] {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : misconceptions.length === 0 ? (
        <div className="border border-black p-6 text-center">
          <p className="font-mono text-sm text-gray-600">No errors logged yet.</p>
        </div>
      ) : (
        <div className="border border-black divide-y divide-black">
          {misconceptions.map((item, idx) => (
            <div
              key={`${item.node_id}-${item.logged_at}-${idx}`}
              className="p-4 flex justify-between gap-4"
            >
              <div>
                <p className="font-mono text-sm font-bold">{item.node_label}</p>
                <p className="font-mono text-xs text-gray-700 mt-1">{item.step_description}</p>
              </div>
              <p className="font-mono text-xs text-gray-500 whitespace-nowrap">
                {formatDate(item.logged_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </MainPage>
  );
}

export default function ErrorHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ErrorHistoryContent />
    </Suspense>
  );
}
