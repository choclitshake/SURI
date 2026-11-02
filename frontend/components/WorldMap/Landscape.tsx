"use client";

import { memo,useEffect, useMemo } from "react";
import * as THREE from "three";
import { Architecture, CoastalArchitecture, type ArchitectureClip } from "./Architecture";
import { useBakedScene } from "./BakedScene";
import { ISLANDS } from "@/lib/worldMap/landscape";
import { makeTerrainMaterial, useEnvironmentTextures } from "./EnvironmentMaterials";
import { TraversalNetwork } from "./TraversalNetwork";
import { Harbor } from "./Harbor";
import { WorldMotion } from "./WorldMotion";
import { AmbientWorld } from "./AmbientWorld";
import { recordWorldCommit } from "./WorldProfiler";
const noRaycast: THREE.Mesh["raycast"] = () => {};

export type IslandFocus = keyof typeof ISLANDS;
export type LandscapeFocus = { island: IslandFocus; bounds: ArchitectureClip };

export const Landscape=memo(function Landscape({focus,lowDetail=false}:{focus?:LandscapeFocus;lowDetail?:boolean}) {
  useEffect(()=>recordWorldCommit("landscape"));
  const island=focus?.island;
  const textures=useEnvironmentTextures();
  const material=useMemo(()=>makeTerrainMaterial(textures,lowDetail),[textures,lowDetail]);
  const assets=useBakedScene();
  useEffect(()=>()=>material.dispose(),[material]);
  return <group name="fantasy-archipelago">
    <WorldMotion/>
    {!island&&<Harbor/>}
    {!island&&<AmbientWorld/>}
    {Object.entries(assets.terrain).filter(([key])=>!island||key===island).map(([key,id])=><mesh key={key} name={`archipelago-bedrock-${key}`} geometry={assets.geometries[id]} material={material} receiveShadow raycast={noRaycast} dispose={null}/>)}
    <TraversalNetwork lowDetail={lowDetail} clip={focus?.bounds}/>
    {(!island||island==="progress")&&<mesh name="citadel-waterfall" geometry={assets.geometries[assets.waterfall]} raycast={noRaycast}>
      <meshStandardMaterial color="#b5cfc9" roughness={0.27} metalness={0.12} side={THREE.DoubleSide}/>
    </mesh>}
    <Architecture builder={assets.scenery} shadows={false} clip={focus?.bounds}/>
    {island&&<CoastalArchitecture clip={focus?.bounds}/>}
    {Object.entries(assets.forest).filter(([key])=>!island||key===island).map(([key,builder])=><Architecture key={key} builder={builder} shadows={false} clip={focus?.bounds}/>)}
  </group>;
});
