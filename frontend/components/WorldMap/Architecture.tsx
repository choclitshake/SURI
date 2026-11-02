"use client";

import { memo,useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Batch, LandmarkKind } from "@/lib/worldMap/architecture";
import { ISLANDS, islandScore } from "@/lib/worldMap/landscape";

import { environmentArchitectureMaterial, useEnvironmentTextures } from "./EnvironmentMaterials";
import { useBakedArchitecture } from "./BakedArchitecture";
import { useBakedScene,type ArchitectureModel } from "./BakedScene";
import { useWorldQuality } from "./WorldQuality";
import { useWorldVisibility } from "./WorldVisibility";

const noRaycast: THREE.Mesh["raycast"] = () => {};
function ArchitectureBatch({ batch, shadows }: {batch:Batch;shadows:boolean}) {
  const textures=useEnvironmentTextures();
  const assets=useBakedScene(),quality=useWorldQuality(),group=useRef<THREE.Group>(null);
  const unit=assets.units[batch.shape],full=assets.geometries[unit.full],low=assets.geometries[unit.low];
  const ref=useRef<THREE.InstancedMesh>(null);
  const visibility=useWorldVisibility(),revision=useRef(-1);
  const candidates=useMemo(()=>batch.pieces.map(piece=>{
    const bounds=full.boundingBox!.clone().union(low.boundingBox!).applyMatrix4(piece.matrix).expandByScalar(.12);
    return {bounds,occluded:visibility?.terrain.hides(bounds)??false};
  }),[batch,full,low,visibility]);
  const slots=useRef<Int32Array|null>(null);
  const detail=useRef(true),lod=batch.shape==="rock"||batch.shape==="broadleaf"||batch.shape==="conifer";
  useFrame(({camera,size})=>{
    const mesh=ref.current,order=slots.current;
    if(mesh&&order&&visibility&&!visibility.disabled&&revision.current!==visibility.revision){
      revision.current=visibility.revision;
      let count=0,changed=false;
      for(let i=0;i<candidates.length;i++){
        const candidate=candidates[i];
        if(!visibility.frustum.intersectsBox(candidate.bounds)||(visibility.occlusion&&candidate.occluded))continue;
        if(order[count]!==i){order[count]=i;changed=true;}count++;
      }
      if(changed||mesh.count!==count){
        for(let j=0;j<count;j++){const p=batch.pieces[order[j]];mesh.setMatrixAt(j,p.matrix);mesh.setColorAt(j,p.color);}
        mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;
        if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      }
    }
    if(!lod||!ref.current||!group.current)return;
    const e=group.current.matrixWorld.elements,cameraOrtho=camera as THREE.OrthographicCamera;
    const pixels=size.height/(cameraOrtho.top-cameraOrtho.bottom)*camera.zoom*Math.hypot(e[4],e[5],e[6]);
    const threshold=quality==="economy"?20:quality==="balanced"?12:10;
    const next=detail.current?pixels>threshold-1:pixels>threshold+1;
    if(next!==detail.current){detail.current=next;ref.current.geometry=next?full:low;}
  });
  useLayoutEffect(()=>{
    if(!ref.current)return;
    slots.current=new Int32Array(batch.pieces.length).fill(-1);
    batch.pieces.forEach((p,i)=>{ref.current!.setMatrixAt(i,p.matrix);ref.current!.setColorAt(i,p.color);});
    ref.current.instanceMatrix.needsUpdate=true;
    if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;
    const mesh=ref.current,bounds=new THREE.Box3();for(const candidate of candidates)bounds.union(candidate.bounds);
    mesh.boundingBox=bounds;mesh.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());mesh.userData.worldTotalInstances=batch.pieces.length;revision.current=-1;
    return()=>mesh.dispose();
  },[batch,candidates]);
  return <group ref={group}><instancedMesh ref={ref} args={[full,environmentArchitectureMaterial(batch.surface,textures,batch.shape==="rock"||batch.shape==="obelisk"),batch.pieces.length]} castShadow={shadows} receiveShadow raycast={noRaycast} dispose={null}/></group>;
}
export type ArchitectureClip = { minX: number; maxX: number; minZ: number; maxZ: number; padding?: number; island?: keyof typeof ISLANDS };

export const Architecture=memo(function Architecture({builder,shadows=false,clip}:{builder:ArchitectureModel;shadows?:boolean;clip?:ArchitectureClip}) {
  const batches=useMemo(()=>Array.from(builder.batches.entries()).map(([key,batch])=>{
    if(!clip)return [key,batch] as const;
    const padding=clip.padding ?? 0;
    const pieces=batch.pieces.filter(piece=>{
      const position=new THREE.Vector3().setFromMatrixPosition(piece.matrix);
      return position.x>=clip.minX-padding&&position.x<=clip.maxX+padding&&position.z>=clip.minZ-padding&&position.z<=clip.maxZ+padding&&(!clip.island||islandScore(position.x,position.z,ISLANDS[clip.island])>=-padding);
    });
    return [key,{...batch,pieces}] as const;
  }).filter(([,batch])=>batch.pieces.length>0),[builder,clip]);
  return <group>{batches.map(([key,batch])=><ArchitectureBatch key={key} batch={batch} shadows={shadows}/>)}</group>;
});
export const LandmarkArchitecture=memo(function LandmarkArchitecture({kind}:{kind:LandmarkKind}) {
  const assets=useBakedScene(),textures=useEnvironmentTextures();
  return <group name={`merged-landmark-${kind}`}>{assets.landmarks[kind].map((part,i)=><mesh key={i} geometry={assets.geometries[part.geometry]} material={environmentArchitectureMaterial(part.surface,textures,part.mineral,true,true,"none",false)} raycast={noRaycast} dispose={null}/>)}</group>;
});
export function CoastalArchitecture({clip}:{clip?:ArchitectureClip}) {
  const builder=useBakedArchitecture("coastal");
  return <Architecture builder={builder} shadows={false} clip={clip}/>;
}
