"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function DashboardContent() {
  const searchParams = useSearchParams();
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (searchParams.get("saved") === "1") {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-white text-black font-sans p-8 max-w-xl mx-auto">
      {showSaved && (
        <div className="border border-black bg-black text-white p-4 mb-6 text-center">
          <p className="font-mono text-sm uppercase tracking-wider">Progress saved</p>
        </div>
      )}
      <header className="border-b border-black pb-4 mb-8">
        <h1 className="text-2xl font-mono font-bold uppercase">Dashboard</h1>
      </header>
      <p className="font-mono text-sm text-gray-700">
        Progress dashboard — placeholder. To be implemented in a later session.
      </p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white text-black font-sans p-8">
        <p className="font-mono text-sm uppercase">Loading...</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
