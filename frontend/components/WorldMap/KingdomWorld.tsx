"use client";

import { memo, Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { CameraCommand } from "@/lib/worldMap/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MeResponse } from "@/lib/api";
import { Landscape } from "./Landscape";
import { MapCamera, CAMERA_POSITION } from "./MapCamera";
import { LandmarkArchitecture } from "./Architecture";
import { LandmarkGlow, type LandmarkFeedback } from "./LandmarkGlow";
import { PROJECTED_LANDMARKS, type DashboardLandmark } from "@/lib/worldMap/landmarkInteraction";
import { sitePosition } from "@/lib/worldMap/landscape";
import styles from "./landmarks.module.css";
import { Ocean } from "@/components/ReferenceVoxel/Ocean";
import { LANDMARK_BOUNDS, LANDMARK_LABEL_LIFT, LANDMARK_SCALE, worldFrame } from "@/lib/worldMap/framing";
import { playableProjectionBounds } from "@/lib/worldMap/worldBounds";
import { configureWorldRenderer } from "@/lib/three/renderer";
import { AfternoonEnvironment } from "./AfternoonEnvironment";
import { AtmosphericClouds } from "./AtmosphericClouds";
import { WorldQuality,detectWorldQuality } from "./WorldQuality";
import { QUALITY } from "@/lib/worldMap/renderQuality";
import { WorldProfiler } from "./WorldProfiler";
import { SceneWarmup } from "./SceneWarmup";

type Point3 = [number, number, number];
// MapCamera owns the original frustum. Adaptive DPR resizes the drawing buffer
// without allowing Fiber to substitute its automatic pixel-sized frustum.
const DASHBOARD_CAMERA={manual:true,position:[...CAMERA_POSITION] as Point3,near:.5,far:650};
const LANDMARK_POSITIONS=Object.fromEntries(["keep","topics","records","champions","calculator"].map(kind=>[kind,sitePosition(kind as DashboardLandmark)])) as Record<DashboardLandmark,Point3>;
const DISABLED_EVENTS=()=>({enabled:false,priority:0});
type LandmarkElements = Partial<Record<DashboardLandmark, HTMLDivElement | null>>;

const DASHBOARD_LANDMARKS: Array<{ kind: DashboardLandmark; title: string; href: string; description: string }> = [
  { kind: "keep", title: "History Logs", href: "/history-logs", description: "Open your History Logs." },
  { kind: "topics", title: "Topics · Learning Grove", href: "/topics", description: "Explore the Learning Grove and choose your next topic." },
  { kind: "records", title: "Playground", href: "/playground", description: "Open your Playground." },
  { kind: "champions", title: "Progress · Hall of Champions", href: "/progress", description: "Track your mastery in the Hall of Champions." },
  { kind: "calculator", title: "Calculator · Arcane Tower", href: "/calculator", description: "Solve equations step by step in the Arcane Tower." },
];

const Landmark=memo(function Landmark({position,kind,feedback}:{position:Point3;kind:DashboardLandmark;feedback:LandmarkFeedback}) {
  return <group position={position} scale={LANDMARK_SCALE}>
    <LandmarkArchitecture kind={kind}/><LandmarkGlow kind={kind} state={feedback}/>
  </group>;
});

type WorldProps = {
  me?: MeResponse;
  progress: { mastered: number; total: number; pct: number; dewdrops: number; rank: string };
  topicProgress: { completed: number; total: number | null };
  command: CameraCommand | null; visible: boolean; labelsVisible: boolean; preserveCameraOnActivate?: boolean; busy: boolean; navigate: (href: string) => void; preloadRoute?: (href: string) => void;
};

type CoastalWorldProps = WorldProps & {
  labelElementsRef: RefObject<LandmarkElements>; hitElementsRef: RefObject<LandmarkElements>; feedback: Record<DashboardLandmark,LandmarkFeedback>; lowPower: boolean; controlsEnabled: boolean; headerInset: number|null;
};

function FrameGate({ active }: { active: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => { if (active) invalidate(); }, [active, invalidate]);
  return null;
}

function LandmarkLabelProjector({ elementsRef,hitElementsRef }: { elementsRef: RefObject<LandmarkElements>;hitElementsRef:RefObject<LandmarkElements> }) {
  const size = useThree(state => state.size);
  const frame = useMemo(() => worldFrame(size.width, size.height, playableProjectionBounds()), [size.width, size.height]);
  const point = useRef(new THREE.Vector3());
  const anchors=useMemo(()=>DASHBOARD_LANDMARKS.map(({kind})=>{
    const root=new THREE.Vector3(...LANDMARK_POSITIONS[kind]).applyAxisAngle(new THREE.Vector3(0,1,0),frame.rotation).multiplyScalar(frame.scale).add(new THREE.Vector3(...frame.position));
    return {kind,root,label:root.clone().add(new THREE.Vector3(0,(LANDMARK_BOUNDS[kind][1]+LANDMARK_LABEL_LIFT)*LANDMARK_SCALE*frame.scale,0))};
  }),[frame]);
  const previous=useRef({world:new THREE.Matrix4(),projection:new THREE.Matrix4(),width:0,height:0,labels:[] as Array<HTMLDivElement|null|undefined>,hits:[] as Array<HTMLDivElement|null|undefined>,ready:false});
  useFrame(({camera})=>{
    const last=previous.current;
    let unchanged=last.ready&&last.width===size.width&&last.height===size.height&&last.world.equals(camera.matrixWorld)&&last.projection.equals(camera.projectionMatrix);
    for(let i=0;i<anchors.length;i++){
      const kind=anchors[i].kind;if(last.labels[i]!==elementsRef.current[kind]||last.hits[i]!==hitElementsRef.current[kind])unchanged=false;
    }
    if(unchanged)return;
    last.ready=true;last.width=size.width;last.height=size.height;last.world.copy(camera.matrixWorld);last.projection.copy(camera.projectionMatrix);
    const ortho=camera as THREE.OrthographicCamera,unit=size.height/(ortho.top-ortho.bottom)*ortho.zoom*frame.scale;
    for(let i=0;i<anchors.length;i++){
      const {kind,root,label}=anchors[i],hit=hitElementsRef.current[kind],element=elementsRef.current[kind];last.labels[i]=element;last.hits[i]=hit;
      if(hit){
        point.current.copy(root).project(camera);const shape=PROJECTED_LANDMARKS[kind];
        hit.style.transform=`translate3d(${((point.current.x*.5+.5)*size.width+shape.minX*unit).toFixed(2)}px,${((-point.current.y*.5+.5)*size.height-shape.maxY*unit).toFixed(2)}px,0)`;
        hit.style.width=`${(shape.width*unit).toFixed(2)}px`;hit.style.height=`${(shape.height*unit).toFixed(2)}px`;hit.style.visibility=point.current.z>=-1?"visible":"hidden";
      }
      if(element){
        point.current.copy(label).project(camera);
        const visible=point.current.z>=-1&&Math.abs(point.current.x)<=1.15&&Math.abs(point.current.y)<=1.15;element.style.visibility=visible?"visible":"hidden";
        if(visible){element.style.setProperty("--label-x",`${(point.current.x*.5+.5)*size.width}px`);element.style.setProperty("--label-y",`${(-point.current.y*.5+.5)*size.height}px`);}
      }
    }
  });

  return null;
}

function CoastalWorld({ command, visible, preserveCameraOnActivate, labelElementsRef, hitElementsRef, feedback, lowPower, controlsEnabled, headerInset }: CoastalWorldProps) {
  const size = useThree(state => state.size);
  const frame = useMemo(() => worldFrame(size.width, size.height, playableProjectionBounds()), [size.height, size.width]);
  return (
    <>
      <AfternoonEnvironment />
      <SceneWarmup/>
      <WorldProfiler/>
      <MapCamera command={command} active={visible&&headerInset!==null} preserveCameraOnActivate={preserveCameraOnActivate} controlsEnabled={controlsEnabled} headerInset={headerInset??0} />
      <LandmarkLabelProjector elementsRef={labelElementsRef} hitElementsRef={hitElementsRef} />
      <group position={frame.position} rotation={[0, frame.rotation, 0]} scale={frame.scale}>
        <AtmosphericClouds />
        <Ocean lowDetail={lowPower} />
        <Landscape lowDetail={lowPower} />

        {DASHBOARD_LANDMARKS.map(({kind})=><Landmark key={kind} position={LANDMARK_POSITIONS[kind]} kind={kind} feedback={feedback[kind]}/>)}
      </group>
    </>
  );
}

function DashboardWorld(props: WorldProps) {
  const [hoveredLandmark, setHoveredLandmark] = useState<DashboardLandmark | null>(null);
  const labelElementsRef = useRef<LandmarkElements>({});
  const hitElementsRef=useRef<LandmarkElements>({});
  const [focusedLandmark,setFocusedLandmark]=useState<DashboardLandmark|null>(null);
  const [pressedLandmark,setPressedLandmark]=useState<DashboardLandmark|null>(null);
  const enabled=props.labelsVisible&&props.visible&&!props.busy;
  const [interactionEnabled,setInteractionEnabled]=useState(enabled);
  if(interactionEnabled!==enabled){setInteractionEnabled(enabled);setHoveredLandmark(null);setFocusedLandmark(null);setPressedLandmark(null);}
  const gesture=useRef({id:-1,x:0,y:0,moved:false});
  const pointers=useRef(new Set<number>());
  useEffect(()=>{
    const release=(event:PointerEvent)=>{pointers.current.delete(event.pointerId);setPressedLandmark(null);};
    const blur=()=>{pointers.current.clear();gesture.current.moved=true;setPressedLandmark(null);setHoveredLandmark(null);};
    window.addEventListener("pointerup",release);window.addEventListener("pointercancel",release);window.addEventListener("blur",blur);
    return()=>{window.removeEventListener("pointerup",release);window.removeEventListener("pointercancel",release);window.removeEventListener("blur",blur);};
  },[]);
  const feedback=Object.fromEntries(DASHBOARD_LANDMARKS.map(({kind})=>[kind,
    props.command?.kind==="island"&&props.command.site===kind?"selected":pressedLandmark===kind?"pressed":focusedLandmark===kind?"focus":hoveredLandmark===kind?"hover":"inactive"
  ])) as Record<DashboardLandmark,LandmarkFeedback>;

  const worldRef = useRef<HTMLDivElement | null>(null);
  const [headerInset, setHeaderInset] = useState<number|null>(null);
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    let header: Element | null = null;
    const measure = () => {
      // Navigation replaces the header while this canvas stays mounted. Ignore
      // missing/hidden bars rather than fitting once at zero and zooming out
      // when the real bar is measured a frame later.
      if(!header?.isConnected)return;
      const rect=header.getBoundingClientRect(),worldRect=world.getBoundingClientRect();
      if(rect.height<1||worldRect.width<2||worldRect.height<2)return;
      setHeaderInset(Math.max(0,Math.round(rect.bottom-worldRect.top)));
    };
    const observer = new ResizeObserver(measure);
    const bindHeader = () => {
      const next = document.querySelector(".suri-app-bar");
      if (next === header) return;
      if (header) observer.unobserve(header);
      header = next;
      if (header) observer.observe(header);
      measure();
    };
    // Route navigation replaces the bar while the dashboard canvas stays mounted.
    const navigationObserver = new MutationObserver(bindHeader);
    navigationObserver.observe(document.body, { childList: true, subtree: true });
    observer.observe(world);
    window.addEventListener("resize", measure);
    bindHeader();
    return () => { observer.disconnect(); navigationObserver.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const [quality]=useState(detectWorldQuality);
  const lowPower=quality!=="high";
  const [showSaved, setShowSaved] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("saved") === "true");
  useEffect(() => {
    if (!showSaved) return;
    const timeout = window.setTimeout(() => setShowSaved(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [showSaved]);
  return (
    <div ref={worldRef} className={`dashboard-world ${styles.world} ${lowPower ? "is-low-power" : ""}`}>
      {showSaved && <div className="world-toast">✦ Progress cataloged in the kingdom archives.</div>}
      <div className={styles.viewport} data-world-viewport
        onPointerDownCapture={event=>{pointers.current.add(event.pointerId);gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,moved:pointers.current.size>1};}}
        onPointerMoveCapture={event=>{const g=gesture.current;if(g.id===event.pointerId&&Math.hypot(event.clientX-g.x,event.clientY-g.y)>6){g.moved=true;setPressedLandmark(null);setHoveredLandmark(null);}}}
        onPointerUpCapture={()=>setPressedLandmark(null)}
        onPointerCancelCapture={()=>{gesture.current.moved=true;setPressedLandmark(null);setHoveredLandmark(null);}}><Canvas
        className="dashboard-canvas"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        frameloop={props.visible ? "demand" : "never"}
        orthographic
        events={DISABLED_EVENTS}
        shadows={false}
        dpr={[1,QUALITY[quality].maxDpr]}
        camera={DASHBOARD_CAMERA}
        gl={{ antialias: quality!=="economy", powerPreference: lowPower ? "low-power" : "high-performance" }}
        onCreated={({ gl }) => configureWorldRenderer(gl)}
      >
        <FrameGate active={props.visible} />
        <WorldQuality tier={quality}><Suspense fallback={null}><CoastalWorld {...props} controlsEnabled={!props.busy} headerInset={headerInset} labelElementsRef={labelElementsRef} hitElementsRef={hitElementsRef} feedback={feedback} lowPower={lowPower} /></Suspense></WorldQuality>
      </Canvas>
        <div className={styles.hitLayer} data-visible={props.labelsVisible&&!props.busy} hidden={!props.visible} aria-hidden="true">
          {DASHBOARD_LANDMARKS.map(({kind,href})=><div key={kind} ref={element=>{hitElementsRef.current[kind]=element;}}
            className={styles.landmarkHit} aria-hidden="true" data-landmark-hit={kind} data-feedback={feedback[kind]}
            style={{visibility:"hidden",clipPath:PROJECTED_LANDMARKS[kind].clip}}
            onPointerEnter={event=>{if(event.pointerType!=="touch"){setHoveredLandmark(kind);props.preloadRoute?.(href);}}}
            onPointerLeave={()=>setHoveredLandmark(null)}
            onPointerDown={()=>{setPressedLandmark(kind);props.preloadRoute?.(href);}}
            onClick={()=>{if(!props.busy&&!gesture.current.moved)props.navigate(href);}}/>) }
        </div>
        {createPortal(<div className={`${styles.labelLayer} ${lowPower ? "is-low-power" : ""}`} data-visible={props.labelsVisible} inert={!props.labelsVisible} hidden={!props.visible} aria-hidden={!props.labelsVisible}>
          {DASHBOARD_LANDMARKS.map(({ kind, title, href, description }) => {
            const subtitle = kind === "records"
              ? "Your creative space"
              : kind === "champions"
                ? `${props.progress.mastered}/${props.progress.total} skills mastered`
                : kind === "topics"
                  ? `${props.topicProgress.completed}${props.topicProgress.total === null ? "" : `/${props.topicProgress.total}`} topics completed`
                  : kind === "keep"
                    ? "Your history archive"
                    : "Step-by-step equation solver";
            const label = title.split(" · ")[0];
            const hovered = hoveredLandmark === kind;
            return <div key={kind} ref={(element) => { labelElementsRef.current[kind] = element; }} className={styles.anchor} data-landmark={kind} data-active={feedback[kind]!=="inactive"} data-feedback={feedback[kind]} style={{ visibility: "hidden" }}>
              <button type="button" data-tutorial={`map-${kind}`} className={`${styles.marker} ${hovered ? styles.markerExpanded : ""}`} aria-label={`${title}: ${subtitle}. ${description}`}
                onClick={() => { if (!props.busy) props.navigate(href); }}
                onMouseEnter={() => { props.preloadRoute?.(href); setHoveredLandmark(kind); }}
                onMouseLeave={() => setHoveredLandmark(null)}
                onFocus={() => { props.preloadRoute?.(href); setFocusedLandmark(kind); }}
                onBlur={() => setFocusedLandmark(null)}
                onPointerDown={()=>setPressedLandmark(kind)}
                onPointerUp={()=>setPressedLandmark(null)}
                onPointerCancel={()=>setPressedLandmark(null)}
                onKeyDown={event=>{
                  const direction=event.key==="ArrowRight"||event.key==="ArrowDown"?1:event.key==="ArrowLeft"||event.key==="ArrowUp"?-1:0;
                  if(direction){event.preventDefault();const index=DASHBOARD_LANDMARKS.findIndex(item=>item.kind===kind),next=DASHBOARD_LANDMARKS[(index+direction+DASHBOARD_LANDMARKS.length)%DASHBOARD_LANDMARKS.length];labelElementsRef.current[next.kind]?.querySelector("button")?.focus();}
                }}>
                <span className={styles.markerHeading}><span className={styles.markerTitle}>{label}</span></span>
                <span className={styles.markerSubtitle}>{subtitle}</span>
                <span className={styles.markerDetail}>{description}</span>
              </button>
            </div>;
          })}
        </div>, document.body)}
      </div>
    </div>
  );
}


export default memo(DashboardWorld);

