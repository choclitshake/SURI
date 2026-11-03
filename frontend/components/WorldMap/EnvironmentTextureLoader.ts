import * as THREE from "three";
import { DDSLoader } from "three/addons/loaders/DDSLoader.js";
import { retainWorldResource } from "./SharedWorldResources";
export const ENVIRONMENT_NAMES=["terrain-albedo","terrain-normal","terrain-rma","lighting-mask","coast-depth","afternoon-sky","water-normal","coastal-cloud","architecture-surface","architecture-reliefs"] as const;
export class EnvironmentTextureLoader extends THREE.Loader<THREE.Texture[]>{
  load(key:string,onLoad:(textures:THREE.Texture[])=>void,_onProgress?:(event:ProgressEvent)=>void,onError?:(error:unknown)=>void){
    const compressed=key.endsWith("s3tc");
    Promise.all(ENVIRONMENT_NAMES.map((name,i)=>new Promise<THREE.Texture>((resolve,reject)=>{
      const native=compressed&&(i===0||i===8),path=`/world-map/environment/${name}.${native?"dds":i===4?"png":"webp"}`;
      const loader=native?new DDSLoader(this.manager):new THREE.TextureLoader(this.manager);
      loader.load(path,texture=>{
        texture.colorSpace=i===0||i===5||i===7||i===9?THREE.SRGBColorSpace:THREE.NoColorSpace;
        if(i===5)texture.mapping=THREE.EquirectangularReflectionMapping;
        texture.wrapS=texture.wrapT=i<3||i===5||i===6||i===8?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
        // DDS rows are authored in the same orientation as decoded browser images.
        if(native)texture.flipY=false;
        texture.anisotropy=i<3?4:1;texture.needsUpdate=true;resolve(retainWorldResource(texture));
      },undefined,reject);
    }))).then(onLoad,onError);
  }
}
