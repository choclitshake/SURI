import * as THREE from "three";
type PackedGeometry={position:number[];normal:number[];index:number[]};
function restore(p:PackedGeometry){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(p.position,3));
  geometry.setAttribute("normal",new THREE.Float32BufferAttribute(p.normal,3));
  geometry.setIndex(p.index);geometry.computeBoundingSphere();return geometry;
}
type GlowModels=Record<string,{shell:THREE.BufferGeometry;windows:THREE.BufferGeometry}>;
type PathTiers=Record<string,Array<{id:string;island:string;geometry:THREE.BufferGeometry}>>;
/** Loader caching belongs to Three/R3F, outside React's rendering lifecycle. */
export class GlowGeometryLoader extends THREE.Loader<GlowModels>{
  load(url:string,onLoad:(models:GlowModels)=>void,onProgress?:(event:ProgressEvent)=>void,onError?:(error:unknown)=>void){
    new THREE.FileLoader(this.manager).load(url,data=>{
      try{
        const parsed=JSON.parse(data as string) as {models:Record<string,{shell:PackedGeometry;windows:PackedGeometry}>};
        onLoad(Object.fromEntries(Object.entries(parsed.models).map(([kind,p])=>[kind,{shell:restore(p.shell),windows:restore(p.windows)}])));
      }catch(error){onError?.(error);}
    },onProgress,onError);
  }
}
export class PathGeometryLoader extends THREE.Loader<PathTiers>{
  load(url:string,onLoad:(tiers:PathTiers)=>void,onProgress?:(event:ProgressEvent)=>void,onError?:(error:unknown)=>void){
    new THREE.FileLoader(this.manager).load(url,data=>{
      try{
        const parsed=JSON.parse(data as string) as Record<string,Array<PackedGeometry&{id:string;island:string}>>;
        onLoad(Object.fromEntries(Object.entries(parsed).map(([tier,paths])=>[tier,paths.map(p=>({id:p.id,island:p.island,geometry:restore(p)}))])));
      }catch(error){onError?.(error);}
    },onProgress,onError);
  }
}
