import * as THREE from "three";

export const HIGHLIGHT_KINDS=["keep","topics","records","champions","calculator"] as const;
export const ENVIRONMENT_HIGHLIGHT={
  zones:{value:HIGHLIGHT_KINDS.map(()=>new THREE.Vector4(0,0,1,0))},
  strengths:{value:new Float32Array(HIGHLIGHT_KINDS.length)},
};

/** A ground-conforming circle and a soft wash on nearby scenery. Hero
 * buildings use separate materials and retain their authored stone colors. */
export function finishEnvironmentHighlight<T extends THREE.Material>(material:T){
  const previous=material.onBeforeCompile,cacheKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.uniforms.landmarkZones=ENVIRONMENT_HIGHLIGHT.zones;
    shader.uniforms.landmarkStrengths=ENVIRONMENT_HIGHLIGHT.strengths;
    shader.vertexShader="varying vec2 vHighlightPosition;\n"+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace("#include <project_vertex>",`
      vec4 highlightPoint=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        highlightPoint=instanceMatrix*highlightPoint;
      #endif
      vHighlightPosition=highlightPoint.xz;
      #include <project_vertex>`);
    shader.fragmentShader="uniform vec4 landmarkZones[5];uniform float landmarkStrengths[5];varying vec2 vHighlightPosition;\n"+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
      for(int zone=0;zone<5;zone++){
        if(landmarkStrengths[zone]>.001){
          float radius=max(.01,landmarkZones[zone].z);
          float distanceToCenter=length(vHighlightPosition-landmarkZones[zone].xy)/radius;
          float ring=smoothstep(.86,.93,distanceToCenter)*(1.-smoothstep(.96,1.,distanceToCenter));
          float wash=(1.-smoothstep(.35,1.,distanceToCenter))*.12;
          totalEmissiveRadiance+=vec3(.39,.085,.72)*(ring*.65+wash)*landmarkStrengths[zone];
        }
      }`);
  };
  material.customProgramCacheKey=()=>`${cacheKey()}-environment-circle-v1`;
  return material;
}
