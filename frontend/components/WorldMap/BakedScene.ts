"use client";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import type { Batch,Surface } from "@/lib/worldMap/architecture";
import { QUALITY } from "@/lib/worldMap/renderQuality";
import { retainWorldResource } from "./SharedWorldResources";
import { useWorldQuality } from "./WorldQuality";
type Attribute={type:"f32"|"i16"|"u8"|"u16"|"u32";offset:number;count:number;itemSize:number;normalized:boolean};
type PackedBatch={shape:Batch["shape"];surface:Surface;pieces:number[][]};
type Manifest={buffer:string;compressedBuffer?:string;geometries:Record<string,{attributes:Record<string,Attribute>;index?:Attribute;sphere:number[];box:number[]}>;terrain:Record<string,string>;waterfall:string;roads:Record<string,string>;units:Record<string,{full:string;low:string}>;landmarks:Record<string,Array<{surface:Surface;mineral:boolean;geometry:string}>>;dressings:Array<{surface:Surface;mineral:boolean;geometry:string}>;harbor:Array<{surface:Surface;mineral:boolean;geometry:string}>;boatShadows:Array<{x:number;z:number;turn:number}>;glows:Record<string,{shell:string;windows:string}>;scenery:PackedBatch[];forest:Record<string,PackedBatch[]>;coastal:PackedBatch[];transport:PackedBatch[]};
export type ArchitectureModel={batches:Map<string,Batch>};
type SceneAssets=Omit<Manifest,"geometries"|"scenery"|"forest"|"coastal"|"transport">&{geometries:Record<string,THREE.BufferGeometry>;scenery:ArchitectureModel;forest:Record<string,ArchitectureModel>;coastal:ArchitectureModel;transport:ArchitectureModel};
const arrays={f32:Float32Array,i16:Int16Array,u8:Uint8Array,u16:Uint16Array,u32:Uint32Array};
function builder(batches:PackedBatch[]){
  const result:ArchitectureModel={batches:new Map()};for(const batch of batches)result.batches.set(`${batch.shape}:${batch.surface}`,{shape:batch.shape,surface:batch.surface,pieces:batch.pieces.map(p=>({matrix:new THREE.Matrix4().fromArray(p),color:new THREE.Color().fromArray(p,16)}))});return result;
}
export class BakedSceneLoader extends THREE.Loader<SceneAssets>{
  load(url:string,onLoad:(assets:SceneAssets)=>void,onProgress?:(event:ProgressEvent)=>void,onError?:(error:unknown)=>void){
    new THREE.FileLoader(this.manager).load(url,text=>{
      try{
        const manifest=JSON.parse(text as string) as Manifest;
        const filename=manifest.compressedBuffer&&typeof DecompressionStream!=="undefined"?manifest.compressedBuffer:manifest.buffer;
        new THREE.FileLoader(this.manager).setResponseType("arraybuffer").load(url.slice(0,url.lastIndexOf('/')+1)+filename,async data=>{
          try{
            let buffer=data as ArrayBuffer;const magic=new Uint8Array(buffer,0,2);
            if(magic[0]===31&&magic[1]===139)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
            const geometries:Record<string,THREE.BufferGeometry>={};
            const attr=(a:Attribute)=>new THREE.BufferAttribute(new arrays[a.type](buffer,a.offset,a.count),a.itemSize,a.normalized);
            for(const [name,packed]of Object.entries(manifest.geometries)){
              const geometry=new THREE.BufferGeometry();geometry.name=name;for(const [key,a]of Object.entries(packed.attributes))geometry.setAttribute(key,attr(a));if(packed.index)geometry.setIndex(attr(packed.index));
              geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3().fromArray(packed.sphere),packed.sphere[3]);geometry.boundingBox=new THREE.Box3(new THREE.Vector3().fromArray(packed.box),new THREE.Vector3().fromArray(packed.box,3));geometries[name]=retainWorldResource(geometry);
            }
            onLoad({...manifest,geometries,scenery:builder(manifest.scenery),forest:Object.fromEntries(Object.entries(manifest.forest).map(([key,b])=>[key,builder(b)])),coastal:builder(manifest.coastal),transport:builder(manifest.transport)});
          }catch(error){onError?.(error);}
        },onProgress,onError);
      }catch(error){onError?.(error);}
    },onProgress,onError);
  }
}
export function useBakedScene(){const tier=useWorldQuality();return useLoader(BakedSceneLoader,`/world-map/scene/${QUALITY[tier].asset}.json`);}
