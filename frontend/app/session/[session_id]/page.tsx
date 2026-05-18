"use client";

import { useParams } from "next/navigation";

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.session_id as string;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Session</h1>
      <p className="text-sm">
        Session ID: <code className="font-mono">{sessionId}</code>
      </p>
      <p className="text-sm mt-2">
        Main session page — placeholder. To be implemented in a later session.
      </p>
    </div>
  );
}
