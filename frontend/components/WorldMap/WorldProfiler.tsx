"use client";
import { useEffect,useRef,useState } from "react";
import { useFrame,useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEnvironmentTextures } from "./EnvironmentMaterials";
import { useWorldQuality } from "./WorldQuality";

const commits:Record<string,number>={};
export function recordWorldCommit(name:string){commits[name]=(commits[name]??0)+1;}
const percentile=(values:number[],fraction:number)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return Math.round(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*fraction))]*100)/100;};
function resources(scene:THREE.Scene,environment:THREE.Texture[]){
  const geometries=new Set<THREE.BufferGeometry>(),textures=new Set<THREE.Texture>(environment),materials=new Set<THREE.Material>();
  let geometryBytes=0,textureBytes=0,instances=0,culledInstances=0;
  const buffers=new Set<ArrayBufferView>();
  const addBuffer=(array:ArrayBufferView)=>{if(!buffers.has(array)){buffers.add(array);geometryBytes+=array.byteLength;}};
  scene.traverse(object=>{
    const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
    geometries.add(mesh.geometry);
    const instanced=mesh as THREE.InstancedMesh;if(instanced.isInstancedMesh){instances+=instanced.count;culledInstances+=Math.max(0,(instanced.userData.worldTotalInstances??instanced.count)-instanced.count);addBuffer(instanced.instanceMatrix.array);if(instanced.instanceColor)addBuffer(instanced.instanceColor.array);}
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      materials.add(material);
      for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
      if(material instanceof THREE.ShaderMaterial)for(const uniform of Object.values(material.uniforms))if(uniform.value instanceof THREE.Texture)textures.add(uniform.value);
    }
  });
  if(scene.environment)textures.add(scene.environment);
  for(const geometry of geometries){for(const attr of Object.values(geometry.attributes))addBuffer(attr.array);if(geometry.index)addBuffer(geometry.index.array);}
  for(const texture of textures){
    if(texture instanceof THREE.CompressedTexture)textureBytes+=texture.mipmaps.reduce((sum,mip)=>sum+mip.data.byteLength,0);
    else{const image=texture.image as {width?:number;height?:number}|undefined;textureBytes+=(image?.width??0)*(image?.height??0)*4*(texture.generateMipmaps?4/3:1);}
  }
  return {sceneGeometries:geometries.size,sceneMaterials:materials.size,instances,culledInstances,nativeCompressedTextures:[...textures].filter(texture=>texture instanceof THREE.CompressedTexture).length,geometryBufferMiB:+(geometryBytes/1048576).toFixed(2),estimatedTextureMiB:+(textureBytes/1048576).toFixed(2)};
}

/** Opt-in measurement only: ?world-profile=benchmark drives continuous frames.
 * Normal users have no overlay, timer queries, sampling or forced frame loop. */
export function WorldProfiler(){
  const [mode]=useState(()=>typeof window==="undefined"?null:new URLSearchParams(window.location.search).get("world-profile"));
  return mode?<ProfileSession continuous={mode==="benchmark"}/>:null;
}
function ProfileSession({continuous}:{continuous:boolean}){
  const {gl,scene,invalidate}=useThree();
  const getThree=useThree(state=>state.get);
  const textures=useEnvironmentTextures();
  const quality=useWorldQuality();
  const sample=useRef({start:0,last:0,before:0,frames:0,intervals:[] as number[],cpu:[] as number[],gpu:[] as number[],calls:0,triangles:0});
  const timer=useRef<{ext:{TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number};context:WebGL2RenderingContext;active:WebGLQuery|null;pending:WebGLQuery[]}|null>(null);
  useEffect(()=>{
    const context=gl.getContext() as WebGL2RenderingContext,ext=context.getExtension("EXT_disjoint_timer_query_webgl2");
    const debug=context.getExtension("WEBGL_debug_renderer_info");
    if(ext)timer.current={context,ext,active:null,pending:[]};
    const output=document.createElement("pre");output.dataset.worldProfile="";output.textContent="Warming up";
    Object.assign(output.style,{position:"fixed",left:"8px",bottom:"8px",zIndex:"200",pointerEvents:"none",maxHeight:"65vh",overflow:"hidden",font:"10px/1.3 monospace",color:"#fff",background:"#07121cdd",padding:"8px"});document.body.append(output);
    const renderScene=getThree().scene;
    const previousAfter=renderScene.onAfterRender;
    const after=(...args:Parameters<typeof scene.onAfterRender>)=>{
      previousAfter.apply(renderScene,args);
      if(!sample.current.before)return;
      const s=sample.current,now=performance.now(),t=timer.current;
      if(t?.active){t.context.endQuery(t.ext.TIME_ELAPSED_EXT);t.pending.push(t.active);t.active=null;}
      const before=s.before;s.before=0;
      s.calls=gl.info.render.calls;s.triangles=gl.info.render.triangles;
      if(now-s.start>3000&&before){s.cpu.push(now-before);if(s.last&&now-s.last<250)s.intervals.push(now-s.last);s.frames++;}
      s.last=now;
    };
    renderScene.onAfterRender=after;
    const interval=window.setInterval(()=>{
      const s=sample.current;
      const camera=getThree().camera as THREE.OrthographicCamera&{manual?:boolean};
      output.textContent=JSON.stringify({mode:continuous?"continuous-throughput":"normal-cadence",quality,renderer:context.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:context.RENDERER),canvasWidth:gl.domElement.clientWidth,canvasHeight:gl.domElement.clientHeight,camera:{manual:camera.manual,top:camera.top,bottom:camera.bottom,zoom:camera.zoom,position:camera.position.toArray()},elapsedSeconds:+((performance.now()-s.start)/1000).toFixed(1),sampledFrames:s.frames,
        frameMedianMs:percentile(s.intervals,.5),frameP95Ms:percentile(s.intervals,.95),cpuSubmitMedianMs:percentile(s.cpu,.5),cpuSubmitP95Ms:percentile(s.cpu,.95),gpuMedianMs:percentile(s.gpu,.5),gpuP95Ms:percentile(s.gpu,.95),gpuTimerAvailable:!!timer.current,
        drawCalls:s.calls,triangles:s.triangles,gpuGeometries:gl.info.memory.geometries,gpuTextures:gl.info.memory.textures,shaderPrograms:gl.info.programs?.length??0,dpr:gl.getPixelRatio(),...resources(scene,Object.values(textures)),commits:{...commits}},null,2);
    },1000);
    return()=>{output.remove();if(renderScene.onAfterRender===after)renderScene.onAfterRender=previousAfter;window.clearInterval(interval);const t=timer.current;if(t){if(t.active){t.context.endQuery(t.ext.TIME_ELAPSED_EXT);t.context.deleteQuery(t.active);}t.pending.forEach(query=>t.context.deleteQuery(query));}timer.current=null;};
  },[gl,scene,continuous,textures,quality,getThree]);
  useFrame(()=>{
    const s=sample.current,now=performance.now();if(!s.start)s.start=now;s.before=now;
    const t=timer.current;
    if(t){
      const disjoint=t.context.getParameter(t.ext.GPU_DISJOINT_EXT);
      while(t.pending.length&&(disjoint||t.context.getQueryParameter(t.pending[0],t.context.QUERY_RESULT_AVAILABLE))){
        const query=t.pending.shift()!;if(!disjoint&&now-s.start>3000)s.gpu.push(t.context.getQueryParameter(query,t.context.QUERY_RESULT)/1000000);t.context.deleteQuery(query);
      }
      if(t.pending.length<4){const query=t.context.createQuery();if(query){t.context.beginQuery(t.ext.TIME_ELAPSED_EXT,query);t.active=query;}}
    }
    if(continuous)invalidate();
    if(s.intervals.length>1800){s.intervals.splice(0,600);s.cpu.splice(0,600);s.gpu.splice(0,600);}
  });
  return null;
}

