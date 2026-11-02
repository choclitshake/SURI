"use client";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { retainWorldResource } from "./SharedWorldResources";
import type { AmbientActor,AmbientRoute,VesselKind } from "@/lib/worldMap/ambient";
import type { Surface } from "@/lib/worldMap/architecture";
type Attribute={type:"f32"|"i16"|"u8"|"u32";offset:number;count:number;itemSize:number;normalized:boolean};
type PackedGeometry={attributes:Record<string,Attribute>;index:Attribute;sphere:number[];box:number[]};
type Manifest={buffer:string;compressedBuffer:string;geometries:Record<string,PackedGeometry>;models:Record<VesselKind|"person",string>;portParts:Array<{surface:Surface;geometry:string}>;routes:AmbientRoute[];actors:AmbientActor[];fountains:Array<{x:number;y:number;z:number}>};
export type AmbientAssets=Omit<Manifest,"geometries">&{geometries:Record<string,THREE.BufferGeometry>};
const types={f32:Float32Array,i16:Int16Array,u8:Uint8Array,u32:Uint32Array};
class AmbientLoader extends THREE.Loader<AmbientAssets>{
  load(url:string,onLoad:(assets:AmbientAssets)=>void,onProgress?:(event:ProgressEvent)=>void,onError?:(error:unknown)=>void){
    new THREE.FileLoader(this.manager).load(url,text=>{
      try{
        const manifest=JSON.parse(text as string) as Manifest,compressed=typeof DecompressionStream!=="undefined";
        new THREE.FileLoader(this.manager).setResponseType("arraybuffer").load(url.slice(0,url.lastIndexOf('/')+1)+(compressed?manifest.compressedBuffer:manifest.buffer),async data=>{
          try{
            let buffer=data as ArrayBuffer;const magic=new Uint8Array(buffer,0,2);
            if(magic[0]===31&&magic[1]===139)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
            const attr=(a:Attribute)=>new THREE.BufferAttribute(new types[a.type](buffer,a.offset,a.count),a.itemSize,a.normalized),geometries:Record<string,THREE.BufferGeometry>={};
            for(const [key,p]of Object.entries(manifest.geometries)){
              const g=new THREE.BufferGeometry();for(const [name,a]of Object.entries(p.attributes))g.setAttribute(name,attr(a));g.setIndex(attr(p.index));
              g.boundingBox=new THREE.Box3(new THREE.Vector3().fromArray(p.box),new THREE.Vector3().fromArray(p.box,3));g.boundingSphere=new THREE.Sphere(new THREE.Vector3().fromArray(p.sphere),p.sphere[3]);geometries[key]=retainWorldResource(g);
            }
            onLoad({...manifest,geometries});
          }catch(error){onError?.(error);}
        },onProgress,onError);
      }catch(error){onError?.(error);}
    },onProgress,onError);
  }
}
export function useAmbientAssets(){return useLoader(AmbientLoader,"/world-map/ambient/ambient.json");}
