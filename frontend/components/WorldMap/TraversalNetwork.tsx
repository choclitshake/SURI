"use client";
import * as THREE from "three";
import { Architecture,type ArchitectureClip } from "./Architecture";
import { environmentArchitectureMaterial, useEnvironmentTextures } from "./EnvironmentMaterials";
import { useBakedArchitecture } from "./BakedArchitecture";
import { useBakedScene } from "./BakedScene";

const noRaycast:THREE.Mesh["raycast"]=()=>{};
export function TraversalNetwork({clip}:{lowDetail?:boolean;clip?:ArchitectureClip}){
  const assets=useBakedScene();
  const textures=useEnvironmentTextures(),legacy=useBakedArchitecture("transport");
  const material=environmentArchitectureMaterial("road",textures,false,false,true);
  return <group name="connected-medieval-traversal">
    {Object.entries(assets.roads).filter(([key])=>!clip?.island||key===clip.island).map(([key,id])=><mesh key={key} name={`roads-${key}`} geometry={assets.geometries[id]} material={material} raycast={noRaycast} receiveShadow dispose={null}/>)}
    {clip?<Architecture builder={legacy} clip={clip}/>:assets.dressings.map((part,i)=><mesh key={i} name="world-dressing" geometry={assets.geometries[part.geometry]} material={environmentArchitectureMaterial(part.surface,textures,part.mineral,true,true)} raycast={noRaycast} dispose={null}/>)}
  </group>;
}
