"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { clearLearningData, ensureLearningData, getLearningSnapshot, getServerLearningSnapshot, staleLearningData, subscribeLearningData } from "@/lib/learningData";
import { ISLAND_ROUTES, TOPICS_APPROACH_DURATION, type CameraCommand, type IslandRoute } from "@/lib/worldMap/navigation";
import DashboardWorldBoundary from "@/components/WorldMap/DashboardWorldBoundary";
import TutorialProvider from "@/components/tutorial/TutorialProvider";

const loadWorld = () => import("@/components/WorldMap/KingdomWorld");
const loadTopicsWorld = () => import("@/components/WorldMap/TopicsLibraryWorld");
const loadProgressWorld = () => import("@/components/WorldMap/ProgressTrailWorld");
const loadCalculatorWorld = () => import("@/components/WorldMap/CalculatorTowerWorld");
const loadTopicCarousel = () => import("@/components/TopicBookCarousel");
const DashboardWorld = dynamic(loadWorld, {
  ssr: false,
  loading: () => <div className="world-loading" role="status"><span className="world-loader" aria-hidden="true" /><span>Preparing your learning kingdom…</span></div>,
});
const TopicsLibraryWorld = dynamic(loadTopicsWorld, { ssr: false });
const ProgressTrailWorld = dynamic(loadProgressWorld, { ssr: false });
const CalculatorTowerWorld = dynamic(loadCalculatorWorld, { ssr: false });

const managedRoutes = ["/dashboard", ...Object.keys(ISLAND_ROUTES)];
const FOCUSED_ROUTE_KEYS = ["topics", "progress", "calculator", "playground", "history"] as const;
type FocusedRouteKey = typeof FOCUSED_ROUTE_KEYS[number];
type FocusedTransition = "idle" | "entering" | "revealing" | "visible" | "leaving" | "zooming-out";
type FocusedTransitionMap = Record<FocusedRouteKey, FocusedTransition>;
type FocusedWorldMap = Record<FocusedRouteKey, boolean>;

// Every close-up route uses this same handoff: the dashboard camera finishes its
// approach, the matching retained island takes over, then foreground content fades
// in. Keeping the route specifics here prevents each page from inventing its own
// version of the transition.
const FOCUSED_ROUTES = {
  "/topics": { key: "topics", site: "topics", load: loadTopicsWorld, contentClass: "topic-route-content" },
  "/progress": { key: "progress", site: "champions", load: loadProgressWorld, contentClass: "progress-route-content" },
  "/calculator": { key: "calculator", site: "calculator", load: loadCalculatorWorld, contentClass: "calculator-route-content" },
  "/playground": { key: "playground", site: "records", load: null, contentClass: "playground-route-content" },
  "/history-logs": { key: "history", site: "keep", load: null, contentClass: "history-route-content" },
} as const;

// Route canvases and foreground pages deliberately overlap for a little
// longer so the handoff reads as a single gentle transition.
const TOPICS_WORLD_CROSSFADE_MS = 600;
const TOPICS_CONTENT_EXIT_MS = 660;
const routeModulePreloads = new Map<string, Promise<unknown>>();
const routePrefetches = new Set<string>();
const routeModuleLoaders: Partial<Record<string, () => Promise<unknown>>> = {
  "/dashboard": loadWorld,
  "/topics": () => Promise.all([loadTopicsWorld(), loadTopicCarousel()]),
  "/progress": loadProgressWorld,
  "/calculator": loadCalculatorWorld,
};

function warmRouteModule(href: string) {
  const loader = routeModuleLoaders[href];
  if (!loader) return Promise.resolve();
  const existing = routeModulePreloads.get(href);
  if (existing) return existing;
  const preload = loader().catch((cause: unknown) => {
    routeModulePreloads.delete(href);
    throw cause;
  });
  routeModulePreloads.set(href, preload);
  return preload;
}

function canPrefetchOnIntent() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !connection?.saveData && !connection?.effectiveType?.includes("2g");
}

function routeNeedsCurriculum(pathname: string) {
  return pathname === "/topics" || pathname === "/progress";
}

// Preserve old bookmarks while repurposing the former Error History route.
function navigationDestination(href: string) {
  return href.replace(/^\/error-history(?=[?#]|$)/, "/playground");
}

const NavigationContext = createContext<{
  navigate: (href: string) => void; preloadRoute: (href: string) => void; busy: boolean; error: string | null; clearSession: () => void;
}>({ navigate: () => {}, preloadRoute: () => {}, busy: false, error: null, clearSession: () => {} });

export const useWorldNavigation = () => useContext(NavigationContext);
export function useLearningData() {
  return useSyncExternalStore(subscribeLearningData, getLearningSnapshot, getServerLearningSnapshot);
}

function getFocusedRoute(pathname: string) {
  return FOCUSED_ROUTES[pathname as keyof typeof FOCUSED_ROUTES];
}

function createTransitionMap(pathname: string): FocusedTransitionMap {
  const route = getFocusedRoute(pathname);
  return {
    topics: route?.key === "topics" ? "visible" : "idle",
    progress: route?.key === "progress" ? "visible" : "idle",
    calculator: route?.key === "calculator" ? "visible" : "idle",
    playground: route?.key === "playground" ? "visible" : "idle",
    history: route?.key === "history" ? "visible" : "idle",
  };
}

function createWorldMap(pathname: string): FocusedWorldMap {
  const route = getFocusedRoute(pathname);
  return {
    topics: route?.key === "topics",
    progress: route?.key === "progress",
    calculator: route?.key === "calculator",
    playground: route?.key === "playground",
    history: route?.key === "history",
  };
}

export default function LearningShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const overview = pathname === "/dashboard";
  const managed = managedRoutes.includes(pathname);
  const { data, error: dataError } = useLearningData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState<CameraCommand | null>(null);
  const [focusedTransitions, setFocusedTransitions] = useState<FocusedTransitionMap>(() => createTransitionMap(pathname));
  const [dashboardWorldMounted, setDashboardWorldMounted] = useState(overview);
  const [focusedWorldMounted, setFocusedWorldMounted] = useState<FocusedWorldMap>(() => createWorldMap(pathname));
  const locked = useRef(false);
  const serial = useRef(0);
  const previous = useRef(pathname);
  const transaction = useRef(0);
  const pendingRoute = useRef<string | null>(null);
  const focusedTransitionsRef = useRef(focusedTransitions);
  const revealTimers = useRef<Partial<Record<FocusedRouteKey, number>>>({});

  const preloadRoute = useCallback((href: string, includeScene = false) => {
    href = navigationDestination(href).split("#")[0];
    if (!canPrefetchOnIntent()) return;
    if (!routePrefetches.has(href)) {
      routePrefetches.add(href);
      router.prefetch(href);
    }
    if (includeScene) void warmRouteModule(href).catch(() => {});
    if (routeNeedsCurriculum(href)) void ensureLearningData({ curriculum: true }).catch(() => {});
  }, [router]);

  const setFocusedStage = useCallback((key: FocusedRouteKey, stage: FocusedTransition) => {
    if (focusedTransitionsRef.current[key] === stage) return;
    focusedTransitionsRef.current = { ...focusedTransitionsRef.current, [key]: stage };
    setFocusedTransitions(current => current[key] === stage ? current : { ...current, [key]: stage });
  }, []);
  const resetFocusedStages = useCallback(() => {
    const idle: FocusedTransitionMap = { topics: "idle", progress: "idle", calculator: "idle", playground: "idle", history: "idle" };
    focusedTransitionsRef.current = idle;
    setFocusedTransitions(idle);
  }, []);
  const unlock = useCallback(() => { locked.current = false; setBusy(false); }, []);
  const clearRevealTimers = useCallback(() => {
    FOCUSED_ROUTE_KEYS.forEach(key => {
      const timer = revealTimers.current[key];
      if (timer !== undefined) window.clearTimeout(timer);
    });
    revealTimers.current = {};
  }, []);
  const clearSession = useCallback(() => {
    transaction.current++; clearLearningData(); setCommand(null); pendingRoute.current = null;
    clearRevealTimers(); resetFocusedStages(); unlock();
  }, [clearRevealTimers, resetFocusedStages, unlock]);

  const waitForMotion = useCallback((duration: number) => new Promise<void>(resolve => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { resolve(); return; }
    window.setTimeout(resolve, duration);
  }), []);

  const revealFocusedContent = useCallback((key: FocusedRouteKey) => {
    const route = getFocusedRoute(pathname);
    if (route?.key !== key || focusedTransitionsRef.current[key] !== "entering") return;
    setFocusedStage(key, "revealing");
    const existingTimer = revealTimers.current[key];
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);
    revealTimers.current[key] = window.setTimeout(() => {
      if (focusedTransitionsRef.current[key] !== "revealing") return;
      setFocusedStage(key, "visible");
      unlock();
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : TOPICS_WORLD_CROSSFADE_MS);
  }, [pathname, setFocusedStage, unlock]);

  useEffect(() => {
    const route = getFocusedRoute(pathname);
    if (!route || route.load) return;
    // The static background is ready as soon as the route has painted.
    const frame = window.requestAnimationFrame(() => revealFocusedContent(route.key));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, revealFocusedContent]);

  useEffect(() => () => clearRevealTimers(), [clearRevealTimers]);

  useEffect(() => {
    if (!managed && !pathname.startsWith("/session/")) return;
    void ensureLearningData({ curriculum: routeNeedsCurriculum(pathname) }).catch(() => {});
  }, [managed, pathname]);

  useEffect(() => {
    const focusedRoute = getFocusedRoute(pathname);
    if (!overview && !focusedRoute) return;
    // Delay bookkeeping to the next frame: the active route is rendered from
    // the pathname immediately, while this only records that it should stay
    // mounted after the user leaves it.
    const frame = window.requestAnimationFrame(() => {
      if (overview) {
        setDashboardWorldMounted(true);
        setFocusedWorldMounted(createWorldMap(pathname));
      } else if (focusedRoute) {
        setFocusedWorldMounted(createWorldMap(pathname));
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [overview, pathname]);

  useEffect(() => {
    const refresh = () => {
      if (managed && document.visibilityState === "visible") {
        void ensureLearningData({ curriculum: routeNeedsCurriculum(pathname) }).catch(() => {});
      }
    };
    const change = (event: Event) => {
      if ((event as CustomEvent).detail === "auth") { clearSession(); return; }
      staleLearningData(); refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("suri:data-changed", change);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("suri:data-changed", change); };
  }, [managed, pathname, clearSession]);

  useEffect(() => {
    if (dataError && "status" in dataError && dataError.status === 401 && managed) {
      const frame = window.requestAnimationFrame(() => { clearSession(); router.replace("/login"); });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [dataError, managed, clearSession, router]);

  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (from === pathname) return;
    const requestedHref = pendingRoute.current;
    // Honor the selected destination if cached navigation retains a fragment.
    if (requestedHref?.split("#")[0] === pathname) {
      const requestedHash = requestedHref.includes("#") ? `#${requestedHref.split("#")[1]}` : "";
      if (window.location.hash !== requestedHash) {
        window.history.replaceState(window.history.state, "", requestedHref);
        if (!requestedHash) window.scrollTo(0, 0);
      }
    }
    transaction.current++;
    pendingRoute.current = null;
    if (pathname === "/login" || pathname === "/register" || pathname === "/") {
      // Route state must be cleared before paint so a signed-out page never flashes the retained world.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      clearSession(); return;
    }
    const focusedRoute = getFocusedRoute(pathname);
    if (overview) {
      // The retained dashboard camera resets itself as it becomes visible.
      resetFocusedStages();
      setCommand(null);
      unlock();
    } else if (focusedRoute && focusedTransitionsRef.current[focusedRoute.key] === "entering") {
      // The content remains masked until the focused-island canvas has taken
      // over from the final dashboard camera frame.
      setCommand(null);
    } else {
      // Do not let a completed island command run when the world is paused.
      setCommand(null);
      unlock();
    }
  }, [pathname, overview, clearSession, resetFocusedStages, unlock]);

  const navigate = useCallback((href: string) => {
    href = navigationDestination(href);
    const destinationPath = href.split("#")[0];
    if (locked.current || href === pathname) return;
    if (destinationPath === pathname) { router.push(href); return; }
    locked.current = true; setBusy(true); setError(null);
    const token = ++transaction.current;
    pendingRoute.current = href;
    preloadRoute(href, true);

    const currentFocusedRoute = getFocusedRoute(pathname);
    if (href === "/dashboard" && currentFocusedRoute) {
      // Reverse the arrival in two deliberate phases: remove the route UI
      // first, then reveal the retained dashboard camera already positioned at
      // the matching close-up before it travels back to the overview.
      setFocusedStage(currentFocusedRoute.key, "leaving");
      setDashboardWorldMounted(true);
      const worldReady = loadWorld().then(() => undefined).catch(() => undefined);
      const closeCamera = new Promise<void>(resolve => {
        setCommand({ id: ++serial.current, kind: "island", site: currentFocusedRoute.site, instant: true, onComplete: resolve });
      });
      void Promise.all([worldReady, closeCamera, waitForMotion(TOPICS_CONTENT_EXIT_MS)]).then(() => {
        if (token !== transaction.current) return;
        setFocusedStage(currentFocusedRoute.key, "zooming-out");
        setCommand({
          id: ++serial.current,
          kind: "overview",
          duration: TOPICS_APPROACH_DURATION,
          onComplete: () => { if (token === transaction.current) router.push(href); },
        });
      }).catch(cause => {
        if (token !== transaction.current) return;
        pendingRoute.current = null;
        setFocusedStage(currentFocusedRoute.key, "visible");
        setError(cause instanceof Error ? cause.message : "Unable to return to the kingdom. Please try again.");
        unlock();
      });
      return;
    }

    // Start the destination's expensive scene work during the intentional map
    // zoom. The route is shown only after that critical module is available.
    const destinationFocusedRoute = getFocusedRoute(destinationPath);
    const worldReady = destinationFocusedRoute?.load
      ? destinationFocusedRoute.load().then(() => undefined).catch(() => undefined)
      : Promise.resolve();
    const site = ISLAND_ROUTES[destinationPath as IslandRoute];
    const camera = new Promise<void>(resolve => {
      if (overview && site) setCommand({ id: ++serial.current, kind: "island", site, onComplete: resolve });
      else resolve();
    });
    // Prefetching starts eagerly, but navigation is deliberately gated only by
    // the short camera motion. A slow data request must never turn an island
    // click into a blank or spinner-bound intermediate state.
    if (managedRoutes.includes(destinationPath) && destinationFocusedRoute?.key !== "calculator") {
      const snapshot = getLearningSnapshot().data;
      if (!snapshot || (routeNeedsCurriculum(destinationPath) && !snapshot.curriculumReady)) {
        void ensureLearningData({ curriculum: routeNeedsCurriculum(destinationPath) }).catch(() => {});
      }
    }
    void Promise.all([camera, worldReady]).then(() => {
      if (token !== transaction.current) return;
      if (destinationFocusedRoute) setFocusedStage(destinationFocusedRoute.key, "entering");
      router.push(href);
    }).catch(cause => {
      if (token !== transaction.current) return;
      pendingRoute.current = null;
      if (destinationFocusedRoute) setFocusedStage(destinationFocusedRoute.key, "idle");
      setError(cause instanceof Error ? cause.message : "Unable to open this section. Please try again.");
      if (overview) setCommand({ id: ++serial.current, kind: "overview", onComplete: unlock });
      else unlock();
    });
  }, [pathname, overview, preloadRoute, router, setFocusedStage, unlock, waitForMotion]);

  const progress = useMemo(() => {
    const active = data?.progress.active_sessions ?? [], completed = data?.progress.completed_sessions ?? [];
    const sessions = [...active, ...completed];
    const mastered = sessions.reduce((sum, s) => sum + s.mastered_count, 0), total = sessions.reduce((sum, s) => sum + s.total_in_chain, 0);
    const pct = total ? Math.round((mastered / total) * 100) : 0;
    const dewdrops = mastered * 10 + completed.length * 50;
    const rank = dewdrops >= 1000 ? "Elder Canopy Sage" : dewdrops >= 600 ? "Wildwood Ranger" : dewdrops >= 300 ? "Dewdrop Pathfinder" : dewdrops >= 100 ? "Fern Scout" : "Sprout Explorer";
    return { mastered, total, pct, dewdrops, rank };
  }, [data?.progress]);
  const topicProgress = useMemo(() => {
    const completedTopics = new Set((data?.progress.completed_sessions ?? []).map(session => session.topic_entry_node));
    const topics = data?.topics ?? [];
    return {
      completed: data?.curriculumReady ? topics.filter(topic => completedTopics.has(topic.node_id)).length : completedTopics.size,
      total: data?.curriculumReady ? topics.length : null,
    };
  }, [data?.progress.completed_sessions, data?.topics, data?.curriculumReady]);
  const context = useMemo(() => ({ navigate, preloadRoute, busy, error: error ?? dataError?.message ?? null, clearSession }), [navigate, preloadRoute, busy, error, dataError, clearSession]);
  const preloadDashboardRoute = useCallback((href: string) => preloadRoute(href, true), [preloadRoute]);
  const focusedTransition = FOCUSED_ROUTE_KEYS.map(key => focusedTransitions[key]).find(stage => stage !== "idle") ?? "idle";
  const dashboardLayerVisible = overview || ["entering", "revealing", "leaving", "zooming-out"].includes(focusedTransition);
  const dashboardActive = overview || ["entering", "leaving", "zooming-out"].includes(focusedTransition);
  const dashboardTransitionClass = focusedTransition === "revealing"
    ? "is-fading-behind-topics"
    : focusedTransition === "leaving"
      ? "is-preparing-topics-return"
      : focusedTransition === "zooming-out"
        ? "is-returning-from-topics"
        : "";
  const activeFocusedRoute = getFocusedRoute(pathname);
  const contentClass = overview
    ? "dashboard-route-overlay"
    : activeFocusedRoute
      ? `learning-route-content focused-route-content ${activeFocusedRoute.contentClass} ${activeFocusedRoute.key}-transition-${focusedTransitions[activeFocusedRoute.key]}`
      : "learning-route-content";

  return <NavigationContext.Provider value={context}><TutorialProvider userId={data?.me.student_id} identityReady={Boolean(data || dataError)}>
    {(dashboardWorldMounted || overview) && <div className={`dashboard-world-layer ${dashboardTransitionClass}`} aria-hidden={!overview} style={{ visibility: dashboardLayerVisible ? "visible" : "hidden" }}>
      <DashboardWorldBoundary onNavigate={navigate} resetKey={pathname}>
        <DashboardWorld visible={dashboardActive} labelsVisible={overview && !busy} preserveCameraOnActivate={!overview && focusedTransition !== "idle"} command={command} navigate={navigate} preloadRoute={preloadDashboardRoute} busy={busy}
          me={data?.me} progress={progress} topicProgress={topicProgress} />
      </DashboardWorldBoundary>
    </div>}
    {(focusedWorldMounted.topics || pathname === "/topics") && <div className={`topics-world-shell topics-transition-${focusedTransitions.topics}`} aria-hidden={pathname !== "/topics"} style={{ visibility: pathname === "/topics" ? "visible" : "hidden" }}>
      <TopicsLibraryWorld active={pathname === "/topics"} onReady={() => revealFocusedContent("topics")} />
    </div>}
    {(focusedWorldMounted.progress || pathname === "/progress") && <div className={`progress-world-shell progress-transition-${focusedTransitions.progress}`} aria-hidden={pathname !== "/progress"} style={{ visibility: pathname === "/progress" ? "visible" : "hidden" }}>
      <ProgressTrailWorld active={pathname === "/progress"} onReady={() => revealFocusedContent("progress")} />
    </div>}
    {(focusedWorldMounted.calculator || pathname === "/calculator") && <div className={`calculator-world-shell calculator-transition-${focusedTransitions.calculator}`} aria-hidden={pathname !== "/calculator"} style={{ visibility: pathname === "/calculator" ? "visible" : "hidden" }}>
      <CalculatorTowerWorld active={pathname === "/calculator"} onReady={() => revealFocusedContent("calculator")} />
    </div>}
    {(focusedWorldMounted.playground || pathname === "/playground") && <div className={`playground-background-shell playground-transition-${focusedTransitions.playground}`} aria-hidden="true" style={{ visibility: pathname === "/playground" ? "visible" : "hidden" }}>
      <div className="playground-background" />
    </div>}
    {(focusedWorldMounted.history || pathname === "/history-logs") && <div className={`history-background-shell history-transition-${focusedTransitions.history}`} aria-hidden="true" style={{ visibility: pathname === "/history-logs" ? "visible" : "hidden" }}>
      <div className="history-background" />
    </div>}
    <div className={contentClass}>{children}</div>
  </TutorialProvider></NavigationContext.Provider>;
}
