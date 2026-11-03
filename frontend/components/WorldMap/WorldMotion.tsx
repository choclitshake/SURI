"use client";
import { useFrame } from "@react-three/fiber";
import { useWorldReducedMotion } from "./WorldQuality";
export const WORLD_MOTION={time:{value:0},enabled:{value:1}};
export function WorldMotion(){
  const reduced=useWorldReducedMotion();
  useFrame(()=>{WORLD_MOTION.enabled.value=reduced?0:1;WORLD_MOTION.time.value=performance.now()*.001;});
  return null;
}
