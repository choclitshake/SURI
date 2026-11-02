"use client";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorldReducedMotion } from "./WorldQuality";
import { useBakedScene } from "./BakedScene";
import { ENVIRONMENT_HIGHLIGHT,HIGHLIGHT_KINDS } from "./EnvironmentHighlight";
import type { DashboardLandmark } from "@/lib/worldMap/landmarkInteraction";
export type LandmarkFeedback="inactive"|"hover"|"focus"|"pressed"|"selected";
const levels:Record<LandmarkFeedback,number>={inactive:0,hover:1,focus:1,pressed:1.2,selected:1.2};
/** Fade the shared environmental circle without outlining or recoloring the building. */
export function LandmarkGlow({kind,state}:{kind:DashboardLandmark;state:LandmarkFeedback}){
  const assets=useBakedScene(),index=HIGHLIGHT_KINDS.indexOf(kind),strength=useRef(0),reduced=useWorldReducedMotion();
  useEffect(()=>{
    const zone=assets.landmarkZones?.[kind];
    if(zone)ENVIRONMENT_HIGHLIGHT.zones.value[index].set(zone.x,zone.z,zone.radius,0);
    return()=>{ENVIRONMENT_HIGHLIGHT.strengths.value[index]=0;};
  },[assets,index,kind]);
  useFrame(({invalidate},delta)=>{
    const target=levels[state];if(target===0&&strength.current===0)return;strength.current=reduced?target:THREE.MathUtils.damp(strength.current,target,10,Math.min(delta,.1));
    if(Math.abs(target-strength.current)<.002)strength.current=target;else invalidate();
    ENVIRONMENT_HIGHLIGHT.strengths.value[index]=strength.current;
  });
  return null;
}
