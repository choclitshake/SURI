"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef,useState } from "react";
import * as THREE from "three";
import { LandmarkArchitecture } from "./Architecture";
import { Landscape, type IslandFocus, type LandscapeFocus } from "./Landscape";
import { Ocean } from "@/components/ReferenceVoxel/Ocean";
import type { LandmarkKind } from "@/lib/worldMap/architecture";
import { LANDMARK_SCALE, WORLD_ROTATION } from "@/lib/worldMap/framing";
import { sitePosition, SITES } from "@/lib/worldMap/landscape";
import { configureWorldRenderer } from "@/lib/three/renderer";
import { FOCUSED_CAMERA_OFFSET, FOCUSED_HALF_HEIGHT, FOCUSED_ZOOM } from "@/lib/worldMap/navigation";
import { WorldQuality,detectWorldQuality } from "./WorldQuality";
import { QUALITY } from "@/lib/worldMap/renderQuality";
import { AfternoonEnvironment } from "./AfternoonEnvironment";

const FOCUSED_ARRIVAL_DURATION = 1.15;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

type FocusedIslandSceneProps = {
  focus: LandscapeFocus;
  landmark: LandmarkKind;
  site: keyof typeof SITES;
};

function FocusedIslandCamera({ site, arrive = true }: Pick<FocusedIslandSceneProps, "site"> & { arrive?: boolean }) {
  const getThree = useThree((state) => state.get);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const elapsed = useRef(0);
  const focal = useMemo(
    () => new THREE.Vector3(...sitePosition(site)).applyAxisAngle(Y_AXIS, WORLD_ROTATION).add(new THREE.Vector3(0, 3.2, 0)),
    [site]
  );
  const distant = useMemo(() => focal.clone().addScaledVector(FOCUSED_CAMERA_OFFSET, 126 / 82), [focal]);
  const close = useMemo(() => focal.clone().add(FOCUSED_CAMERA_OFFSET), [focal]);

  useLayoutEffect(() => {
    const { camera } = getThree();
    camera.position.copy(distant);
    camera.lookAt(focal);
    camera.near = 0.5;
    camera.far = 420;
    if (camera instanceof THREE.OrthographicCamera) {
      camera.left = -FOCUSED_HALF_HEIGHT * size.width / Math.max(size.height, 1);
      camera.right = -camera.left;
      camera.top = FOCUSED_HALF_HEIGHT;
      camera.bottom = -FOCUSED_HALF_HEIGHT;
      camera.zoom = arrive ? 0.84 : FOCUSED_ZOOM;
    }
    camera.position.copy(arrive ? distant : close);
    camera.lookAt(focal);
    elapsed.current = arrive ? 0 : FOCUSED_ARRIVAL_DURATION;
    camera.updateProjectionMatrix();
    invalidate();
  }, [arrive, close, distant, focal, getThree, size, invalidate]);

  useFrame((_, delta) => {
    if (elapsed.current >= FOCUSED_ARRIVAL_DURATION) return;
    elapsed.current = Math.min(elapsed.current + delta, FOCUSED_ARRIVAL_DURATION);
    const t = THREE.MathUtils.smootherstep(elapsed.current / FOCUSED_ARRIVAL_DURATION, 0, 1);
    const { camera } = getThree();
    camera.position.lerpVectors(distant, close, t);
    camera.lookAt(focal);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = THREE.MathUtils.lerp(0.84, FOCUSED_ZOOM, t);
      camera.updateProjectionMatrix();
    }
    if (elapsed.current < FOCUSED_ARRIVAL_DURATION) invalidate();
  });

  return null;
}

export function FocusedIslandScene({ focus, landmark, site, arrive = true }: FocusedIslandSceneProps & { arrive?: boolean }) {
  const position = sitePosition(site);

  return <>
    <AfternoonEnvironment />
    <FocusedIslandCamera site={site} arrive={arrive} />
    <group rotation={[0, WORLD_ROTATION, 0]}>
      <Ocean island={focus.island as IslandFocus} />
      <Landscape focus={focus} />
      <group position={position} scale={LANDMARK_SCALE}><LandmarkArchitecture kind={landmark} /></group>
    </group>
  </>;
}

function FrameGate({ active, onReady }: { active: boolean; onReady?: () => void }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!active) return;
    invalidate();
    const frame = window.requestAnimationFrame(() => onReady?.());
    return () => window.cancelAnimationFrame(frame);
  }, [active, invalidate, onReady]);
  return null;
}

type FocusedIslandWorldProps = FocusedIslandSceneProps & {
  active?: boolean;
  arrive?: boolean;
  className: string;
  onReady?: () => void;
};

/** Shared fullscreen treatment for route-level close-ups of the dashboard islands. */
export default function FocusedIslandWorld({ active = true, arrive = true, className, focus, landmark, site, onReady }: FocusedIslandWorldProps) {
  const [quality]=useState(detectWorldQuality);
  return <div className={className} aria-hidden="true">
    <div className={`${className}-backdrop`}>
      <Canvas frameloop={active ? "demand" : "never"} orthographic shadows={false} dpr={[1, QUALITY[quality].maxDpr]} camera={{ manual:true, position: [82, 82, 82], near: 0.5, far: 420 }} events={()=>({enabled:false,priority:0})} gl={{ antialias: quality!=="economy", powerPreference: quality==="high"?"high-performance":"low-power" }} onCreated={({ gl }) => configureWorldRenderer(gl)}>
        <WorldQuality tier={quality}><FrameGate active={active} onReady={onReady} />
        <FocusedIslandScene focus={focus} landmark={landmark} site={site} arrive={arrive} /></WorldQuality>
      </Canvas>
    </div>
  </div>;
}
