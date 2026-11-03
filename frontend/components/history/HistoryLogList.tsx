"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CheckSquare, ClipboardCheck, Swords } from "lucide-react";
import HistoryRecord from "./HistoryRecord";
import TopicChecksPanel from "./TopicChecksPanel";
import {
  getHistory, getHistorySummary,
  type HistoryKind, type HistoryLogItem, type HistorySummary,
} from "@/lib/api";
import styles from "./history.module.css";

const TABS: { kind: HistoryKind; label: string; Icon: typeof Swords; emptyTitle: string; emptyHint: string }[] = [
  { kind: "quiz", label: "Quizzes", Icon: ClipboardCheck, emptyTitle: "No quizzes yet.", emptyHint: "Finish a quiz and your results will be recorded here." },
  { kind: "practice", label: "Practice", Icon: Swords, emptyTitle: "No practice rounds yet.", emptyHint: "Complete a practice round to see it here." },
  { kind: "topic_check", label: "Page checks", Icon: CheckSquare, emptyTitle: "No pages checked yet.", emptyHint: "Check off a lesson page to see it here." },
];

export default function HistoryLogList() {
  const [kind, setKind] = useState<HistoryKind>("quiz");
  const [items, setItems] = useState<HistoryLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Summary: one request on mount. If it fails, the strip just doesn't show.
  useEffect(() => {
    let cancelled = false;
    getHistorySummary().then(s => { if (!cancelled) setSummary(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // List: reload from the top whenever the tab changes.
  // Page checks are handled by TopicChecksPanel, which loads its own data.
  useEffect(() => {
    setItems([]);
    setNextOffset(null);
    setError(null);
    if (kind === "topic_check") { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    getHistory({ kind, limit: 20, offset: 0 })
      .then(page => {
        if (cancelled) return;
        setItems(page.items); setTotal(page.total); setNextOffset(page.next_offset);
      })
      .catch(() => { if (!cancelled) setError("History could not be loaded. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind]);

  const loadMore = async () => {
    if (loadingMore || nextOffset === null) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await getHistory({ kind, limit: 20, offset: nextOffset });
      setItems(previous => {
        const seen = new Set(previous.map(item => item.id));
        return [...previous, ...page.items.filter(item => !seen.has(item.id))];
      });
      setNextOffset(page.next_offset);
    } catch {
      setError("Older records could not be loaded. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  // Arrow keys / Home / End move between tabs.
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setKind(TABS[next].kind);
    tabRefs.current[next]?.focus();
  };

  const active = TABS.find(tab => tab.kind === kind) ?? TABS[0];

  return (
    <section className={styles.card} aria-label="History logs">
      {summary && (
        <p className={styles.summary}>
          {summary.quizzes_taken} {summary.quizzes_taken === 1 ? "quiz" : "quizzes"} · {summary.practice_sessions} practice {summary.practice_sessions === 1 ? "round" : "rounds"} · {summary.pages_checked} {summary.pages_checked === 1 ? "page" : "pages"} checked
          {summary.best_quiz_score != null && <> · best quiz {summary.best_quiz_score.toLocaleString()} pts</>}
          {summary.quiz_accuracy != null && <> · {summary.quiz_accuracy}% quiz accuracy</>}
        </p>
      )}

      <div className={styles.tabs} role="tablist" aria-label="History type">
        {TABS.map((tab, index) => {
          const selected = tab.kind === kind;
          return (
            <button
              key={tab.kind}
              ref={element => { tabRefs.current[index] = element; }}
              type="button"
              role="tab"
              id={`history-tab-${tab.kind}`}
              aria-selected={selected}
              aria-controls="history-panel"
              tabIndex={selected ? 0 : -1}
              className={styles.tab}
              data-active={selected}
              onClick={() => setKind(tab.kind)}
              onKeyDown={event => onTabKeyDown(event, index)}
            >
              <tab.Icon size={18} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div id="history-panel" role="tabpanel" aria-labelledby={`history-tab-${kind}`} className={styles.panel}>
        {kind === "topic_check" ? <TopicChecksPanel /> : (
          <>
            <div className={styles.panelHead}>
              <h2>{active.label}</h2>
              {!loading && !error && <span className={styles.count}>{total} {total === 1 ? "entry" : "entries"}</span>}
            </div>

            {loading ? <p className={styles.empty} role="status">Loading history…</p>
              : items.length === 0 && !error ? (
                <div className={styles.empty}>
                  <strong>{active.emptyTitle}</strong>
                  <p>{active.emptyHint}</p>
                </div>
              ) : (
                <ol className={styles.list}>
                  {items.map(item => <li key={item.id}><HistoryRecord item={item} /></li>)}
                </ol>
              )}

            {error && <p className={styles.error} role="alert">{error}</p>}

            {nextOffset !== null && !loading && (
              <div className={styles.more}>
                <button type="button" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? "Loading older records…" : error ? "Retry older records" : "Load older records"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}