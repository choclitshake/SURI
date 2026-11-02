"use client";

import { memo,useEffect, useMemo,useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Architecture, CoastalArchitecture, type ArchitectureClip } from "./Architecture";
import { useBakedScene } from "./BakedScene";
import { ISLANDS } from "@/lib/worldMap/landscape";
import { makeTerrainMaterial, useEnvironmentTextures } from "./EnvironmentMaterials";
import { TraversalNetwork } from "./TraversalNetwork";
import { Harbor } from "./Harbor";
import { WorldMotion } from "./WorldMotion";
import { AmbientWorld } from "./AmbientWorld";
import { useWorldVisibility } from "./WorldVisibility";
const noRaycast: THREE.Mesh["raycast"] = () => {};

export type IslandFocus = keyof typeof ISLANDS;
export type LandscapeFocus = { island: IslandFocus; bounds: ArchitectureClip };

function SecondaryTerrain({material}:{material:THREE.Material}){
  const assets=useBakedScene(),visibility=useWorldVisibility(),whole=useRef<THREE.Mesh>(null),chunks=useRef<THREE.Group>(null),revision=useRef(-1);
  const ids=assets.secondaryTerrain??[];
  useFrame(()=>{
    if(!whole.current||!chunks.current||revision.current===visibility?.revision)return;
    revision.current=visibility?.revision??0;
    // The overview draws one merged mesh. Split views only help when at least
    // one region is outside the frame, avoiding extra overview draw calls.
    const full=!visibility||ids.every(id=>visibility.frustum.intersectsBox(assets.geometries[id].boundingBox!));
    whole.current.visible=full;chunks.current.visible=!full;
  });
  return <>
    <mesh ref={whole} name="archipelago-bedrock-secondary" geometry={assets.geometries[assets.terrain.secondary]} material={material} raycast={noRaycast} dispose={null}/>
    <group ref={chunks} visible={false}>{ids.map(id=><mesh key={id} name={`archipelago-bedrock-${id}`} geometry={assets.geometries[id]} material={material} raycast={noRaycast} dispose={null}/>)}</group>
  </>;
}

export const Landscape=memo(function Landscape({focus,lowDetail=false}:{focus?:LandscapeFocus;lowDetail?:boolean}) {
  const island=focus?.island;
  const textures=useEnvironmentTextures();
  const material=useMemo(()=>makeTerrainMaterial(textures,lowDetail),[textures,lowDetail]);
  const assets=useBakedScene();
  useEffect(()=>()=>material.dispose(),[material]);
  return <group name="fantasy-archipelago">
    <WorldMotion/>
    {!island&&<Harbor/>}
    {!island&&<AmbientWorld/>}
    {Object.entries(assets.terrain).filter(([key])=>(!island||key===island)&&key!=="secondary").map(([key,id])=><mesh key={key} name={`archipelago-bedrock-${key}`} geometry={assets.geometries[id]} material={material} receiveShadow raycast={noRaycast} dispose={null}/>)}
    {!island&&<SecondaryTerrain material={material}/>}
    <TraversalNetwork lowDetail={lowDetail} clip={focus?.bounds}/>
    {(!island||island==="progress")&&<mesh name="citadel-waterfall" geometry={assets.geometries[assets.waterfall]} raycast={noRaycast}>
      <meshStandardMaterial color="#b5cfc9" roughness={0.27} metalness={0.12} side={THREE.DoubleSide}/>
    </mesh>}
    <Architecture builder={assets.scenery} shadows={false} clip={focus?.bounds}/>
    {island&&<CoastalArchitecture clip={focus?.bounds}/>}
    {Object.entries(assets.forest).filter(([key])=>!island||key===island).map(([key,builder])=><Architecture key={key} builder={builder} shadows={false} clip={focus?.bounds}/>)}
  </group>;
});
