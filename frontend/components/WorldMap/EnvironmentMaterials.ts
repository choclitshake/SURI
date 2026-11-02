"use client";

import { useLoader,useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { finishWorldMaterial } from "./StaticMaterialFinish";
import { ENVIRONMENT_BOUNDS } from "@/lib/worldMap/environment";
import { EnvironmentTextureLoader } from "./EnvironmentTextureLoader";
import { retainWorldResource } from "./SharedWorldResources";
import type { Surface } from "@/lib/worldMap/architecture";
import { finishEnvironmentHighlight } from "./EnvironmentHighlight";

export function useEnvironmentTextures() {
  const supported=useThree(state=>state.gl.extensions.has("WEBGL_compressed_texture_s3tc")&&state.gl.extensions.has("WEBGL_compressed_texture_s3tc_srgb"));
  const loaded=useLoader(EnvironmentTextureLoader,supported?"environment-s3tc":"environment-portable");
  return useMemo(()=>({albedo:loaded[0],normal:loaded[1],rma:loaded[2],lighting:loaded[3],coast:loaded[4],sky:loaded[5],water:loaded[6],cloud:loaded[7],architecture:loaded[8],reliefs:loaded[9]}),[loaded]);
}
type Textures=ReturnType<typeof useEnvironmentTextures>;

const terrainVertex=`
attribute vec4 environmentWeights;
attribute vec2 surfaceUv;
varying vec2 vSurfaceUv;
varying vec3 vEnvironmentPosition;
varying vec3 vEnvironmentNormal;
varying vec4 vEnvironmentWeights;
varying vec3 vBasisX;
varying vec3 vBasisY;
varying vec3 vBasisZ;
`;
const terrainFragment=`
varying vec2 vSurfaceUv;
uniform sampler2D environmentAlbedo;
uniform sampler2D environmentNormal;
uniform sampler2D environmentRma;
uniform sampler2D environmentLighting;
uniform vec4 environmentBounds;
varying vec3 vEnvironmentPosition;
varying vec3 vEnvironmentNormal;
varying vec4 vEnvironmentWeights;
varying vec3 vBasisX;
varying vec3 vBasisY;
varying vec3 vBasisZ;
vec2 atlasUv(vec2 uv, vec2 tile) {
  // Keep the complete minified footprint inside its material tile. A fixed
  // two-texel border leaks neighboring atlas colors into distant repeats.
  vec2 footprint=max(abs(dFdx(uv)),abs(dFdy(uv)));
  vec2 inset=clamp(footprint*1.5+vec2(.003),vec2(.003),vec2(.125));
  return (clamp(fract(uv),inset,1.-inset)+tile)*.5;
}
struct TerrainSurface { vec3 color; vec3 detail; vec3 rma; };
TerrainSurface terrainSample(vec2 uv,vec2 tile) {
  vec2 p=atlasUv(uv,tile);
  // Derivatives must precede fract: implicit LOD otherwise produces a visible
  // mip seam at every atlas repeat, even when the source tile is seamless.
  vec2 dx=dFdx(uv)*.5,dy=dFdy(uv)*.5;
  return TerrainSurface(textureGrad(environmentAlbedo,p,dx,dy).rgb,
    textureGrad(environmentNormal,p,dx,dy).xyz*2.-1.,textureGrad(environmentRma,p,dx,dy).rgb);
}
`;

export function makeTerrainMaterial(textures:Textures,lowDetail:boolean) {
  const material=new THREE.MeshStandardMaterial({roughness:.92,metalness:0});
  if(lowDetail)material.defines={...material.defines,TABLET_TERRAIN:1};
  material.customProgramCacheKey=()=>`archipelago-pbr-organic-v5-${lowDetail?"tablet":"desktop"}`;
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{
      environmentAlbedo:{value:textures.albedo},environmentNormal:{value:textures.normal},
      environmentRma:{value:textures.rma},environmentLighting:{value:textures.lighting},
      environmentBounds:{value:new THREE.Vector4(ENVIRONMENT_BOUNDS.minX,ENVIRONMENT_BOUNDS.minZ,ENVIRONMENT_BOUNDS.maxX-ENVIRONMENT_BOUNDS.minX,ENVIRONMENT_BOUNDS.maxZ-ENVIRONMENT_BOUNDS.minZ)},
    });
    shader.vertexShader=terrainVertex+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
      vSurfaceUv=surfaceUv;vEnvironmentPosition=position;vEnvironmentNormal=normal;vEnvironmentWeights=environmentWeights;
      vBasisX=normalize(normalMatrix*vec3(1.,0.,0.));vBasisY=normalize(normalMatrix*vec3(0.,1.,0.));vBasisZ=normalize(normalMatrix*vec3(0.,0.,1.));`);
    shader.fragmentShader=terrainFragment+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`
      vec3 p=vEnvironmentPosition;
      vec4 masks=vEnvironmentWeights;
      vec3 baked=texture2D(environmentLighting,(p.xz-environmentBounds.xy)/environmentBounds.zw).rgb;
      float rock=clamp(masks.x,0.,1.);
      float beach=clamp(masks.y,0.,1.);
      float soil=clamp(masks.z,0.,.6);
      float moisture=clamp(masks.w*.45+baked.b*.55,0.,1.);
      TerrainSurface turf=terrainSample(vSurfaceUv*.29,vec2(0.,1.));
      TerrainSurface sand=terrainSample(vSurfaceUv*.33+vec2(.31,.17),vec2(0.,0.));
      #ifdef TABLET_TERRAIN
        TerrainSurface earth=turf;
        earth.color*=vec3(.86,.79,.68);
      #else
        TerrainSurface earth=terrainSample(vSurfaceUv*.27+vec2(.57,.28),vec2(1.,0.));
      #endif
      vec2 axis=pow(abs(vEnvironmentNormal.xz),vec2(3.));axis/=max(.001,axis.x+axis.y);
      #ifdef TABLET_TERRAIN
        TerrainSurface stoneZ=terrainSample(vec2(vSurfaceUv.x*.24,p.y*.36+vSurfaceUv.y*.025),vec2(1.,1.));
        TerrainSurface stoneX=stoneZ;
      #else
        TerrainSurface stoneX=terrainSample(vec2(vSurfaceUv.y*.24,p.y*.36),vec2(1.,1.));
        TerrainSurface stoneZ=terrainSample(vec2(vSurfaceUv.x*.24,p.y*.36),vec2(1.,1.));
      #endif
      vec3 stone=mix(stoneZ.color,stoneX.color,axis.x);
      vec3 stoneRma=mix(stoneZ.rma,stoneX.rma,axis.x);
      // Moss accumulates on humid shelves; vertical exposed faces stay mineral.
      float moss=moisture*smoothstep(.35,.8,abs(vEnvironmentNormal.y))*.25;
      stone=mix(stone,turf.color,moss);
      vec3 organic=mix(turf.color,earth.color,soil);
      vec3 ground=mix(organic,sand.color,beach);
      vec3 mixedRma=mix(mix(mix(turf.rma,earth.rma,soil),sand.rma,beach),stoneRma,rock);
      float macro=.98+.12*(turf.rma.b-.5)+.045*(stoneRma.b-.5);
      diffuseColor.rgb*=mix(ground,stone,rock)*macro*mix(1.,.84,moisture*beach);
      vec3 groundDetail=mix(turf.detail,earth.detail,soil);
      groundDetail=mix(groundDetail,sand.detail,beach);
      vec3 rockDetail=vec3(stoneZ.detail.x*axis.y,
        mix(stoneZ.detail.y,stoneX.detail.y,axis.x),stoneX.detail.x*axis.x);
      vec3 detail=mix(vec3(groundDetail.x,0.,groundDetail.y),rockDetail,rock)*.32;
    `);
    shader.fragmentShader=shader.fragmentShader.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
      roughnessFactor=clamp(mixedRma.r-moisture*beach*.16,.64,1.);`);
    shader.fragmentShader=shader.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
      normal=normalize(normal+vBasisX*detail.x+vBasisY*detail.y+vBasisZ*detail.z);`);
    shader.fragmentShader=shader.fragmentShader.replace("#include <aomap_fragment>",`#include <aomap_fragment>
      reflectedLight.indirectDiffuse*=baked.r*mixedRma.g;
      `);
  };
  return finishEnvironmentHighlight(finishWorldMaterial(material,true,"none"));
}

const architectureMaterials=new Map<string,THREE.Material>();
/** Reuses the same atlas for masonry, bark, roofs and foliage microstructure. */
export function environmentArchitectureMaterial(surface:Surface,textures:Textures,mineral=false,vertexColored=false,baked=false,motion:"none"|"boat"="none",highlight=true) {
  const key=`${surface}:${mineral?"mineral":"masonry"}:${vertexColored}:${baked}:${motion}:${highlight}`;
  const assetKey=`${textures.albedo.uuid}:${key}`;
  const cached=architectureMaterials.get(assetKey);if(cached)return cached;
  if(surface==="leaves"){
    // Opaque, rough foliage is diffuse. Per-vertex daylight and baked inner-
    // canopy occlusion avoid a GGX/PMREM evaluation on every small leaf cluster.
    const canopy=new THREE.MeshLambertMaterial({vertexColors:true});
    canopy.onBeforeCompile=shader=>{
      shader.uniforms.canopyAtlas={value:textures.rma};
      shader.vertexShader="varying vec3 vCanopyPoint;\n"+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
        #ifdef USE_INSTANCING
          vCanopyPoint=(instanceMatrix*vec4(position,1.)).xyz;
        #else
          vCanopyPoint=position;
        #endif`);
      shader.fragmentShader="uniform sampler2D canopyAtlas;varying vec3 vCanopyPoint;\n"+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
        vec3 grain=texture2D(canopyAtlas,clamp(fract(vCanopyPoint.xz*.17),vec2(.008),vec2(.992))*.5+vec2(0.,.5)).rgb;
        float luma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(luma),.04)*(.74+grain.r*.36);`);
    };
    canopy.customProgramCacheKey=()=>"world-canopy-diffuse-v1";
    finishWorldMaterial(canopy,baked,"none",true);if(highlight)finishEnvironmentHighlight(canopy);architectureMaterials.set(assetKey,retainWorldResource(canopy));return canopy;
  }
  const material=new THREE.MeshStandardMaterial({color:surface==="road"?"#aaa18b":"white",roughness:surface==="gold"?.4:surface==="glass"?.3:surface==="iron"?.62:.87,
    metalness:surface==="gold"?.65:surface==="iron"?.78:surface==="glass"?.1:0,
    vertexColors:vertexColored,side:surface==="cloth"||surface==="window"||surface==="glass"?THREE.DoubleSide:THREE.FrontSide});
  if(surface==="carving"){
    material.map=textures.reliefs;material.alphaTest=.12;material.polygonOffset=true;material.polygonOffsetFactor=-1;
    material.roughness=.95;material.emissive.set("#8343be");material.emissiveIntensity=.1;
  }
  if(surface==="window"||surface==="magic"||surface==="glass"){
    material.emissive.set("#a764ea");material.emissiveIntensity=surface==="magic"?.65:surface==="glass"?.16:.26;
  }
  if(["stone","road","roof","wood","plaster","leaves"].includes(surface)){
    material.onBeforeCompile=shader=>{
      shader.uniforms.microAtlas={value:mineral?textures.rma:textures.architecture};
      shader.uniforms.microTile={value:new THREE.Vector2(...(mineral?[.5,.5]:surface==="wood"?[0,0]:surface==="roof"?[.5,.5]:[0,.5]) as [number,number])};
      shader.uniforms.microFrequency={value:surface==="road"?.65:.17};shader.uniforms.microMineral={value:mineral?1:0};
      shader.vertexShader="varying vec3 vMaterialPoint;\n"+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
        #ifdef USE_INSTANCING
          vMaterialPoint=(instanceMatrix*vec4(position,1.)).xyz;
        #else
          vMaterialPoint=position;
        #endif`);
      shader.fragmentShader="uniform sampler2D microAtlas;uniform vec2 microTile;uniform float microFrequency;uniform float microMineral; varying vec3 vMaterialPoint;\n"+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
        vec3 plane=abs(normalize(cross(dFdx(vMaterialPoint),dFdy(vMaterialPoint))));
        vec2 uv=plane.y>.65?vMaterialPoint.xz:plane.x>plane.z?vMaterialPoint.zy:vMaterialPoint.xy;
        vec3 grain=texture2D(microAtlas,clamp(fract(uv*microFrequency),vec2(.008),vec2(.992))*.5+microTile).rgb;
        float luma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(luma),.04)*mix(.74+grain.r*.36,.85+grain.b*.28,microMineral);
        diffuseColor.rgb*=mix(.82,1.,smoothstep(-.5,.35,vMaterialPoint.y));`);
        shader.fragmentShader=shader.fragmentShader.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
          roughnessFactor=clamp(mix(grain.g,grain.r,microMineral),.65,.98);`);
        shader.fragmentShader=shader.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
          vec3 faceDx=dFdx(-vViewPosition),faceDy=dFdy(-vViewPosition);
          vec3 tangentX=cross(faceDy,normal),tangentY=cross(normal,faceDx);
          float determinant=dot(faceDx,tangentX);
          vec3 reliefGradient=sign(determinant)*(dFdx(grain.b)*tangentX+dFdy(grain.b)*tangentY);
          normal=normalize(abs(determinant)*normal-reliefGradient*.08);`);
    };
    material.customProgramCacheKey=()=>"world-masonry-v3";
  }
  finishWorldMaterial(material,baked,motion==="boat"?"boat":surface==="cloth"?"cloth":"none");
  if(highlight)finishEnvironmentHighlight(material);
  architectureMaterials.set(assetKey,retainWorldResource(material));return material;
}
