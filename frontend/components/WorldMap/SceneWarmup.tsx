"use client";
import { memo,useEffect } from "react";
import { useThree } from "@react-three/fiber";
/** Warm cached variants, including inactive glow shells, off the input path.
 * Older drivers keep normal lazy compilation instead of a blocking warm-up. */
export const SceneWarmup=memo(function SceneWarmup(){
  const {gl,scene,camera,invalidate}=useThree();
  useEffect(()=>{
    if(!gl.extensions.has("KHR_parallel_shader_compile"))return;
    let alive=true;
    const timer=window.setTimeout(()=>{
      void gl.compileAsync(scene,camera).then(()=>{if(alive)invalidate();}).catch(()=>{});
    },250);
    return()=>{alive=false;window.clearTimeout(timer);};
  },[gl,scene,camera,invalidate]);
  return null;
});
