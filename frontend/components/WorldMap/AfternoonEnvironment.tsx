"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { AFTERNOON_SUN } from "@/lib/worldMap/environment";
import { useEnvironmentTextures } from "./EnvironmentMaterials";

// Three owns these mutable renderer resources. Configure them at the boundary,
// and restore their previous values when this environment unmounts.
function applyDaylight(scene:THREE.Scene,gl:THREE.WebGLRenderer,sky:THREE.Texture){
  const previous={environment:scene.environment,intensity:scene.environmentIntensity,tone:gl.toneMapping,exposure:gl.toneMappingExposure,shadows:gl.shadowMap.enabled};
  scene.environment=sky;scene.environmentIntensity=.28;
  gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.12;gl.shadowMap.enabled=false;
  return()=>{scene.environment=previous.environment;scene.environmentIntensity=previous.intensity;gl.toneMapping=previous.tone;gl.toneMappingExposure=previous.exposure;gl.shadowMap.enabled=previous.shadows;};
}

/** Daylight is shared by the dashboard and retained island close-ups. Static
 * terrain/object shadows are baked; there is no per-frame shadow-map pass.
 */
export function AfternoonEnvironment() {
  const {sky}=useEnvironmentTextures();
  const scene=useThree(state=>state.scene),gl=useThree(state=>state.gl),invalidate=useThree(state=>state.invalidate);
  useEffect(()=>{
    const restore=applyDaylight(scene,gl,sky);
    invalidate();
    return restore;
  },[sky,scene,gl,invalidate]);
  return <>
    <color attach="background" args={["#658faf"]}/>
    <fog attach="fog" args={["#c1d7e5",240,600]}/>
    <ambientLight intensity={.22} color="#e3eafa"/>
    <hemisphereLight args={["#c2d9e6","#7c9060",.86]}/>
    <directionalLight position={[...AFTERNOON_SUN]} intensity={3.2} color="#fff6e5"/>
  </>;
}
