"use client";
import { memo,useLayoutEffect,useMemo,useRef,type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { makeAmbientPose,sampleAmbientActor,type AmbientActor,type AmbientPose,type VesselKind } from "@/lib/worldMap/ambient";
import { LOCAL_SUN,WATER_LEVEL } from "@/lib/worldMap/environment";
import { useAmbientAssets,type AmbientAssets } from "./AmbientAssets";
import { environmentArchitectureMaterial,useEnvironmentTextures } from "./EnvironmentMaterials";
import { useWorldQuality,useWorldReducedMotion } from "./WorldQuality";
const noRaycast:THREE.Mesh["raycast"]=()=>{};
class MotionClock{
  value=0;
  advance(delta:number,reduced:boolean,diagnostic:number|null){if(diagnostic!==null)this.value=diagnostic;else if(!reduced)this.value+=Math.min(delta,.1);}
}
const jointShader=`
attribute vec4 motionJoint;
attribute vec2 actorGait;
uniform float ambientTime;
vec3 rotateX(vec3 p,float angle){float s=sin(angle),c=cos(angle);return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);}
vec3 rotateY(vec3 p,float angle){float s=sin(angle),c=cos(angle);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
`;
function actorMaterial(person:boolean,time:MotionClock){
  // Tiny matte fabric/wood/skin use the fixed daylight's diffuse response.
  // Keeping GGX and environment-map work on the terrain/hero architecture
  // preserves their detail while reducing cost across the moving population.
  const material=new THREE.MeshLambertMaterial({vertexColors:true,side:person?THREE.FrontSide:THREE.DoubleSide});
  material.customProgramCacheKey=()=>`ambient-${person?"citizen":"vessel"}-v2`;
  material.onBeforeCompile=shader=>{
    shader.uniforms.ambientTime=time;
    shader.vertexShader=jointShader+shader.vertexShader;
    const deformation=person?`
      float cycle=actorGait.x+motionJoint.y*3.14159265;
      float walking=actorGait.y;
      float swing=sin(cycle)*.38*walking;
      if(motionJoint.x>1.5&&motionJoint.x<2.5){
        float knee=max(0.,-sin(cycle))*.62*walking;
        transformed.y-=motionJoint.w;transformed=rotateX(transformed,knee);transformed.y+=motionJoint.w;
        transformed.y-=motionJoint.z;transformed=rotateX(transformed,swing);transformed.y+=motionJoint.z;
      }else if(motionJoint.x>.5&&motionJoint.x<1.5){transformed.y-=motionJoint.z;transformed=rotateX(transformed,swing);transformed.y+=motionJoint.z;}
      else if(motionJoint.x>2.5&&motionJoint.x<3.5){transformed.y-=motionJoint.z;transformed=rotateX(transformed,-swing*.72);transformed.y+=motionJoint.z;}
      else if(motionJoint.x>3.5){transformed.y-=motionJoint.z;transformed=rotateY(transformed,sin(ambientTime*.44+actorGait.x)*.045*(1.-walking));transformed.y+=motionJoint.z;}
      transformed.y+=abs(sin(actorGait.x))*.012*walking;
    `:`
      if(motionJoint.x>.5&&motionJoint.x<1.5)transformed.z+=sin(ambientTime*1.13+position.y*.8+actorGait.x)*.045*max(0.,1.-abs(position.y-motionJoint.z)/max(.4,motionJoint.z));
      else if(motionJoint.x>1.5){vec3 pivot=motionJoint.yzw;transformed-=pivot;transformed=rotateY(transformed,sin(ambientTime*1.2+actorGait.x)*(motionJoint.x<2.5?1.:-1.)*.24*actorGait.y);transformed+=pivot;}
    `;
    shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\n"+deformation);
    // Transform the limb normals with the same joints as the positions.
    if(person)shader.vertexShader=shader.vertexShader.replace("#include <beginnormal_vertex>",`#include <beginnormal_vertex>
      float normalCycle=actorGait.x+motionJoint.y*3.14159265;
      float normalSwing=sin(normalCycle)*.38*actorGait.y;
      if(motionJoint.x>1.5&&motionJoint.x<2.5)objectNormal=rotateX(objectNormal,max(0.,-sin(normalCycle))*.62*actorGait.y+normalSwing);
      else if(motionJoint.x>.5&&motionJoint.x<1.5)objectNormal=rotateX(objectNormal,normalSwing);
      else if(motionJoint.x>2.5&&motionJoint.x<3.5)objectNormal=rotateX(objectNormal,-normalSwing*.72);
    `);
  };
  return material;
}
type RuntimeActor={actor:AmbientActor;pose:AmbientPose;nextUpdate:number;lastUpdate:number;lastYaw:number;initialized:boolean};
/** One dynamic instance matrix per citizen/vessel, GPU joint animation, no
 * React state changes or per-frame objects. Offscreen transforms update at 1 Hz. */
function ActorBatch({model,assets,time,shadowRef}:{model:VesselKind|"person";assets:AmbientAssets;time:MotionClock;shadowRef:RefObject<THREE.InstancedMesh|null>}){
  const person=model==="person",tier=useWorldQuality(),reduced=useWorldReducedMotion();
  const ref=useRef<THREE.InstancedMesh>(null);
  const actors=useMemo(()=>assets.actors.filter(a=>a.model===model),[assets,model]);
  const shadowIndices=useMemo(()=>actors.map(a=>assets.actors.indexOf(a)),[actors,assets]);
  const runtime=useRef<RuntimeActor[]>([]);
  const geometry=useMemo(()=>{
    const g=assets.geometries[assets.models[model]].clone();g.setAttribute("actorGait",new THREE.InstancedBufferAttribute(new Float32Array(actors.length*2),2).setUsage(THREE.DynamicDrawUsage));return g;
  },[assets,model,actors]);
  const material=useMemo(()=>actorMaterial(person,time),[person,time]);
  const scratch=useMemo(()=>({matrix:new THREE.Matrix4(),quaternion:new THREE.Quaternion(),scale:new THREE.Vector3(),position:new THREE.Vector3(),project:new THREE.Vector3(),axis:new THREE.Vector3(0,1,0),shadowRotation:new THREE.Quaternion(),xRotation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2)}),[]);
  useLayoutEffect(()=>{
    if(!ref.current)return;
    ref.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    runtime.current=actors.map(actor=>({actor,pose:makeAmbientPose(),nextUpdate:0,lastUpdate:0,lastYaw:0,initialized:false}));
    const bounds=new THREE.Box3();for(const actor of actors){for(const p of assets.routes[actor.route].points)bounds.expandByPoint(new THREE.Vector3(...p));}
    bounds.expandByScalar(person?1.4:8);ref.current.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
    actors.forEach((a,i)=>ref.current!.setColorAt(i,new THREE.Color(a.tint)));
    const mesh=ref.current;return()=>{mesh.dispose();geometry.dispose();material.dispose();};
  },[actors,assets,geometry,material,person]);
  useFrame(({camera},delta)=>{
    const mesh=ref.current,shadows=shadowRef.current;if(!mesh||!shadows)return;
    const gait=mesh.geometry.attributes.actorGait as THREE.InstancedBufferAttribute,shadowMotion=shadows.geometry.attributes.shadowMotion as THREE.InstancedBufferAttribute;
    const s=scratch,now=time.value,interval=person?(tier==="economy"?1/15:1/24):1/15;
    let changed=false;
    for(let i=0;i<runtime.current.length;i++){
      const entry=runtime.current[i];if(entry.initialized&&(reduced||now<entry.nextUpdate))continue;
      const a=entry.actor,pose=sampleAmbientActor(a,assets.routes[a.route],reduced?0:now,entry.pose);
      s.project.set(pose.x,pose.y,pose.z).applyMatrix4(mesh.matrixWorld).project(camera);
      const offscreen=Math.abs(s.project.x)>1.18||Math.abs(s.project.y)>1.18;
      entry.nextUpdate=now+(offscreen?1:interval);
      let yaw=pose.yaw;
      if(entry.initialized){const difference=Math.atan2(Math.sin(yaw-entry.lastYaw),Math.cos(yaw-entry.lastYaw));yaw=entry.lastYaw+difference*Math.min(1,Math.max(delta,now-entry.lastUpdate)*6);}
      entry.lastYaw=yaw;entry.lastUpdate=now;entry.initialized=true;
      s.quaternion.setFromAxisAngle(s.axis,yaw);s.scale.setScalar(a.scale);
      const bob=person||reduced?0:Math.sin(now*.8+a.offset)*.035;
      s.position.set(pose.x,pose.y+bob,pose.z);s.matrix.compose(s.position,s.quaternion,s.scale);mesh.setMatrixAt(i,s.matrix);
      gait.setXY(i,person?pose.gait+i*1.73:a.offset,reduced?0:pose.moving);
      const height=person?.5:.6,width=person?.55:assets.geometries[assets.models[model]].boundingBox!.getSize(s.scale).x*1.25,length=person?.95:assets.geometries[assets.models[model]].boundingBox!.max.z*2*1.4;
      s.position.set(pose.x-LOCAL_SUN[0]/LOCAL_SUN[1]*height,person?pose.y+.018:WATER_LEVEL+.12,pose.z-LOCAL_SUN[2]/LOCAL_SUN[1]*height);
      if(person)s.shadowRotation.setFromAxisAngle(s.axis,Math.atan2(-LOCAL_SUN[0],-LOCAL_SUN[2]));else s.shadowRotation.copy(s.quaternion);
      s.shadowRotation.multiply(s.xRotation);s.scale.set(width*a.scale,length*a.scale,1);s.matrix.compose(s.position,s.shadowRotation,s.scale);shadows.setMatrixAt(shadowIndices[i],s.matrix);shadowMotion.setXY(shadowIndices[i],person?0:1,pose.moving);changed=true;
    }
    if(changed){mesh.instanceMatrix.needsUpdate=true;shadows.instanceMatrix.needsUpdate=true;gait.needsUpdate=true;shadowMotion.needsUpdate=true;}
  });
  return <group name={`ambient-${model}`}>
    <instancedMesh ref={ref} args={[geometry,material,actors.length]} raycast={noRaycast} dispose={null}/>
  </group>;
}

function AmbientShadows({assets,shadowRef}:{assets:AmbientAssets;shadowRef:RefObject<THREE.InstancedMesh|null>}){
  const resources=useMemo(()=>{
    const geometry=new THREE.PlaneGeometry(1,1);geometry.setAttribute("shadowMotion",new THREE.InstancedBufferAttribute(new Float32Array(assets.actors.length*2),2).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
      vertexShader:`attribute vec2 shadowMotion;varying vec2 vUv;varying vec2 vMotion;void main(){vUv=uv;vMotion=shadowMotion;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 vUv;varying vec2 vMotion;void main(){vec2 p=(vUv-.5)*2.;float shade=(1.-smoothstep(.18,1.,length(p)))*mix(.23,.17,vMotion.x);vec3 color=vec3(.17,.13,.23);float trail=-p.y;float wake=(1.-smoothstep(.015,.13,abs(abs(p.x)-(.12+(.5-trail)*.14))))*(1.-smoothstep(-.75,.3,trail))*smoothstep(-1.,-.6,trail)*vMotion.y*vMotion.x*.12;shade+=wake;color=mix(color,vec3(.65,.83,.84),wake/max(.001,shade));gl_FragColor=vec4(color,shade);}`});
    const bounds=new THREE.Box3();for(const route of assets.routes)for(const p of route.points)bounds.expandByPoint(new THREE.Vector3(...p));bounds.expandByScalar(10);
    return {geometry,material,sphere:bounds.getBoundingSphere(new THREE.Sphere())};
  },[assets]);
  useLayoutEffect(()=>{const mesh=shadowRef.current;if(!mesh)return;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.boundingSphere=resources.sphere;return()=>{mesh.dispose();resources.geometry.dispose();resources.material.dispose();};},[resources,shadowRef]);
  return <instancedMesh name="ambient-contact-shadows-and-wakes" ref={shadowRef} args={[resources.geometry,resources.material,assets.actors.length]} raycast={noRaycast} dispose={null}/>;
}

function FountainMotion({assets,time}:{assets:AmbientAssets;time:MotionClock}){
  const ref=useRef<THREE.InstancedMesh>(null);
  const resources=useMemo(()=>{
    const positions:number[]=[],indices:number[]=[];
    // Four tiny parabolic ribbons run from the upper bowl into each basin.
    for(let stream=0;stream<4;stream++)for(let j=0;j<=12;j++){
      const t=j/12,angle=stream*Math.PI/2,x=Math.sin(angle)*t*.6,z=Math.cos(angle)*t*.6,y=1.13+.2*Math.sin(t*Math.PI)-t*.72;
      for(const side of [-1,1])positions.push(x+Math.cos(angle)*side*.024,y,z-Math.sin(angle)*side*.024);
      if(j<12){const a=stream*26+j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);
    const m=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{ambientTime:time},vertexShader:`varying vec3 vPoint;void main(){vPoint=position;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,fragmentShader:`uniform float ambientTime;varying vec3 vPoint;void main(){float glint=.6+.2*sin(vPoint.y*33.+ambientTime*4.);gl_FragColor=vec4(.67,.83,.94,glint);}`});return {g,m};
  },[time]);
  useLayoutEffect(()=>{const mesh=ref.current;if(!mesh)return;const matrix=new THREE.Matrix4();assets.fountains.forEach((f,i)=>{matrix.makeTranslation(f.x,f.y,f.z);mesh.setMatrixAt(i,matrix);});mesh.computeBoundingSphere();mesh.instanceMatrix.needsUpdate=true;return()=>{mesh.dispose();resources.g.dispose();resources.m.dispose();};},[assets,resources]);
  return <instancedMesh ref={ref} args={[resources.g,resources.m,assets.fountains.length]} raycast={noRaycast} dispose={null}/>;
}
const MODELS=["person","rowboat","fishing","transport","merchant","harbor"] as const;
function AmbientPopulation(){
  const assets=useAmbientAssets(),textures=useEnvironmentTextures(),reduced=useWorldReducedMotion();
  const shadows=useRef<THREE.InstancedMesh>(null);
  const time=useMemo(()=>new MotionClock(),[]);
  const diagnostic=useMemo(()=>{if(typeof window==="undefined")return null;const p=new URLSearchParams(window.location.search),value=p.get('world-ambient-time');return p.has('world-profile')&&value!==null&&Number.isFinite(Number(value))?Math.max(0,Number(value)):null;},[]);
  useFrame((_,delta)=>time.advance(delta,reduced,diagnostic),-2);
  return <group name="archipelago-ambient-life">
    {assets.portParts.map(p=><mesh key={p.surface} geometry={assets.geometries[p.geometry]} material={environmentArchitectureMaterial(p.surface,textures,false,true,true)} raycast={noRaycast} dispose={null}/>)}
    <AmbientShadows assets={assets} shadowRef={shadows}/>
    {MODELS.map(model=><ActorBatch key={model} model={model} assets={assets} time={time} shadowRef={shadows}/>)}
    <FountainMotion assets={assets} time={time}/>
  </group>;
}
export const AmbientWorld=memo(function AmbientWorld(){
  const disabled=useMemo(()=>{if(typeof window==="undefined")return false;const p=new URLSearchParams(window.location.search);return p.has("world-profile")&&p.get("world-ambient")==="off";},[]);
  return disabled?null:<AmbientPopulation/>;
});
