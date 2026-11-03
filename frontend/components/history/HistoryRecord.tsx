"use client";

import { CheckSquare, ClipboardCheck, Swords } from "lucide-react";
import type { HistoryLogItem } from "@/lib/api";
import styles from "./history.module.css";

const PAGE_LABELS = {
  concept: "Page I · Core Concept",
  example: "Page II · Worked Example",
  explanation: "Page III · Explanation",
} as const;

function logTime(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function describe(item: HistoryLogItem) {
  if (item.kind === "quiz") {
    const parts: string[] = [];
    if (item.total_steps) parts.push(`${item.total_correct ?? 0}/${item.total_steps} steps`);
    if (item.score != null) parts.push(`${item.score.toLocaleString()} pts`);
    if (item.passed_count != null) parts.push(`${item.passed_count}/5 problems passed`);
    return {
      Icon: ClipboardCheck,
      title: `Quiz · ${item.node_label}`,
      detail: parts.join(" · "),
      badge: { text: item.passed ? "Passed" : "Needs work", status: item.passed ? "good" : "bad" },
    };
  }
  if (item.kind === "practice") {
    const parts: string[] = [];
    if (item.passed_count != null) parts.push(`${item.passed_count}/5 problems passed`);
    if (item.score != null) parts.push(`${item.score} battle pts`);
    return {
      Icon: Swords,
      title: `Practice · ${item.node_label}`,
      detail: parts.join(" · "),
      badge: { text: item.passed ? "Passed" : "Needs work", status: item.passed ? "good" : "bad" },
    };
  }
  return {
    Icon: CheckSquare,
    title: `${item.checked ? "Checked" : "Unchecked"} · ${item.node_label}`,
    detail: item.page_key ? PAGE_LABELS[item.page_key] : "",
    badge: { text: item.checked ? "Checked" : "Unchecked", status: item.checked ? "good" : "neutral" },
  };
}

export default function HistoryRecord({ item }: { item: HistoryLogItem }) {
  const { Icon, title, detail, badge } = describe(item);
  return (
    <div className={styles.row}>
      <span className={styles.icon}><Icon size={20} aria-hidden="true" /></span>
      <span className={styles.text}>
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
        <time dateTime={item.logged_at}>{logTime(item.logged_at)}</time>
      </span>
      <span className={styles.badge} data-status={badge.status}>{badge.text}</span>
    </div>
  );
}