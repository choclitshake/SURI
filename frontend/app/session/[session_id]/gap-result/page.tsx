"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle, ShieldAlert, Target } from "lucide-react";
import {
  getSession,
  getStudentProgress,
  getTopicChain,
} from "../../../../lib/api";

const NODE_LABELS: Record<string, string> = {
  QE: "Quadratic Equations",
  FP: "Factoring Polynomials",
  SP: "Special Products / Polynomial Multiplication",
  LE: "Laws of Exponents",
  OI: "Operations on Integers",
  FD: "Fractions & Decimals",
  SLE: "Systems of Linear Equations",
  L2V: "Linear Equations in 2 Variables",
  L1V: "Linear Equations in 1 Variable",
  AE: "Algebraic Expressions & Evaluation",
  RPP: "Ratio, Proportion, Percent",
  RER: "Rational Exponents & Radicals",
  PE: "Polynomial Equations",
  PD: "Polynomial Division",
  PO: "Polynomial Operations",
};

const GAP_RESULT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bree+Serif&family=Nunito:wght@600;700;800;900&display=swap');

  .quest-result {
    min-height: 100vh;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(118px, 14vh, 150px) 22px 34px;
    font-family: "Nunito", sans-serif;
    background: #83c3ff url("/login/results.png") center / cover no-repeat;
    color: #3b1766;
  }

  .quest-result::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 50% 39%, rgba(255, 239, 185, .34), transparent 28%),
      linear-gradient(90deg, rgba(19, 13, 38, .34), transparent 26%, transparent 72%, rgba(31, 15, 44, .24)),
      linear-gradient(180deg, rgba(255, 255, 255, .08), transparent 45%, rgba(43, 29, 40, .2));
    pointer-events: none;
  }

  .quest-result-shell {
    width: min(900px, 100%);
    position: relative;
    z-index: 1;
  }

  .quest-crest {
    position: absolute;
    width: min(560px, 92vw);
    left: 50%;
    top: 0;
    transform: translate(-50%, -57%);
    z-index: 3;
    filter: drop-shadow(0 18px 16px rgba(42, 18, 24, .38));
    pointer-events: none;
  }

  .parchment-frame {
    position: relative;
    padding: 24px;
    border-radius: 32px 28px 34px 30px;
    background:
      linear-gradient(90deg, #70411f 0 18px, transparent 18px calc(100% - 18px), #70411f calc(100% - 18px)),
      linear-gradient(180deg, #8b5527 0 18px, transparent 18px calc(100% - 18px), #8b5527 calc(100% - 18px)),
      #70411f;
    box-shadow:
      0 28px 46px rgba(42, 24, 20, .36),
      inset 0 0 0 4px #3b1d13,
      inset 0 0 0 10px rgba(255, 198, 92, .22);
  }

  .parchment-frame::before,
  .parchment-frame::after {
    content: "";
    position: absolute;
    inset: 12px;
    border-radius: 24px;
    pointer-events: none;
  }

  .parchment-frame::before {
    background:
      radial-gradient(circle at 3% 12%, #4a2413 0 16px, transparent 17px),
      radial-gradient(circle at 97% 13%, #4a2413 0 16px, transparent 17px),
      radial-gradient(circle at 4% 91%, #4a2413 0 15px, transparent 16px),
      radial-gradient(circle at 96% 90%, #4a2413 0 15px, transparent 16px);
    opacity: .76;
  }

  .parchment-panel {
    position: relative;
    border-radius: 22px 20px 24px 22px;
    padding: clamp(72px, 9vw, 94px) clamp(22px, 6vw, 62px) clamp(26px, 5vw, 46px);
    background:
      radial-gradient(circle at 18% 24%, rgba(255, 255, 255, .34), transparent 26%),
      radial-gradient(circle at 80% 76%, rgba(174, 102, 34, .12), transparent 31%),
      linear-gradient(135deg, rgba(129, 73, 24, .08) 0 14%, transparent 14% 28%, rgba(129, 73, 24, .06) 28% 42%, transparent 42% 57%, rgba(129, 73, 24, .06) 57% 70%, transparent 70%),
      #f6ddaa;
    box-shadow:
      inset 0 0 0 2px rgba(124, 70, 28, .2),
      inset 0 0 34px rgba(116, 65, 22, .18);
    text-align: center;
    overflow: hidden;
  }

  .parchment-panel::before {
    content: "";
    position: absolute;
    inset: 14px;
    border: 2px solid rgba(111, 61, 28, .13);
    border-radius: 18px;
    pointer-events: none;
  }

  .result-content {
    position: relative;
    z-index: 1;
  }

  .quest-title {
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(34px, 5.1vw, 54px);
    line-height: 0;
    color: #3c126b;
    text-shadow: 0 2px 0 rgba(255, 255, 255, .55);
  }

  .quest-subtitle {
    margin: 12px auto 0;
    max-width: 620px;
    color: #4e3477;
    font-size: clamp(15px, 1.9vw, 20px);
    font-weight: 900;
  }

  .ornament {
    display: flex;
    align-items: center;
    gap: 18px;
    margin: 24px auto 26px;
    max-width: 470px;
    color: #7d36bb;
  }

  .ornament::before,
  .ornament::after {
    content: "";
    height: 2px;
    flex: 1;
    background: linear-gradient(90deg, transparent, currentColor);
    box-shadow: 0 1px 0 rgba(255, 255, 255, .55);
  }

  .ornament::after {
    background: linear-gradient(90deg, currentColor, transparent);
  }

  .ornament span {
    width: 23px;
    height: 23px;
    background: currentColor;
    clip-path: polygon(50% 0, 64% 36%, 100% 50%, 64% 64%, 50% 100%, 36% 64%, 0 50%, 36% 36%);
    filter: drop-shadow(0 1px 0 rgba(255, 255, 255, .7));
  }

  .result-summary {
    margin: 0 auto 20px;
    max-width: 680px;
    padding: 14px 18px;
    border: 2px solid #8749b7;
    border-radius: 15px;
    background: linear-gradient(180deg, rgba(81, 39, 120, .96), rgba(55, 27, 91, .98));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, .15),
      0 3px 0 rgba(72, 31, 94, .44);
    color: #fff8e8;
    font-size: clamp(15px, 1.7vw, 18px);
    font-weight: 900;
  }

  .result-error {
    width: min(680px, 100%);
    margin: 0 auto 18px;
    padding: 12px 14px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    border: 2px solid #bb3d42;
    border-radius: 14px;
    background: rgba(111, 20, 45, .14);
    color: #6f1430;
    text-align: left;
    font-weight: 900;
  }

  .evaluation-card {
    width: min(720px, 100%);
    margin: 0 auto;
    border: 2px solid rgba(124, 70, 28, .32);
    border-radius: 18px;
    background: rgba(255, 248, 232, .72);
    box-shadow: inset 0 0 22px rgba(116, 65, 22, .12);
    overflow: hidden;
  }

  .evaluation-heading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 18px;
    color: #3c126b;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(23px, 3vw, 30px);
    text-align: left;
    border-bottom: 2px solid rgba(124, 70, 28, .22);
  }

  .evaluation-note {
    padding: 0 18px 16px;
    color: #50306c;
    font-size: 16px;
    font-weight: 900;
    text-align: left;
  }

  .node-list {
    display: grid;
    gap: 12px;
    padding: 0 18px 18px;
  }

  .node-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    padding: 14px;
    border: 2px solid #8749b7;
    border-radius: 15px;
    background: rgba(255, 255, 255, .58);
    text-align: left;
  }

  .node-row.is-gap {
    border-color: #6b10d0;
    background: rgba(255, 231, 159, .72);
    box-shadow: 0 0 0 4px rgba(125, 54, 187, .15);
  }

  .node-title {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
  }

  .node-icon {
    margin-top: 2px;
    color: #6b10d0;
    flex: 0 0 auto;
  }

  .node-label {
    color: #3b1766;
    font-size: clamp(16px, 1.8vw, 19px);
    font-weight: 900;
    line-height: 1.16;
  }

  .node-id {
    margin-top: 3px;
    color: #6b5684;
    font-size: 12px;
    font-weight: 900;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 132px;
    min-height: 36px;
    padding: 7px 10px;
    border: 2px solid currentColor;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .status-improved {
    color: #17633a;
    background: #dff5c8;
  }

  .status-needs-work {
    color: #87221f;
    background: #ffd9d4;
  }

  .status-current {
    color: #3b1766;
    background: #ffe79f;
  }

  .status-unchecked {
    color: #5f6470;
    background: #f1f1f3;
  }

  .button-row {
    display: flex;
    gap: 14px;
    width: min(720px, 100%);
    margin: 26px auto 0;
  }

  .quest-button-wrap {
    flex: 1;
    padding: 8px;
    clip-path: polygon(9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%, 0 50%);
    background: linear-gradient(180deg, #ffcf66, #9a541f);
    filter: drop-shadow(0 8px 0 rgba(72, 34, 16, .72));
  }

  .quest-button {
    width: 100%;
    min-height: 62px;
    clip-path: polygon(9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%, 0 50%);
    background:
      linear-gradient(90deg, rgba(255,255,255,.12), transparent 18%, transparent 82%, rgba(255,255,255,.12)),
      linear-gradient(180deg, #9232cc, #58158f 52%, #391071);
    color: #fffaf6;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(20px, 2.4vw, 28px);
    font-weight: 900;
    letter-spacing: 0;
    text-shadow: 0 3px 0 #32104d;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: transform .12s ease, filter .12s ease;
  }

  .quest-button:hover {
    background:
      linear-gradient(90deg, rgba(255,255,255,.18), transparent 18%, transparent 82%, rgba(255,255,255,.18)),
      linear-gradient(180deg, #a940e0, #6c1cab 52%, #451387);
    box-shadow: 0 0 20px rgba(146, 50, 204, .6);
    transform: translateY(-2px);
  }

  .quest-button:active {
    transform: translateY(3px);
  }

  .quest-button.secondary {
    background:
      linear-gradient(90deg, rgba(255,255,255,.2), transparent 18%, transparent 82%, rgba(255,255,255,.2)),
      linear-gradient(180deg, #fff1bc, #f3bd50 54%, #a96525);
    color: #3c126b;
    text-shadow: 0 2px 0 rgba(255, 255, 255, .55);
  }

  .empty-results {
    width: min(680px, 100%);
    margin: 0 auto;
    color: #50306c;
    font-size: 17px;
    font-weight: 900;
  }

  .loading-panel {
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: #83c3ff url("/login/results.png") center / cover no-repeat;
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 5px solid rgba(60, 18, 107, .18);
    border-top-color: #6b10d0;
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 720px) {
    .quest-result {
      min-height: 100svh;
      padding: 112px 12px 18px;
      background-position: center;
    }

    .quest-crest {
      width: min(430px, 94vw);
      transform: translate(-50%, -55%);
    }

    .parchment-frame {
      padding: 14px;
      border-radius: 24px;
    }

    .parchment-panel {
      padding: 58px 15px 24px;
      border-radius: 18px;
    }

    .quest-title {
      font-size: 34px;
    }

    .quest-subtitle,
    .evaluation-note {
      font-size: 15px;
    }

    .node-row {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .status-badge {
      width: 100%;
    }

    .button-row {
      flex-direction: column;
    }

    .quest-button {
      min-height: 58px;
      font-size: 22px;
    }
  }
`;

interface NodeStatusInfo {
  status: string;
  source: string;
}

export default function GapResultPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [chain, setChain] = useState<string[]>([]);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatusInfo>>({});
  const [gapNode, setGapNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const session = await getSession(sessionId);

        const { chain: topicChain } = await getTopicChain(session.topic_entry_node);
        setChain(topicChain);

        const progress = await getStudentProgress(session.student_id);

        const currentSessionProgress =
          progress.active_sessions.find((s) => s.id === sessionId) ||
          progress.completed_sessions?.find((s) => s.id === sessionId);

        const statusesMap: Record<string, NodeStatusInfo> = {};
        if (currentSessionProgress) {
          currentSessionProgress.mastered_nodes.forEach((n) => {
            statusesMap[n.node_id] = { status: "mastered", source: n.source || "" };
          });
          currentSessionProgress.in_progress_nodes.forEach((n) => {
            statusesMap[n.node_id] = { status: "in_progress", source: n.source || "" };
          });
          currentSessionProgress.unresolved_nodes.forEach((n) => {
            statusesMap[n.node_id] = { status: "unresolved", source: n.source || "" };
          });
        }
        setNodeStatuses(statusesMap);

        const storedGapNode = sessionStorage.getItem("identified_node_id") || session.current_node;
        setGapNode(storedGapNode);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load diagnostic results.");
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      loadData();
    }
  }, [sessionId]);

  const handleStartRemediation = () => {
    router.push(`/session/${sessionId}/lesson`);
  };

  const getStatusBadge = (status: string | undefined, isGapNode: boolean) => {
    if (isGapNode) {
      return {
        text: "Start Here",
        className: "status-current",
      };
    }

    switch (status) {
      case "mastered":
        return {
          text: "Improved",
          className: "status-improved",
        };
      case "unresolved":
        return {
          text: "Needs Improvement",
          className: "status-needs-work",
        };
      case "in_progress":
        return {
          text: "Working On It",
          className: "status-current",
        };
      default:
        return {
          text: "Not Checked",
          className: "status-unchecked",
        };
    }
  };

  const allImproved = chain.length > 0 && chain.every((id) => nodeStatuses[id]?.status === "mastered");
  const startNode = allImproved ? null : gapNode;
  const resultSummary = allImproved
    ? "All checked topics improved. No starting gap was found."
    : "Some topics still need improvement. Start with the first topic marked below.";

  if (loading) {
    return (
      <div className="loading-panel" aria-label="Loading diagnostic results">
        <style dangerouslySetInnerHTML={{ __html: GAP_RESULT_CSS }} />
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <main className="quest-result">
      <style dangerouslySetInnerHTML={{ __html: GAP_RESULT_CSS }} />

      <section className="quest-result-shell" aria-labelledby="gap-result-heading">
        

        <div className="parchment-frame">
          <div className="parchment-panel">
            <div className="result-content">
              <h1 id="gap-result-heading" className="quest-title">
                Diagnostic Results
              </h1>
             

              <div className="ornament" aria-hidden="true">
                <span />
              </div>

              <p className="result-summary" data-tutorial-scope="results">{resultSummary}</p>

              {errorMsg && (
                <div className="result-error" role="alert">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {chain.length > 0 ? (
                <div className="evaluation-card">
                  <h2 className="evaluation-heading">
                    <Target className="h-7 w-7" />
                    Path Evaluation
                  </h2>
                  <p className="evaluation-note">
                    Each topic is listed in order. &quot;Improved&quot; means the topic was passed. &quot;Needs Improvement&quot; means the topic still needs review.
                  </p>

                  <div className="node-list">
                    {chain.map((nodeId) => {
                      const label = NODE_LABELS[nodeId] || nodeId;
                      const isGapNode = nodeId === startNode;
                      const status = nodeStatuses[nodeId]?.status;
                      const badge = getStatusBadge(status, isGapNode);

                      return (
                        <div
                          key={nodeId}
                          className={`node-row ${isGapNode ? "is-gap" : ""}`}
                        >
                          <div className="node-title">
                            {status === "mastered" ? (
                              <CheckCircle2 className="node-icon h-6 w-6" />
                            ) : (
                              <Circle className="node-icon h-6 w-6" />
                            )}
                            <div>
                              <h3 className="node-label">{label}</h3>
                      
                            </div>
                          </div>

                          <span className={`status-badge ${badge.className}`}>
                            {badge.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="empty-results">No diagnostic results are available for this session.</p>
              )}

              <div className="button-row">
                {!allImproved && (
                  <div className="quest-button-wrap">
                    <button type="button" onClick={handleStartRemediation} className="quest-button">
                      <span>Start Practice</span>
                      <ArrowRight className="h-6 w-6" />
                    </button>
                  </div>
                )}

                <div className="quest-button-wrap">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className={allImproved ? "quest-button" : "quest-button secondary"}
                  >
                    <span>Dashboard</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
