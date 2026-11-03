"use client";
import { memo,useLayoutEffect,useMemo,useRef } from "react";
import * as THREE from "three";
import { useBakedScene } from "./BakedScene";
import { environmentArchitectureMaterial,useEnvironmentTextures } from "./EnvironmentMaterials";
import { LOCAL_SUN,WATER_LEVEL } from "@/lib/worldMap/environment";
import { WORLD_MOTION } from "./WorldMotion";
const noRaycast:THREE.Mesh["raycast"]=()=>{};
export const Harbor=memo(function Harbor(){
  const assets=useBakedScene(),textures=useEnvironmentTextures(),shadow=useRef<THREE.InstancedMesh>(null);
  const shadowGeometry=useMemo(()=>new THREE.PlaneGeometry(1,1),[]);
  const shadowMaterial=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{worldMotionTime:WORLD_MOTION.time,worldMotionEnabled:WORLD_MOTION.enabled,sunSlope:{value:new THREE.Vector2(-LOCAL_SUN[0]/LOCAL_SUN[1],-LOCAL_SUN[2]/LOCAL_SUN[1])}},
    vertexShader:`uniform float worldMotionTime;uniform float worldMotionEnabled;uniform vec2 sunSlope;varying vec2 vUv;void main(){vUv=uv;vec4 p=instanceMatrix*vec4(position,1.);float bob=sin(worldMotionTime*.8+float(gl_InstanceID)*1.7)*.04*worldMotionEnabled;p.xz+=sunSlope*bob;gl_Position=projectionMatrix*modelViewMatrix*p;}`,
    fragmentShader:`varying vec2 vUv;void main(){float radius=length((vUv-.5)*2.);float alpha=(1.-smoothstep(.2,1.,radius))*.21;gl_FragColor=vec4(.16,.14,.26,alpha);}`,
  }),[]);
  useLayoutEffect(()=>{
    const mesh=shadow.current;if(!mesh)return;
    const matrix=new THREE.Matrix4(),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
    assets.boatShadows.forEach((boat,i)=>{matrix.compose(new THREE.Vector3(boat.x-LOCAL_SUN[0]/LOCAL_SUN[1]*.65,WATER_LEVEL+.11,boat.z-LOCAL_SUN[2]/LOCAL_SUN[1]*.65),q,new THREE.Vector3(1.7,2.9,1));mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    return()=>{mesh.dispose();shadowGeometry.dispose();shadowMaterial.dispose();};
  },[assets,shadowGeometry,shadowMaterial]);
  return <group name="inhabited-fishing-harbor">
    {assets.harbor.map((part,i)=><mesh key={i} geometry={assets.geometries[part.geometry]} material={environmentArchitectureMaterial(part.surface,textures,part.mineral,true,false,"boat")} raycast={noRaycast} dispose={null}/>)}
    <instancedMesh ref={shadow} args={[shadowGeometry,shadowMaterial,assets.boatShadows.length]} raycast={noRaycast} dispose={null}/>
  </group>;
});
