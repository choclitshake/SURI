"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorldReducedMotion } from "./WorldQuality";
import { useBakedScene } from "./BakedScene";
export type LandmarkFeedback="inactive"|"hover"|"focus"|"pressed"|"selected";
const noRaycast:THREE.Mesh["raycast"]=()=>{};
const levels:Record<LandmarkFeedback,number>={inactive:.08,hover:.95,focus:1.2,pressed:1.4,selected:1.55};
function shellMaterial(width:number,opacity:number){return new THREE.ShaderMaterial({
  uniforms:{strength:{value:0},width:{value:width},opacity:{value:opacity}},
  vertexShader:`uniform float width; varying vec3 vN; varying vec3 vV;
    void main(){ vec3 p=position+normal*width;vec4 mv=modelViewMatrix*vec4(p,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv; }`,
  fragmentShader:`uniform float strength;uniform float opacity;varying vec3 vN;varying vec3 vV;
    void main(){float edge=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.1);gl_FragColor=vec4(.64,.19,1.,strength*opacity*(.38+.62*edge));}`,
  side:THREE.BackSide,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false,
});}
/** Baked silhouette shells, no bloom, ground indicator, lights or spatial query. */
export function LandmarkGlow({kind,state}:{kind:string;state:LandmarkFeedback}){
  const assets=useBakedScene(),geometry=assets.glows[kind];
  const materials=useMemo(()=>({inner:shellMaterial(.13,1.15),outer:shellMaterial(.43,.62),windows:new THREE.MeshBasicMaterial({color:"#c389ff",transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,toneMapped:false,blending:THREE.AdditiveBlending})}),[]);
  const group=useRef<THREE.Group>(null),strength=useRef(0),reduced=useWorldReducedMotion();
  const inner=useRef<THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>>(null),outer=useRef<THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>>(null),windows=useRef<THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>>(null);
  useEffect(()=>()=>{materials.inner.dispose();materials.outer.dispose();materials.windows.dispose();},[materials]);
  useFrame(({invalidate},delta)=>{
    const target=levels[state];if(target===0&&strength.current===0)return;strength.current=reduced?target:THREE.MathUtils.damp(strength.current,target,10,Math.min(delta,.1));
    if(Math.abs(target-strength.current)<.002)strength.current=target;else invalidate();
    if(group.current)group.current.visible=strength.current>.002;
    if(inner.current){inner.current.visible=strength.current>.16;inner.current.material.uniforms.strength.value=strength.current;}
    if(outer.current){outer.current.visible=strength.current>.16;outer.current.material.uniforms.strength.value=strength.current;}
    if(windows.current)windows.current.material.opacity=strength.current*.78;
  });
  return <group ref={group} name={`purple-${state}-${kind}`} visible={false}>
    <mesh ref={outer} geometry={assets.geometries[geometry.shell]} material={materials.outer} raycast={noRaycast} dispose={null}/>
    <mesh ref={inner} geometry={assets.geometries[geometry.shell]} material={materials.inner} raycast={noRaycast} dispose={null}/>
    <mesh ref={windows} geometry={assets.geometries[geometry.windows]} material={materials.windows} raycast={noRaycast} dispose={null}/>
  </group>;
}
