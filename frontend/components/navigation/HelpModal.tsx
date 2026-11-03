"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Calculator, CheckCircle2, ChevronDown, Compass, ListChecks, Map, Sparkles, Target, TrendingUp, X } from "lucide-react";

export type HelpPage = "dashboard" | "topics" | "topic" | "progress" | "calculator";
type HelpSectionId = "guide" | "features";
type HelpItem = { title: string; description: string };
type HelpSection = { id: HelpSectionId; title: string; icon: LucideIcon; items: HelpItem[] };
type HelpContent = { label: string; eyebrow: string; summary: string; icon: LucideIcon; sections: HelpSection[] };

const COMPACT_HELP_QUERY = "(max-width: 1100px), (max-height: 640px)";
const getCompactHelp = () => window.matchMedia(COMPACT_HELP_QUERY).matches;
const getServerCompactHelp = () => false;
function subscribeCompactHelp(onChange: () => void) {
  const media = window.matchMedia(COMPACT_HELP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const HELP_CONTENT: Record<HelpPage, HelpContent> = {
  dashboard: {
    label: "Dashboard", eyebrow: "LEARNING KINGDOM",
    summary: "Choose a learning destination from the map, resume a quest, or open your account from your username.", icon: Map,
    sections: [
      { id: "guide", title: "Explore the map", icon: ListChecks, items: [
        { title: "Choose a landmark", description: "Hover or focus to preview, then select History Logs, Topics, Playground, Progress, or Calculator." },
        { title: "Resume a quest", description: "In Topics, select Resume quest on an active spellbook to continue its lesson." },
        { title: "Return to the map", description: "Select Go back from any destination page." },
      ] },
      { id: "features", title: "Your destinations", icon: Compass, items: [
        { title: "Topics & Progress", description: "Browse learning paths in Topics; check mastery, lessons, and mistakes in Progress." },
        { title: "Calculator", description: "Simplify algebra and follow each explained step." },
        { title: "History Logs", description: "The central castle opens the History Logs page." },
        { title: "Account & audio", description: "Select your username in the main header for account details and logout. Audio is coming soon." },
      ] },
    ],
  },
  topics: {
    label: "Topics", eyebrow: "SPELLBOOK LIBRARY",
    summary: "Browse spellbooks, compare their learning paths, and open or resume a topic.", icon: BookOpen,
    sections: [
      { id: "guide", title: "Choose a spellbook", icon: ListChecks, items: [
        { title: "Browse & focus", description: "Use arrows, numbered selectors, or a book to view a topic’s grade, mastery, and skill count." },
        { title: "Open or resume", description: "Open volume shows the overview; Resume quest continues learning; Review again revisits a completed topic." },
        { title: "Choose your start", description: "On the overview, choose Diagnostic Assessment or Skip to Lessons." },
      ] },
      { id: "features", title: "Book indicators", icon: Target, items: [
        { title: "Select, then enter", description: "Select an unfocused book to bring it forward, then select it again to enter." },
        { title: "Mastery & status", description: "Not Attempted: no progress; In Progress: started; Mastered: all skills in the prerequisite trail are complete." },
        { title: "Active quests", description: "Switch volumes freely; unfinished topics remain available through Resume quest." },
      ] },
    ],
  },
  topic: {
    label: "Topic", eyebrow: "TOPIC OVERVIEW",
    summary: "Review the chapter’s prerequisites, then choose an assessment or go straight to lessons.", icon: BookOpen,
    sections: [
      { id: "guide", title: "Start this chapter", icon: ListChecks, items: [
        { title: "Check the chapter", description: "Read the overview, grade, and numbered prerequisite skills before starting." },
        { title: "Diagnostic Assessment", description: "Select Begin assessment to check earlier skills and find your starting point." },
        { title: "Skip to Lessons", description: "Select Go to lesson to bypass the diagnostic and begin directly." },
      ] },
      { id: "features", title: "Before you begin", icon: Target, items: [
        { title: "Which option?", description: "Take the diagnostic if unsure about earlier skills; skip it to start the lesson immediately." },
        { title: "Empty prerequisite trail", description: "No prerequisite skills are listed here. Either starting option is still available." },
        { title: "Preparing or retrying", description: "Wait while the quest opens. Retry any error, or use Back to Library to return to Topics." },
      ] },
    ],
  },
  progress: {
    label: "Progress", eyebrow: "MASTERY ARCHIVE",
    summary: "Check mastery, choose your next lesson, and learn from recorded mistakes.", icon: TrendingUp,
    sections: [
      { id: "guide", title: "Study & review", icon: ListChecks, items: [
        { title: "Read your mastery", description: "Check Curriculum mastery, grade bars, skill totals, and Quests active." },
        { title: "Find a lesson", description: "Search and filter by Grade, Topic, or Status. Choose Study or Review; Locked skills show a required prerequisite." },
        { title: "Reflect & review", description: "Expand one of five recent mistakes for recovery notes and Review lesson." },
      ] },
      { id: "features", title: "Records & recovery", icon: CheckCircle2, items: [
        { title: "History & mastery", description: "Past mistakes stay recorded after skills improve or lessons are reviewed." },
        { title: "Full history & frequency", description: "Search, filter, or sort loaded records in View full history. Where to focus counts loaded records; Load older records adds more." },
        { title: "Reset, refresh, retry", description: "Reset filters or Show all competencies restores hidden lessons. Use Refresh data or Try again for loading errors." },
      ] },
    ],
  },
  calculator: {
    label: "Calculator", eyebrow: "ALGEBRA WORKSHOP",
    summary: "Simplify an expression and follow the reasoning behind each change.", icon: Calculator,
    sections: [
      { id: "guide", title: "Solve an expression", icon: ListChecks, items: [
        { title: "Type or try an example", description: "Use the math keyboard or choose an example. Examples fill the field and solve automatically." },
        { title: "Show steps", description: "Press Enter or Show steps. Compare Before and Now, then read Why this works." },
        { title: "Read & reset", description: "Check FINAL ANSWER. Reset clears the expression, working, and messages." },
      ] },
      { id: "features", title: "Examples & fixes", icon: Sparkles, items: [
        { title: "Notation & like terms", description: "Use powers, roots, fractions, and parentheses. Try 2x + 3x to see like terms combine into 5x." },
        { title: "No steps or input error?", description: "No steps can mean it is already simplified. For input errors, close parentheses, complete operations, and retry." },
        { title: "Solver unavailable?", description: "Check your connection and retry shortly. Input, examples, and Reset pause while solving." },
      ] },
    ],
  },
};

export function getHelpPage(pathname: string): HelpPage | null {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/topics") return "topics";
  if (pathname.startsWith("/topics/")) return "topic";
  if (pathname === "/progress") return "progress";
  if (pathname === "/calculator") return "calculator";
  return null;
}

export default function HelpModal({ page, opener, onClose }: { page: HelpPage; opener: HTMLElement | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<HelpSectionId>("guide");
  const [expandedItems, setExpandedItems] = useState<Record<HelpSectionId, number>>({ guide: 0, features: 0 });
  const compactHelp = useSyncExternalStore(subscribeCompactHelp, getCompactHelp, getServerCompactHelp);
  const content = HELP_CONTENT[page];
  const PageIcon = content.icon;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], [tabindex='0']")]
        .filter(element => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      opener?.focus();
    };
  }, [onClose, opener]);

  return createPortal(
    <div className="suri-help-overlay" role="presentation" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="suri-help-modal" role="dialog" aria-modal="true" aria-labelledby="suri-help-title" aria-describedby="suri-help-summary">
        <header className="suri-help-header">
          <div className="suri-help-heading"><span className="suri-help-page-icon" aria-hidden="true"><PageIcon size={24} /></span><div><span className="suri-help-eyebrow">{content.eyebrow}</span><h2 id="suri-help-title"><em>{content.label}</em>{" "}<span>Help</span></h2></div></div>
          <button type="button" className="suri-help-close" onClick={onClose} aria-label="Close help"><X size={20} /></button>
        </header>
        <div className="suri-help-content">
          <section className="suri-help-overview" aria-labelledby="suri-help-purpose"><h3 id="suri-help-purpose">At a glance</h3><p id="suri-help-summary">{content.summary}</p></section>
          <nav className="suri-help-section-nav" aria-label="Help sections"><button type="button" aria-pressed={activeSection === "guide"} aria-controls="suri-help-guide" onClick={() => setActiveSection("guide")}><ListChecks size={16} />Quick guide</button><button type="button" aria-pressed={activeSection === "features"} aria-controls="suri-help-features" onClick={() => setActiveSection("features")}><Compass size={16} />What’s here</button></nav>
          <div className="suri-help-guide-grid">
            {content.sections.map(section => {
              const SectionIcon = section.icon;
              const numbered = section.id === "guide";
              const List = numbered ? "ol" : "ul";
              return <section key={section.id} id={`suri-help-${section.id}`} className={`suri-help-card ${numbered ? "is-guide" : "is-features"} ${activeSection === section.id ? "is-active" : ""}`} aria-labelledby={`suri-help-${section.id}-title`}>
                <header className="suri-help-card-heading"><SectionIcon size={20} aria-hidden="true" /><div><span>{numbered ? "Step by step" : "Page features"}</span><h3 id={`suri-help-${section.id}-title`}>{section.title}</h3></div></header>
                <List>{section.items.map((item, index) => {
                  const expanded = !compactHelp || expandedItems[section.id] === index;
                  const descriptionId = `suri-help-${section.id}-item-${index}`;
                  return <li key={item.title}>{numbered ? <span className="suri-help-step" aria-hidden="true">{index + 1}</span> : <CheckCircle2 className="suri-help-feature-check" size={16} aria-hidden="true" />}<div><h4>{compactHelp ? <button type="button" className="suri-help-item-toggle" aria-expanded={expanded} aria-controls={descriptionId} onClick={() => setExpandedItems(current => ({ ...current, [section.id]: current[section.id] === index ? -1 : index }))}><span>{item.title}</span><ChevronDown size={16} aria-hidden="true" /></button> : item.title}</h4><p id={descriptionId} hidden={!expanded}>{item.description}</p></div></li>;
                })}</List>
              </section>;
            })}
          </div>
        </div>
      </div>
    </div>, document.body,
  );
}
