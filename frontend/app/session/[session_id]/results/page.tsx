"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { ArrowRight, CheckCircle2, Circle, ShieldAlert, Target } from "lucide-react";
import {
  decideProgression,
  getSession,
  ProgressionDecision,
  saveProgress,
  simplifyContent,
  updateSession,
} from "../../../../lib/api";

const RESULTS_CSS = `
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
    line-height: 1;
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

  .button-row {
    display: flex;
    gap: 14px;
    width: min(720px, 100%);
    margin: 26px auto 0;
  }

  .button-row.stacked {
    flex-direction: column;
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

  .quest-button:hover:not(:disabled) {
    background:
      linear-gradient(90deg, rgba(255,255,255,.18), transparent 18%, transparent 82%, rgba(255,255,255,.18)),
      linear-gradient(180deg, #a940e0, #6c1cab 52%, #451387);
    box-shadow: 0 0 20px rgba(146, 50, 204, .6);
    transform: translateY(-2px);
  }

  .quest-button:active:not(:disabled) {
    transform: translateY(3px);
  }

  .quest-button:disabled {
    cursor: not-allowed;
    filter: saturate(.45) brightness(.86);
  }

  .quest-button.secondary {
    background:
      linear-gradient(90deg, rgba(255,255,255,.2), transparent 18%, transparent 82%, rgba(255,255,255,.2)),
      linear-gradient(180deg, #fff1bc, #f3bd50 54%, #a96525);
    color: #3c126b;
    text-shadow: 0 2px 0 rgba(255, 255, 255, .55);
  }

  .loading-panel {
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: #83c3ff url("/login/results.png") center / cover no-repeat;
    font-family: "Nunito", sans-serif;
  }

  .loading-card {
    width: min(360px, calc(100% - 32px));
    padding: 24px;
    border: 2px solid #8749b7;
    border-radius: 18px;
    background: rgba(255, 248, 232, .88);
    color: #3b1766;
    font-weight: 900;
    text-align: center;
    box-shadow: 0 16px 32px rgba(42, 24, 20, .28);
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    margin: 0 auto 14px;
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

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [loading, setLoading] = useState(true);
  const [currentNode, setCurrentNode] = useState("");
  const [result, setResult] = useState<ProgressionDecision | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [simplifying, setSimplifying] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const decidedRef = useRef(false);

  useEffect(() => {
    const loadResults = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const session = await getSession(sessionId);
        setCurrentNode(session.current_node);
        const battleId = sessionStorage.getItem(`suri_battle_${sessionId}`);
        const decision = await decideProgression({
          session_id: sessionId,
          node_id: session.current_node,
          battle_id: battleId,
        });
        setResult(decision);
      } catch (err: unknown) {
        console.error(err);
        const message =
          err instanceof Error ? err.message : "Failed to calculate results.";
        const detail =
          err && typeof err === "object" && "detail" in err
            ? String((err as { detail?: string }).detail)
            : message;
        setErrorMsg(detail);
      } finally {
        setLoading(false);
      }
    };

    if (sessionId && !decidedRef.current) {
      decidedRef.current = true;
      loadResults();
    }
  }, [sessionId]);

  useEffect(() => {
    if (result && result.decision === "advance") {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  }, [result]);

  const masteryLabel = result ? `${result.passed_count} out of 5 correct` : "";

  const handleContinue = async () => {
    if (!result?.next_node_id) return;
    setActionLoading(true);
    try {
      await updateSession(sessionId, { current_node: result.next_node_id });
      router.push(`/session/${sessionId}/lesson`);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Failed to update session. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDashboard = () => {
    router.push("/dashboard");
  };

  const handleNavigateToNode = async (nodeId: string) => {
    setActionLoading(true);
    try {
      await updateSession(sessionId, { current_node: nodeId });
      router.push(`/session/${sessionId}/lesson`);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Failed to update session. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewSimplified = async () => {
    setSimplifying(true);
    try {
      await simplifyContent(currentNode);
      router.push(`/session/${sessionId}/lesson`);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Could not load a simpler explanation. Please try again.");
      setSimplifying(false);
    }
  };

  const handleQuit = async () => {
    setActionLoading(true);
    try {
      await saveProgress(sessionId);
      router.push("/dashboard?saved=true");
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Failed to save progress. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || simplifying) {
    return (
      <div className="loading-panel" aria-label={simplifying ? "Loading simpler explanation" : "Calculating results"}>
        <style dangerouslySetInnerHTML={{ __html: RESULTS_CSS }} />
        <div className="loading-card">
          <div className="loading-spinner" />
          <p>{simplifying ? "Getting a simpler explanation..." : "Calculating your results..."}</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !result) {
    return (
      <main className="quest-result">
        <style dangerouslySetInnerHTML={{ __html: RESULTS_CSS }} />
        <section className="quest-result-shell" aria-labelledby="result-error-heading">
          <img
            className="quest-crest"
            src="/login/suri-math-quest-crest.svg"
            alt="SURI Math Quest"
          />
          <div className="parchment-frame">
            <div className="parchment-panel">
              <div className="result-content">
                <h1 id="result-error-heading" className="quest-title">Error</h1>
                <div className="ornament" aria-hidden="true">
                  <span />
                </div>
                <div className="result-error" role="alert">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{errorMsg || "No results available."}</span>
                </div>
                <div className="button-row">
                  <div className="quest-button-wrap">
                    <button
                      type="button"
                      onClick={() => router.push(`/session/${sessionId}/practice`)}
                      className="quest-button"
                    >
                      <span>Back to Practice</span>
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

  const isAdvanceDecision = result.decision === "advance";
  const title = isAdvanceDecision
    ? result.topic_complete
      ? "Topic Complete"
      : "Concept Mastered"
    : "Keep Practicing";
  const resultSummary = isAdvanceDecision
    ? "You met the score needed to move forward."
    : "This topic still needs improvement. Choose how to continue.";
  const statusBadge = isAdvanceDecision
    ? { text: "Improved", className: "status-improved" }
    : { text: "Needs Improvement", className: "status-needs-work" };

  return (
    <main className="quest-result">
      <style dangerouslySetInnerHTML={{ __html: RESULTS_CSS }} />

      <section className="quest-result-shell" aria-labelledby="results-heading">
        <img
          className="quest-crest"
          src="/login/suri-math-quest-crest.svg"
          alt="SURI Math Quest"
        />

        <div className="parchment-frame">
          <div className="parchment-panel">
            <div className="result-content">
              <h1 id="results-heading" className="quest-title">{title}</h1>

              <div className="ornament" aria-hidden="true">
                <span />
              </div>

              <p className="result-summary">{resultSummary}</p>

              {errorMsg && (
                <div className="result-error" role="alert">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="evaluation-card">
                <h2 className="evaluation-heading">
                  <Target className="h-7 w-7" />
                  Result Evaluation
                </h2>
                <p className="evaluation-note">
                  Your practice score is listed below. The next step is based on whether the score passed the topic requirement.
                </p>

                <div className="node-list">
                  <div className="node-row">
                    <div className="node-title">
                      {isAdvanceDecision ? (
                        <CheckCircle2 className="node-icon h-6 w-6" />
                      ) : (
                        <Circle className="node-icon h-6 w-6" />
                      )}
                      <div>
                        <h3 className="node-label">Session Mastery</h3>
                        <p className="node-id">{masteryLabel}</p>
                      </div>
                    </div>
                    <span className={`status-badge ${statusBadge.className}`}>
                      {statusBadge.text}
                    </span>
                  </div>

                  {result.decision === "advance" && !result.topic_complete && (
                    <div className="node-row">
                      <div className="node-title">
                        <ArrowRight className="node-icon h-6 w-6" />
                        <div>
                          <h3 className="node-label">Next Topic</h3>
                          <p className="node-id">{result.next_node_label}</p>
                        </div>
                      </div>
                      <span className="status-badge status-current">Next</span>
                    </div>
                  )}

                  {result.decision !== "advance" && result.go_deeper_available && result.go_deeper_node && (
                    <div className="node-row">
                      <div className="node-title">
                        <ArrowRight className="node-icon h-6 w-6" />
                        <div>
                          <h3 className="node-label">Recommended Review</h3>
                          <p className="node-id">{result.go_deeper_node.node_label}</p>
                        </div>
                      </div>
                      <span className="status-badge status-current">Start Here</span>
                    </div>
                  )}
                </div>
              </div>

              {result.decision === "advance" && result.topic_complete && (
                <div className="button-row">
                  <div className="quest-button-wrap">
                    <button
                      type="button"
                      onClick={() => router.push("/topics")}
                      disabled={actionLoading}
                      className="quest-button"
                    >
                      <span>Choose Next Topic</span>
                      <ArrowRight className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="quest-button-wrap">
                    <button
                      type="button"
                      onClick={handleDashboard}
                      disabled={actionLoading}
                      className="quest-button secondary"
                    >
                      <span>Dashboard</span>
                    </button>
                  </div>
                </div>
              )}

              {result.decision === "advance" && !result.topic_complete && (
                <div className="button-row">
                  <div className="quest-button-wrap">
                    <button
                      type="button"
                      onClick={handleContinue}
                      disabled={actionLoading}
                      className="quest-button"
                    >
                      <span>Continue</span>
                      <ArrowRight className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="quest-button-wrap">
                    <button
                      type="button"
                      onClick={handleDashboard}
                      disabled={actionLoading}
                      className="quest-button secondary"
                    >
                      <span>Dashboard</span>
                    </button>
                  </div>
                </div>
              )}

              {result.decision !== "advance" && (
                <div className="button-row stacked">
                  {result.go_deeper_available && result.go_deeper_node && (
                    <ResultAction
                      title="Review Prerequisite"
                      onAction={() => handleNavigateToNode(result.go_deeper_node!.node_id)}
                      actionLoading={actionLoading}
                    />
                  )}
                  <ResultAction
                    title="Review This Topic"
                    onAction={handleReviewSimplified}
                    actionLoading={actionLoading}
                    secondary
                  />
                  <ResultAction
                    title="Save and Quit"
                    onAction={handleQuit}
                    actionLoading={actionLoading}
                    secondary
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ResultAction({
  title,
  onAction,
  actionLoading,
  secondary = false,
}: {
  title: string;
  onAction: () => void;
  actionLoading: boolean;
  secondary?: boolean;
}) {
  return (
    <div className="quest-button-wrap">
      <button
        type="button"
        onClick={onAction}
        disabled={actionLoading}
        className={`quest-button ${secondary ? "secondary" : ""}`}
      >
        <span>{title}</span>
        <ArrowRight className="h-6 w-6" />
      </button>
    </div>
  );
}
