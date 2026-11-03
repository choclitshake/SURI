"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, Compass, X } from "lucide-react";
import { emptyTutorialPreferences, parseTutorialPreferences, tutorialForPage, tutorialIsPending, tutorialStorageKey, type Tutorial, type TutorialPreferences } from "@/lib/tutorials";
import { positionTutorialCard } from "@/lib/tutorialLayout";
import styles from "./tutorial.module.css";

type TutorialContextValue = { available: boolean; active: boolean; replay: () => void; isPending: (id: string) => boolean };
const TutorialContext = createContext<TutorialContextValue>({ available: false, active: false, replay: () => {}, isPending: () => false });
export const useTutorial = () => useContext(TutorialContext);

export function TutorialButton() {
  const { available, active, replay } = useTutorial();
  if (!available) return null;
  return <button type="button" className="suri-app-control" onClick={replay} disabled={active} aria-label="Replay this page’s tutorial"><Compass className="h-5 w-5" /><span className="suri-app-control-label">Tutorial</span></button>;
}

function visible(element: HTMLElement) {
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
  }
  return element.getClientRects().length > 0;
}
function targets(selector?: string): HTMLElement[] {
  return selector ? [...document.querySelectorAll<HTMLElement>(selector)].filter(visible) : [];
}
type ActiveTutorial = { tour: Tutorial; index: number; path: string };
type Highlight = { x: number; y: number; width: number; height: number };
type Layout = { highlights: Highlight[]; cardX: number; cardY: number; cardWidth: number; viewportWidth: number; viewportHeight: number; maxHeight: number };

export default function TutorialProvider({ userId, identityReady, children }: { userId?: string; identityReady: boolean; children: React.ReactNode }) {
  return <TutorialRuntime userId={userId} identityReady={identityReady}>{children}</TutorialRuntime>;
}

function TutorialRuntime({ userId, identityReady, children }: { userId?: string; identityReady: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const [preferences, setPreferences] = useState<TutorialPreferences>(emptyTutorialPreferences);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loaded = loadedFor === tutorialStorageKey(userId);
  const [available, setAvailable] = useState<Tutorial | null>(null);
  const [active, setActive] = useState<ActiveTutorial | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const seenInMemory = useRef<TutorialPreferences>(emptyTutorialPreferences());
  const enabled = !["/", "/login", "/register"].includes(pathname);
  const current = enabled && active?.path === pathname ? active : null;
  const step = current?.tour.steps[current.index];

  useEffect(() => {
    let saved = emptyTutorialPreferences();
    try { saved = parseTutorialPreferences(localStorage.getItem(tutorialStorageKey(userId))); } catch { /* Private browsing can disable storage. */ }
    seenInMemory.current = saved;
    const frame = requestAnimationFrame(() => { setPreferences(saved); setLoadedFor(tutorialStorageKey(userId)); setActive(null); setLayout(null); });
    return () => cancelAnimationFrame(frame);
  }, [userId]);

  const save = useCallback((next: TutorialPreferences) => {
    seenInMemory.current = next;
    setPreferences(next);
    try { localStorage.setItem(tutorialStorageKey(userId), JSON.stringify(next)); } catch { /* Keep preferences for this session if storage is unavailable. */ }
  }, [userId]);

  const start = useCallback((tour: Tutorial) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Omit optional features that are absent, such as arrows for a single book.
    const steps = tour.steps.filter(item => !item.optional || targets(item.target).length > 0);
    setLayout(null);
    setActive({ tour: { ...tour, steps }, index: 0, path: pathname });
  }, [pathname]);

  // Discover rendered views rather than guessing when data, island transitions, or session phases finish.
  useEffect(() => {
    let queued = 0;
    const scan = () => {
      const scope = document.querySelector<HTMLElement>("[data-tutorial-scope]")?.dataset.tutorialScope;
      const tour = tutorialForPage(pathname, scope);
      const next = tour && targets(tour.ready).length ? tour : null;
      setAvailable(previous => previous?.id === next?.id ? previous : next);
    };
    const schedule = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; scan(); }); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-tutorial-scope", "inert", "hidden", "data-visible"] });
    scan();
    // CSS transitions and projected 3D labels can become visible without DOM mutations.
    const timer = window.setInterval(scan, 500);
    return () => { observer.disconnect(); cancelAnimationFrame(queued); clearInterval(timer); };
  }, [pathname]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (active && (active.path !== pathname || (available && available.id !== active.tour.id))) {
        setActive(null); setLayout(null);
      } else if (!active && loaded && available && userId && !preferences.disabled && !preferences.seen[available.id]) {
        start(available);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active, available, loaded, pathname, preferences, start, userId]);

  const finish = useCallback((status: "completed" | "skipped", disableAll = false) => {
    if (!current) return;
    save({ disabled: disableAll || seenInMemory.current.disabled, seen: { ...seenInMemory.current.seen, [current.tour.id]: status } });
    setActive(null); setLayout(null);
    // Restore keyboard focus without scrolling back to the start of the page.
    requestAnimationFrame(() => { if (openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true }); });
  }, [current, save]);

  const advance = useCallback(() => {
    if (!current) return;
    if (current.index === current.tour.steps.length - 1) { finish("completed"); return; }
    setLayout(null);
    setActive({ ...current, index: current.index + 1 });
  }, [current, finish]);

  const goBack = useCallback(() => {
    if (current && current.index > 0) {
      setLayout(null);
      setActive({ ...current, index: current.index - 1 });
    }
  }, [current]);

  // Highlights are informational: they never intercept input or advance the
  // tour. A missing/disabled control does not prevent Continue or Back.
  useEffect(() => {
    if (!step) return;
    let frame = 0;
    let lastMeasure = 0;
    let lastMapFocus = 0;
    let focusedMap = "";
    let scrolled = "";
    const descriptions = new Map<HTMLElement, string | null>();
    const measure = (time: number) => {
      frame = requestAnimationFrame(measure);
      if (time - lastMeasure < 50) return;
      lastMeasure = time;
      const visual = window.visualViewport;
      const left = visual?.offsetLeft ?? 0, top = visual?.offsetTop ?? 0;
      const width = visual?.width ?? window.innerWidth;
      const viewportHeight = window.innerHeight;
      const keyboard = targets(".ML__keyboard.is-visible > .MLK__backdrop")[0];
      const height = Math.max(0, Math.min(visual?.height ?? viewportHeight, (keyboard?.getBoundingClientRect().top ?? top + viewportHeight) - top));
      const elements = targets(step.target);
      const element = elements[0];
      const viewportKey = `${left}:${top}:${width}:${height}`;
      const rawTarget = step.target ? document.querySelector<HTMLElement>(step.target) : null;
      if (rawTarget?.dataset.tutorial?.startsWith("map-") && focusedMap !== viewportKey && time - lastMapFocus > 500) {
        lastMapFocus = time;
        window.dispatchEvent(new CustomEvent("suri:tutorial-map-focus", { detail: rawTarget.dataset.tutorial }));
        if (element) focusedMap = viewportKey;
      }
      const position = positionTutorialCard({ left, top, width, height,
        compact: window.matchMedia("(max-width: 1024px), (pointer: coarse)").matches,
        landscape: window.innerWidth > window.innerHeight,
      }, cardRef.current?.offsetHeight ?? 300, element?.getBoundingClientRect());
      if (element && !rawTarget?.dataset.tutorial?.startsWith("map-") && scrolled !== viewportKey) {
        scrolled = viewportKey;
        const rect = element.getBoundingClientRect();
        if (rect.top < top + 12 || rect.bottom > position.cardY - 12) {
          element.scrollIntoView({ block: "center", behavior: "instant" });
          const after = element.getBoundingClientRect();
          if (after.height < position.cardY - top - 36 && after.bottom > position.cardY - 12) {
            window.scrollBy({ top: after.bottom - position.cardY + 24, behavior: "instant" });
          }
        }
      }
      for (const item of elements) {
        if (descriptions.has(item)) continue;
        descriptions.set(item, item.getAttribute("aria-describedby"));
        item.setAttribute("aria-describedby", `${item.getAttribute("aria-describedby") ?? ""} suri-tutorial-description`.trim());
      }
      const highlights = [...elements, ...(keyboard ? [keyboard] : [])].map(item => {
        const rect = item.getBoundingClientRect();
        const x = Math.max(left + 4, rect.left - 6), y = Math.max(top + 4, rect.top - 6);
        return { x, y, width: Math.max(0, Math.min(left + width - x - 4, rect.right - x + 6)), height: Math.max(0, Math.min(viewportHeight - y - 4, rect.bottom - y + 6)) };
      }).filter(rect => rect.width > 0 && rect.height > 0);
      const next = { ...position, highlights, viewportWidth: window.innerWidth, viewportHeight };
      setLayout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    frame = requestAnimationFrame(measure);
    const focus = requestAnimationFrame(() => cardRef.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true }));
    const onKey = (event: KeyboardEvent) => {
      // Escape dismisses only the guide when focus is in it. Other page controls,
      // including math fields and their keyboards, keep their normal behavior.
      if (event.key === "Escape" && cardRef.current?.contains(event.target as Node)) {
        event.preventDefault(); event.stopPropagation(); finish("skipped");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(focus);
      document.removeEventListener("keydown", onKey);
      descriptions.forEach((value, element) => { if (value === null) element.removeAttribute("aria-describedby"); else element.setAttribute("aria-describedby", value); });
    };
  }, [step, finish]);

  const isPending = useCallback((id: string) => tutorialIsPending(id, { identityReady, hasUser: Boolean(userId), loaded, preferences, activeId: current?.tour.id }), [current?.tour.id, identityReady, loaded, preferences, userId]);
  const replay = useCallback(() => { if (available) start(available); }, [available, start]);
  const showFloating = enabled && available && !current && !["/dashboard", "/topics", "/calculator", "/progress", "/playground"].includes(pathname) && !pathname.startsWith("/topics/");

  return <TutorialContext.Provider value={{ available: enabled && Boolean(available), active: Boolean(current), replay, isPending }}>
    {children}
    {showFloating && <button type="button" className={styles.launcher} onClick={replay}><Compass size={18} />Tutorial</button>}
    {current && step && createPortal(<div className={styles.layer} data-tutorial-overlay>
      <svg className={styles.scrim} width="100%" height="100%" aria-hidden="true">
        <defs><mask id="suri-tutorial-mask"><rect width="100%" height="100%" fill="white" />{layout?.highlights.map((rect, index) => <rect key={index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="black" rx="8" />)}</mask></defs>
        <rect width="100%" height="100%" fill="rgba(9, 15, 20, .78)" mask="url(#suri-tutorial-mask)" />
      </svg>
      {layout?.highlights.map((rect, index) => <div key={index} className={styles.spotlight} style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} />)}
      <div ref={cardRef} data-tutorial-dialog role="dialog" aria-modal="false" aria-labelledby="suri-tutorial-title" aria-describedby="suri-tutorial-description" className={styles.card} style={{ left: layout?.cardX ?? "50%", top: layout?.cardY ?? "50%", width: layout?.cardWidth, maxHeight: layout?.maxHeight, visibility: layout ? "visible" : "hidden" }}>
        <header className={styles.header}><span><BookOpen size={15} />SURI&apos;S GUIDE</span><button type="button" onClick={() => finish("skipped")} aria-label="Skip tutorial"><X size={19} /></button></header>
        <div className={styles.progress} role="progressbar" aria-label="Tutorial progress" aria-valuemin={0} aria-valuemax={current.tour.steps.length} aria-valuenow={current.index + 1}><span style={{ width: `${(current.index + 1) / current.tour.steps.length * 100}%` }} /></div>
        <div className={styles.content}>
          <p className={styles.eyebrow}>{current.tour.label} · {current.index + 1} of {current.tour.steps.length}</p>
          <h2 id="suri-tutorial-title" tabIndex={-1}>{step.title}</h2>
          <p id="suri-tutorial-description">{step.description}</p>
        </div>
        <footer className={styles.footer}>
          <button type="button" className={styles.skip} onClick={() => finish("skipped")}>Skip tutorial</button>
          <div className={styles.navigation}>
            {current.index > 0 && <button type="button" className={styles.back} onClick={goBack}><ChevronLeft size={17} />Back</button>}
            <button type="button" className={styles.next} onClick={advance}>{current.index === current.tour.steps.length - 1 ? "Finish" : "Continue"}<ChevronRight size={17} /></button>
          </div>
        </footer>
        {current.index === 0 && <button type="button" className={styles.skipAll} onClick={() => finish("skipped", true)}>Skip all tutorials for this account</button>}
      </div>
    </div>, document.body)}
  </TutorialContext.Provider>;
}
