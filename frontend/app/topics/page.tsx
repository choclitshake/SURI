"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MainPage from "@/components/mainpage";
import TopicBookCarousel, { type CarouselBook } from "@/components/TopicBookCarousel";
import { useLearningData, useWorldNavigation } from "@/components/navigation/LearningShell";
import styles from "./topics.module.css";

export default function TopicsPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { navigate } = useWorldNavigation();
  const { data, error: loadError } = useLearningData();
  const topics = useMemo(() => data?.topics ?? [], [data]);
  const activeTopics = useMemo(() => Object.fromEntries((data?.progress.active_sessions ?? []).map(session => [session.topic_entry_node, session.id])), [data]);
  const completedTopics = useMemo(() => new Set((data?.progress.completed_sessions ?? []).map(session => session.topic_entry_node)), [data]);
  const nodeStatuses = useMemo(() => data?.statuses ?? {}, [data]);
  const topicChains = useMemo(() => data?.chains ?? {}, [data]);
  const loading = !data?.curriculumReady && !loadError;
  const error = loadError?.message ?? null;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [carouselLayout, setCarouselLayout] = useState<{ margin: number; center: number } | null>(null);
  const handlePeakLayout = useCallback((top: number, height: number, center: number) => {
    const margin = height * .025 - top;
    setCarouselLayout(previous => previous !== null && Math.abs(previous.margin - margin) < .5 && Math.abs(previous.center - center) < .5 ? previous : { margin, center });
  }, []);

  const openTopic = useCallback((nodeId: string) => router.push(`/topics/${nodeId}`), [router]);
  const resumeTopic = useCallback((sessionId: string) => router.push(`/session/${sessionId}/lesson`), [router]);
  const carouselBooks = useMemo(() => topics.map((topic, index) => {
    const isActive = topic.node_id in activeTopics;
    const isCompleted = completedTopics.has(topic.node_id);
    const chain = topicChains[topic.node_id] || [];
    const trackTotal = chain.length;
    const trackMastered = chain.filter(node => nodeStatuses[node.node_id] === "mastered").length;
    const mastery = trackTotal > 0 ? Math.round((trackMastered / trackTotal) * 100) : 0;
    const hasProgress = mastery > 0 || isActive;
    const status = mastery === 100 ? "Mastered" : hasProgress ? "In Progress" : "Not Attempted";
    return {
      nodeId: topic.node_id,
      label: topic.label,
      grade: topic.grade,
      ordinal: index + 1,
      mastery,
      status,
      hasProgress,
      completed: isCompleted,
    } satisfies CarouselBook;
  }), [activeTopics, completedTopics, nodeStatuses, topicChains, topics]);
  const defaultSelectedNodeId = carouselBooks.find(book => book.nodeId in activeTopics)?.nodeId ?? carouselBooks[0]?.nodeId ?? null;
  const resolvedSelectedNodeId = selectedNodeId && carouselBooks.some(book => book.nodeId === selectedNodeId)
    ? selectedNodeId
    : defaultSelectedNodeId;
  const selectedIndex = Math.max(0, carouselBooks.findIndex(book => book.nodeId === resolvedSelectedNodeId));
  const selectedBook = carouselBooks[selectedIndex];
  const hasSelectedBook = Boolean(selectedBook);
  useLayoutEffect(() => {
    const page = pageRef.current;
    const nav = page?.closest("main")?.previousElementSibling?.querySelector<HTMLElement>(".suri-app-bar-frame");
    const back = page?.querySelector<HTMLElement>(".topics-library-back");
    const description = page?.querySelector<HTMLElement>(".topics-carousel-focus");
    if (!page || !nav || !back) return;
    const syncSpacing = () => {
      const gap = Math.max(0, back.getBoundingClientRect().top - nav.getBoundingClientRect().bottom);
      page.style.setProperty("--topics-bottom-gap", `${gap}px`);
      page.style.setProperty("--topics-nav-height", `${nav.parentElement?.getBoundingClientRect().height ?? 0}px`);
      if (description) {
        page.style.setProperty("--topics-description-lift", `${description.getBoundingClientRect().height * .625}px`);
      }
    };
    const observer = new ResizeObserver(syncSpacing);
    observer.observe(nav);
    observer.observe(back);
    if (description) observer.observe(description);
    syncSpacing();
    return () => observer.disconnect();
  }, [hasSelectedBook]);
  const moveSelection = (direction: -1 | 1) => {
    if (!carouselBooks.length) return;
    const nextIndex = (selectedIndex + direction + carouselBooks.length) % carouselBooks.length;
    setSelectedNodeId(carouselBooks[nextIndex].nodeId);
  };
  const preloadTopic = useCallback((nodeId?: string) => {
    if (!nodeId) return;
    const sessionId = activeTopics[nodeId];
    router.prefetch(sessionId ? `/session/${sessionId}/lesson` : `/topics/${nodeId}`);
  }, [activeTopics, router]);
  const enterTopic = useCallback((nodeId: string) => {
    const sessionId = activeTopics[nodeId];
    if (sessionId) resumeTopic(sessionId);
    else openTopic(nodeId);
  }, [activeTopics, openTopic, resumeTopic]);
  const handleBookClick = useCallback((index: number) => {
    const book = carouselBooks[index];
    if (!book) return;
    if (book.nodeId === resolvedSelectedNodeId) enterTopic(book.nodeId);
    else setSelectedNodeId(book.nodeId);
  }, [carouselBooks, enterTopic, resolvedSelectedNodeId]);
  const handleBookIntent = useCallback((index: number) => preloadTopic(carouselBooks[index]?.nodeId), [carouselBooks, preloadTopic]);
  return <MainPage immersive>
    <div ref={pageRef} className="topics-library-page">
      <div className="topics-library-back-row">
        <button type="button" className="topics-library-back" onClick={() => navigate("/dashboard")} aria-label="Go back to the previous page"><span aria-hidden="true">←</span> Go back</button>
      </div>
      <header className={`topics-library-header ${styles.contentWidth}`}>
        <div className="topics-library-kicker"><span /> SURI&apos;S SPELLBOOK ARCHIVE <span /></div>
        <h1>Choose Your <em>Spellbook</em></h1>
        <p>Pick a volume to bring it forward, then begin its learning quest.</p>
      </header>

      {error && <div className="topics-library-error" role="alert"><Image src="/suri-snake-sad.png" alt="Sad Suri" width={42} height={42} /><div><strong>The archive lantern has dimmed.</strong><p>{error}</p></div></div>}

      <section className={`topics-carousel-experience ${styles.contentWidth}`} aria-label="Topic volume carousel" style={carouselLayout === null ? undefined : { marginTop: carouselLayout.margin, "--carousel-arrow-center": `${carouselLayout.center}px` } as CSSProperties}>
        {loading ? <div className="topics-library-loading"><i /><p>Consulting the academy catalogue…</p></div> : selectedBook && <>
          <div
            className="topics-carousel-stage"
            role="group"
            aria-roledescription="carousel"
            aria-label={`Spellbooks. Selected: ${selectedBook.label}. Use the left and right arrow keys to choose a volume, and Enter to open it.`}
            tabIndex={0}
            onFocus={() => preloadTopic(selectedBook.nodeId)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                moveSelection(event.key === "ArrowLeft" ? -1 : 1);
              } else if (event.key === "Enter") {
                event.preventDefault();
                enterTopic(selectedBook.nodeId);
              }
            }}
          >
            <button
              type="button"
              className="topics-carousel-side-arrow is-previous"
              onClick={() => moveSelection(-1)}
              onPointerEnter={() => preloadTopic(carouselBooks[(selectedIndex - 1 + carouselBooks.length) % carouselBooks.length]?.nodeId)}
              onFocus={() => preloadTopic(carouselBooks[(selectedIndex - 1 + carouselBooks.length) % carouselBooks.length]?.nodeId)}
              disabled={carouselBooks.length < 2}
              aria-label="Focus previous topic"
            ><ChevronLeft aria-hidden="true" /></button>
            <div className="topics-carousel-viewport">
              <TopicBookCarousel
                books={carouselBooks}
                activeIndex={selectedIndex}
                onBookClick={handleBookClick}
                onBookIntent={handleBookIntent}
                onPeakLayout={handlePeakLayout}
              />
            </div>
            <button
              type="button"
              className="topics-carousel-side-arrow is-next"
              onClick={() => moveSelection(1)}
              onPointerEnter={() => preloadTopic(carouselBooks[(selectedIndex + 1) % carouselBooks.length]?.nodeId)}
              onFocus={() => preloadTopic(carouselBooks[(selectedIndex + 1) % carouselBooks.length]?.nodeId)}
              disabled={carouselBooks.length < 2}
              aria-label="Focus next topic"
            ><ChevronRight aria-hidden="true" /></button>
          </div>

          <article className="topics-carousel-focus isolate rounded-none border-solid" aria-label={`Progress and actions for ${selectedBook.label}`} aria-live="polite">
              <div className="topics-carousel-summary">
                <h2 className="topics-carousel-title">{selectedBook.label}</h2>
                <div className={`topics-carousel-status ${selectedBook.completed ? "is-complete" : selectedBook.hasProgress ? "is-progress" : ""}`}><span>{selectedBook.completed ? "✦" : selectedBook.hasProgress ? "●" : "○"}</span>{selectedBook.status}</div>
              </div>
              <div className="topics-carousel-mastery"><div><span>Mastery</span><b>{String(selectedBook.mastery).padStart(2, "0")}%</b></div><i role="progressbar" aria-label="Topic mastery" aria-valuemin={0} aria-valuemax={100} aria-valuenow={selectedBook.mastery}><em style={{ width: `${selectedBook.mastery}%` }} /></i></div>
              <button type="button" className="topics-carousel-action" onClick={() => enterTopic(selectedBook.nodeId)} onPointerEnter={() => preloadTopic(selectedBook.nodeId)} onFocus={() => preloadTopic(selectedBook.nodeId)}>{selectedBook.nodeId in activeTopics ? "Resume quest" : selectedBook.completed ? "Review again" : "Open volume"}<span aria-hidden="true">→</span></button>
          </article>
        </>}
      </section>
    </div>
  </MainPage>;
}
