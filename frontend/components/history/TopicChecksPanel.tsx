"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { getHistory, type HistoryLogItem, type TopicPageKey } from "@/lib/api";
import styles from "./history.module.css";

const PAGES: { key: TopicPageKey; numeral: string; label: string }[] = [
  { key: "concept", numeral: "I", label: "Core Concept" },
  { key: "example", numeral: "II", label: "Worked Example" },
  { key: "explanation", numeral: "III", label: "Explanation" },
];

type TopicGroup = {
  nodeId: string;
  label: string;
  pages: Partial<Record<TopicPageKey, boolean>>;
  lastAt: string;
  checkedCount: number;
};

function formatTime(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Items arrive newest first, so the first event seen for a page is its current state.
function groupByTopic(items: HistoryLogItem[]): TopicGroup[] {
  const map = new Map<string, TopicGroup>();
  for (const item of items) {
    if (!item.page_key) continue;
    let group = map.get(item.node_id);
    if (!group) {
      group = { nodeId: item.node_id, label: item.node_label, pages: {}, lastAt: item.logged_at, checkedCount: 0 };
      map.set(item.node_id, group);
    }
    if (item.logged_at > group.lastAt) group.lastAt = item.logged_at;
    if (group.pages[item.page_key] === undefined) group.pages[item.page_key] = !!item.checked;
  }
  const groups = [...map.values()];
  for (const group of groups) group.checkedCount = PAGES.filter(page => group.pages[page.key]).length;
  return groups
    .filter(group => group.checkedCount > 0)
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

export default function TopicChecksPanel() {
  const [items, setItems] = useState<HistoryLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const all: HistoryLogItem[] = [];
      let offset: number | null = 0;
      let guard = 0;
      while (offset !== null && guard++ < 40) {
        const page = await getHistory({ kind: "topic_check", limit: 50, offset });
        if (cancelled) return;
        all.push(...page.items);
        offset = page.next_offset;
      }
      if (!cancelled) setItems(all);
    })()
      .catch(() => { if (!cancelled) setError("Page checks could not be loaded. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);

  const groups = useMemo(() => groupByTopic(items), [items]);

  return (
    <>
      <div className={styles.panelHead}>
        <h2>Page checks</h2>
        {!loading && !error && <span className={styles.count}>{groups.length} {groups.length === 1 ? "topic" : "topics"}</span>}
      </div>

      {loading ? <p className={styles.empty} role="status">Loading history…</p>
        : error ? (
          <>
            <p className={styles.error} role="alert">{error}</p>
            <div className={styles.more}><button type="button" onClick={() => setAttempt(n => n + 1)}>Retry</button></div>
          </>
        ) : groups.length === 0 ? (
          <div className={styles.empty}>
            <strong>No pages checked yet.</strong>
            <p>Check off a lesson page to see it here, grouped by topic.</p>
          </div>
        ) : (
          <ol className={styles.list}>
            {groups.map(group => (
              <li key={group.nodeId} className={styles.topicCard}>
                <div className={styles.topicHead}>
                  <strong>{group.label}</strong>
                  <span className={styles.badge} data-status={group.checkedCount === PAGES.length ? "good" : "neutral"}>
                    {group.checkedCount}/{PAGES.length} checked
                  </span>
                </div>
                <ul className={styles.pageChips} aria-label={`Pages for ${group.label}`}>
                  {PAGES.map(page => {
                    const checked = !!group.pages[page.key];
                    return (
                      <li key={page.key} className={styles.pageChip} data-checked={checked}>
                        <span className={styles.chipMark} aria-hidden="true">{checked ? <Check size={14} /> : null}</span>
                        <span><b>Page {page.numeral}</b> · {page.label}</span>
                        <span className={styles.srOnly}>{checked ? "checked" : "not checked"}</span>
                      </li>
                    );
                  })}
                </ul>
                <time className={styles.topicTime} dateTime={group.lastAt}>Last activity · {formatTime(group.lastAt)}</time>
              </li>
            ))}
          </ol>
        )}
    </>
  );
}