"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getMe,
  getStudentProgress,
  getSession,
  createSession,
  ActiveSessionProgress,
  MisconceptionHistoryItem,
} from "../../lib/api";
import "./page.css";

// ── Icons (inline SVG — no extra dep needed) ──────────────────────

const Icon = {
  Home:     () => <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Learn:    () => <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  Practice: () => <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  Progress: () => <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Topics:   () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Settings: () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Collapse: () => <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>,
  Check:    () => <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  Alert:    () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg>,
  Play:     () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>,
  Refresh:  () => <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.86"/></svg>,
  Eye:      () => <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff:  () => <svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Plus:     () => <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
};

// ── Nav items ─────────────────────────────────────────────────────

const NAV = [
  { label: "Dashboard", icon: Icon.Home,     href: "/dashboard" },
  { label: "Topics",    icon: Icon.Topics,   href: "/topics"    },
  { label: "Learn",     icon: Icon.Learn,    href: "/learn"     },
  { label: "Practice",  icon: Icon.Practice, href: "/calculator"},
  { label: "Progress",  icon: Icon.Progress, href: "/progress"  },
];

// ── Helpers ───────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

// ── Sidebar ───────────────────────────────────────────────────────

function Sidebar({
  collapsed,
  onToggle,
  currentPath,
}: {
  collapsed: boolean;
  onToggle: () => void;
  currentPath: string;
}) {
  const router = useRouter();

  return (
    <aside className={`db-sidebar${collapsed ? "" : " is-expanded"}`}>
      {/* Logo */}
      <div className="db-sidebar__logo">
        <img src="/SURI_white.png" alt="SURI" />
      </div>

      {/* Nav */}
      <nav className="db-sidebar__nav">
        {NAV.map(({ label, icon: NavIcon, href }) => (
          <button
            key={href}
            className={`db-nav-btn${currentPath === href ? " active" : ""}`}
            title={collapsed ? label : undefined}
            type="button"
            onClick={() => router.push(href)}
          >
            <NavIcon />
            <span className="db-nav-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="db-sidebar__bottom">
        <button
          className="db-nav-btn db-collapse-btn"
          type="button"
          onClick={onToggle}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <span className="db-collapse-icon"><Icon.Collapse /></span>
          <span className="db-nav-label">Collapse</span>
        </button>
        <button className="db-nav-btn" title="Settings" type="button"
          onClick={() => router.push("/settings")}>
          <Icon.Settings />
          <span className="db-nav-label">Settings</span>
        </button>
        <div className="db-sidebar__avatar" title="My Account">A</div>
      </div>
    </aside>
  );
}

// ── Main dashboard content ────────────────────────────────────────

function DashboardContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading]               = useState(true);
  const [collapsed, setCollapsed]           = useState(true);
  const [name, setName]                     = useState("");
  const [activeSessions, setActiveSessions] = useState<ActiveSessionProgress[]>([]);
  const [completedSessions, setCompletedSessions] = useState<ActiveSessionProgress[]>([]);
  const [misconceptions, setMisconceptions] = useState<MisconceptionHistoryItem[]>([]);
  const [showErrors, setShowErrors]         = useState(false);
  const [showSaved, setShowSaved]           = useState(false);
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("saved") === "true") {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const me       = await getMe();
        setName(me.name);
        const progress = await getStudentProgress(me.student_id);
        setActiveSessions(progress.active_sessions     || []);
        setCompletedSessions(progress.completed_sessions || []);
        setMisconceptions(progress.misconception_history || []);
      } catch (err: unknown) {
        const status = err && typeof err === "object" && "status" in err
          ? (err as { status: number }).status : 0;
        if (status === 401) { router.replace("/login"); return; }
        setErrorMsg(err instanceof Error ? err.message : "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleResume = async (sessionId: string) => {
    try {
      await getSession(sessionId);
      router.push(`/session/${sessionId}/lesson`);
    } catch {
      setErrorMsg("Could not resume session.");
    }
  };

  const handleReviewAgain = async (topicEntryNode: string) => {
    try {
      const s = await createSession({ topic_entry_node: topicEntryNode });
      router.push(`/session/${s.id}/diagnostic`);
    } catch {
      setErrorMsg("Could not create review session.");
    }
  };

  if (loading) {
    return (
      <div className="db-loading">
        <div className="db-spinner" />
      </div>
    );
  }

  return (
    <div className="db-shell">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        currentPath="/dashboard"
      />

      <main className="db-main">
        <div className="db-scroll db-page">

          {/* Toasts */}
          {showSaved && (
            <div className="db-toast success">
              <Icon.Check /> Progress saved successfully.
            </div>
          )}
          {errorMsg && (
            <div className="db-toast error">
              <Icon.Alert /> {errorMsg}
            </div>
          )}

          {/* Header */}
          <div className="db-header">
            <div>
              <h1 className="db-header__title">
                Welcome back, {name || "Student"} 👋
              </h1>
              <p className="db-header__sub">
                Here's your learning progress across all active topics.
              </p>
            </div>
            <button
              className="db-btn db-btn-primary"
              type="button"
              onClick={() => router.push("/topics")}
            >
              <Icon.Plus /> New Topic
            </button>
          </div>

          {/* ── Active Topics ── */}
          <div className="db-section-head">
            <h2 className="db-section-title">Active Topics</h2>
            <span className="db-pill db-pill-active">
              {activeSessions.length} in progress
            </span>
          </div>

          {activeSessions.length === 0 ? (
            <div className="db-empty" style={{ marginBottom: 28 }}>
              <div className="db-empty__icon">📚</div>
              <h3>No active topics yet</h3>
              <p>Pick an Intermediate Algebra topic to start your personalized learning path.</p>
              <button
                className="db-btn db-btn-primary"
                type="button"
                onClick={() => router.push("/topics")}
              >
                <Icon.Plus /> Start a Topic
              </button>
            </div>
          ) : (
            <div className="db-sessions-grid" style={{ marginBottom: 32 }}>
              {activeSessions.map((s) => {
                const pct = parseFloat(String(s.completion_percentage)) || 0;
                return (
                  <div key={s.id} className="db-session-card">
                    <div className="db-session-card__top">
                      <div>
                        <p className="db-session-card__name">{s.topic_label}</p>
                        <p className="db-session-card__node">
                          Now: {s.current_node_label}
                        </p>
                      </div>
                      <span className="db-pill db-pill-active">Active</span>
                    </div>

                    <div className="db-progress-wrap">
                      <div className="db-progress-labels">
                        <span>Progress</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="db-progress-bar">
                        <div className="db-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <p className="db-session-card__stats">
                      {s.mastered_count} of {s.total_in_chain} competencies mastered
                      &nbsp;·&nbsp; {s.diagnostic_count} diagnostic &nbsp;·&nbsp; {s.practice_count} practice
                    </p>

                    <div className="db-session-card__footer">
                      <span />
                      <button
                        className="db-btn db-btn-gold db-btn-sm"
                        type="button"
                        onClick={() => handleResume(s.id)}
                      >
                        <Icon.Play /> Resume
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Completed Topics ── */}
          {completedSessions.length > 0 && (
            <>
              <div className="db-section-head">
                <h2 className="db-section-title">Completed Topics</h2>
                <span className="db-pill db-pill-done">
                  {completedSessions.length} mastered
                </span>
              </div>

              <div className="db-sessions-grid" style={{ marginBottom: 32 }}>
                {completedSessions.map((s) => (
                  <div key={s.id} className="db-session-card is-complete">
                    <div className="db-session-card__top">
                      <div>
                        <p className="db-session-card__name">{s.topic_label}</p>
                        <p className="db-session-card__node">
                          All {s.total_in_chain} competencies mastered
                        </p>
                      </div>
                      <span className="db-pill db-pill-done">Done</span>
                    </div>

                    <div className="db-progress-wrap">
                      <div className="db-progress-labels">
                        <span>Progress</span>
                        <span>100%</span>
                      </div>
                      <div className="db-progress-bar">
                        <div className="db-progress-fill" style={{ width: "100%" }} />
                      </div>
                    </div>

                    <div className="db-session-card__footer">
                      <span className="db-session-card__date">
                        {s.completed_at ? formatDate(s.completed_at) : ""}
                      </span>
                      <button
                        className="db-btn db-btn-ghost db-btn-sm"
                        type="button"
                        onClick={() => handleReviewAgain(s.topic_entry_node)}
                      >
                        <Icon.Refresh /> Review Again
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Error History ── */}
          <div className="db-section-head">
            <h2 className="db-section-title">Error History</h2>
            <button
              className="db-btn db-btn-ghost db-btn-sm"
              type="button"
              onClick={() => setShowErrors((v) => !v)}
            >
              {showErrors ? <><Icon.EyeOff /> Hide</> : <><Icon.Eye /> Show</>}
            </button>
          </div>

          {showErrors && (
            misconceptions.length === 0 ? (
              <div className="db-empty">
                <div className="db-empty__icon">✅</div>
                <h3>No errors logged</h3>
                <p>Keep up the great work — no misconceptions recorded yet.</p>
              </div>
            ) : (
              <div className="db-errors-list">
                {misconceptions.map((item, idx) => (
                  <div
                    key={`${item.node_id}-${item.logged_at}-${idx}`}
                    className="db-error-row"
                  >
                    <div>
                      <p className="db-error-row__node">{item.node_label}</p>
                      <p className="db-error-row__desc">{item.step_description}</p>
                    </div>
                    <p className="db-error-row__date">{formatDate(item.logged_at)}</p>
                  </div>
                ))}
              </div>
            )
          )}

        </div>
      </main>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="db-loading">
          <div className="db-spinner" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}