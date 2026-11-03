"use client";
import * as THREE from "three";
import { useEnvironmentTextures } from "./EnvironmentMaterials";
const noRaycast:THREE.Sprite["raycast"]=()=>{};

/** Authored beyond the five hero islands: no sky dome or volumetric pass. */
export function AtmosphericClouds() {
  const {cloud}=useEnvironmentTextures();
  return <group name="coastal-atmosphere">
    <sprite position={[15,9,-62]} scale={[34,14,1]} raycast={noRaycast}>
      <spriteMaterial map={cloud} transparent opacity={.5} depthWrite={false} fog/>
    </sprite>
    <sprite position={[44,9,-53]} scale={[43,17,1]} raycast={noRaycast}>
      <spriteMaterial map={cloud} transparent opacity={.42} depthWrite={false} fog/>
    </sprite>
    <sprite position={[-35,6,48]} scale={[32,12,1]} raycast={noRaycast}>
      <spriteMaterial map={cloud} transparent opacity={.16} depthWrite={false} fog/>
    </sprite>
  </group>;
}
