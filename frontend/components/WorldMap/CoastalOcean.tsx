"use client";

import { memo,useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { AFTERNOON_SUN, ENVIRONMENT_BOUNDS, WATER_LEVEL } from "@/lib/worldMap/environment";
import { CAMERA_POSITION, CAMERA_TARGET, WORLD_ROTATION } from "@/lib/worldMap/framing";
import { OCEAN_FRAGMENT, OCEAN_VERTEX } from "@/lib/worldMap/oceanShader";
import { useEnvironmentTextures } from "./EnvironmentMaterials";
import { useWorldQuality,useWorldReducedMotion } from "./WorldQuality";
import { QUALITY } from "@/lib/worldMap/renderQuality";
import type { ISLANDS } from "@/lib/worldMap/landscape";

const noRaycast:THREE.Mesh["raycast"]=()=>{};
export const CoastalOcean=memo(function CoastalOcean({}:{island?:keyof typeof ISLANDS;lowDetail?:boolean}) {
  const textures=useEnvironmentTextures();
  const invalidate=useThree(state=>state.invalidate),frameloop=useThree(state=>state.frameloop);
  const tier=useWorldQuality(),quality=QUALITY[tier],reduced=useWorldReducedMotion();
  const geometry=useMemo(()=>new THREE.PlaneGeometry(260,220,...quality.waterSegments),[quality]);
  const material=useMemo(()=>{
    const rotation=new THREE.Matrix4().makeRotationY(WORLD_ROTATION).multiply(new THREE.Matrix4().makeRotationX(-Math.PI/2));
    const b=ENVIRONMENT_BOUNDS;
    return new THREE.ShaderMaterial({defines:quality.simpleWater?{LOW_COST_WATER:1}:{},vertexShader:OCEAN_VERTEX,fragmentShader:OCEAN_FRAGMENT,fog:true,
      uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        waterTime:{value:0},coastDepth:{value:textures.coast},waterDetail:{value:textures.water},skyReflection:{value:textures.sky},
        coastBounds:{value:new THREE.Vector4(b.minX,b.minZ,b.maxX-b.minX,b.maxZ-b.minZ)},
        sunDirection:{value:new THREE.Vector3(...AFTERNOON_SUN).normalize()},
        viewDirection:{value:new THREE.Vector3(...CAMERA_POSITION).sub(new THREE.Vector3(...CAMERA_TARGET)).normalize()},
        waterNormalMatrix:{value:new THREE.Matrix3().setFromMatrix4(rotation)},
        deepColor:{value:new THREE.Color("#176287")},shallowColor:{value:new THREE.Color("#61c2c5")},
      }});
  },[textures,quality]);
  useFrame(state=>{material.uniforms.waterTime.value=reduced?0:state.clock.getElapsed();});
  useEffect(()=>{
    if(reduced||frameloop==="never")return;
    let timer:ReturnType<typeof setInterval>|undefined;
    const update=()=>{
      if(timer!==undefined)clearInterval(timer);
      timer=undefined;
      if(!document.hidden)timer=setInterval(invalidate,1000/quality.waterFps);
    };
    update();document.addEventListener("visibilitychange",update);
    return()=>{if(timer!==undefined)clearInterval(timer);document.removeEventListener("visibilitychange",update);};
  },[reduced,frameloop,quality,invalidate]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useEffect(()=>()=>material.dispose(),[material]);
  return <mesh name="coastal-ocean" geometry={geometry} material={material} position={[0,WATER_LEVEL,0]} rotation={[-Math.PI/2,0,0]} raycast={noRaycast}/>;
});
