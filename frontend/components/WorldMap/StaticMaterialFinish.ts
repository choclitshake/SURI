import * as THREE from "three";
import { WORLD_MOTION } from "./WorldMotion";
export function finishWorldMaterial<T extends THREE.Material>(material:T,baked:boolean,motion:"none"|"cloth"|"boat",diffuseCanopy=false){
  const previous=material.onBeforeCompile,cacheKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    if(baked){
      shader.vertexShader="attribute vec4 bakedLight;varying vec4 vBakedLight;\n"+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\n vBakedLight=bakedLight;");
      shader.fragmentShader="varying vec4 vBakedLight;\n"+shader.fragmentShader;
      if(diffuseCanopy)shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\n diffuseColor.rgb*=vBakedLight.g*(.86+.14*vBakedLight.b);");
      else shader.fragmentShader=shader.fragmentShader.replace("#include <aomap_fragment>",`#include <aomap_fragment>
        reflectedLight.directDiffuse=diffuseColor.rgb*(1.-metalnessFactor)*vec3(1.,.976,.94)*1.0186*vBakedLight.r;
        reflectedLight.directSpecular*=mix(.16,1.,vBakedLight.b);
        reflectedLight.indirectDiffuse*=vBakedLight.g;`);
    }
    if(motion!=="none"){
      shader.uniforms.worldMotionTime=WORLD_MOTION.time;shader.uniforms.worldMotionEnabled=WORLD_MOTION.enabled;
      shader.vertexShader="uniform float worldMotionTime;uniform float worldMotionEnabled;\n"+(motion==="cloth"?"attribute float windWeight;\n":"attribute float motionPhase;\n")+shader.vertexShader;
      const offset=motion==="cloth"?"transformed.z+=sin(worldMotionTime*1.25+position.x*.41+position.z*.33)*windWeight*windWeight*.075*worldMotionEnabled;":"transformed.y+=sin(worldMotionTime*.8+motionPhase)*.04*worldMotionEnabled;";
      shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\n"+offset);
    }
  };
  material.customProgramCacheKey=()=>`${cacheKey()}-static:${baked}-motion:${motion}-v2`;
  return material;
}
