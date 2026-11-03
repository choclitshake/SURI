import * as THREE from "three";
import { drawOuterLandmark } from "./outerLandmarks";
import type { ArchitecturalShape } from "./architecturalGeometry";

export type Surface = "stone" | "road" | "wood" | "plaster" | "roof" | "gold" | "window" | "magic" | "cloth" | "leaves" | "iron" | "glass" | "carving";
export type Shape = "box" | "cylinder" | "cone" | "sphere" | "roof" | "arch" | "ring" | "crystal" | "sail" | "hull" | "broadleaf" | "conifer" | "rock" | ArchitecturalShape;
export type Piece = { matrix: THREE.Matrix4; color: THREE.Color };
export type Batch = { shape: Shape; surface: Surface; pieces: Piece[] };
export type LandmarkKind = "keep" | "academy" | "records" | "champions" | "calculator" | "guild" | "topics" | "ranger" | "arena";

/** All architecture is assembled into instanced batches, including its tiny trims. */
export class ArchitectureBuilder {
  batches = new Map<string, Batch>();
  private transform = new THREE.Matrix4();
  at(x: number, y: number, z: number, scale: number, rotation: number, draw: () => void) {
    const previous = this.transform;
    this.transform = previous.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),rotation), new THREE.Vector3(scale,scale,scale)));
    draw(); this.transform = previous;
  }
  part(shape: Shape, surface: Surface, color: string, x: number, y: number, z: number, w: number, h: number, d: number, rx = 0, ry = 0, rz = 0) {
    const key = `${shape}:${surface}`;
    if (!this.batches.has(key)) this.batches.set(key,{shape,surface,pieces:[]});
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(w,h,d));
    this.batches.get(key)!.pieces.push({matrix:this.transform.clone().multiply(matrix),color:new THREE.Color(color)});
  }
  beam(a: [number,number,number], b: [number,number,number], width = 0.12, color = "#534238") {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), mid = va.clone().add(vb).multiplyScalar(0.5);
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),vb.clone().sub(va).normalize());
    const e = new THREE.Euler().setFromQuaternion(rotation);
    this.part("box","wood",color,mid.x,mid.y,mid.z,width,va.distanceTo(vb),width,e.x,e.y,e.z);
  }
  window(x: number, y: number, z: number, w = 0.45, h = 0.75) {
    this.part("arch","wood","#56493e",x,y-h/2,z,w+0.17,h+0.13,1);
    this.part("arch","window","#ffdba0",x,y-h/2+0.06,z+0.025,w,h,1);
    this.part("box","wood","#675641",x,y,z+0.05,0.06,h,0.06);
    this.part("box","wood","#675641",x,y-0.03,z+0.05,w,0.06,0.06);
    this.part("box","stone","#d4c5a3",x,y-h/2,z+0.08,w+0.24,0.1,0.22);
  }
  door(x: number, z: number, size = 1) {
    this.part("arch","stone","#d7c9af",x,0.18,z,1.25*size,1.85*size,1);
    this.part("arch","wood","#4f3830",x,0.2,z+0.025,0.95*size,1.6*size,1);
    for(let i=0;i<4;i++)this.part("box","wood","#80624a",x+(i-1.5)*0.2*size,0.8*size,z+0.04,0.028,1.15*size,0.04);
    this.part("sphere","gold","#e6bc6c",x+0.26*size,0.82*size,z+0.09,0.12,0.12,0.12);
    for(let i=0;i<3;i++)this.part("box","stone","#b4af9f",x,0.1-i*0.035,z+0.25+i*0.22,1.7*size,0.16,0.55);
  }
  flag(x: number, y: number, z: number, color = "#8751c9") {
    this.part("cylinder","gold","#dfbc75",x,y,z,0.06,2,0.06);
    this.part("sail","cloth",color,x+0.43,y+0.45,z,0.85,0.7,1);
    this.part("sphere","gold","#e9c479",x,y+1.05,z,0.17,0.17,0.17);
  }
  lantern(x: number, y: number, z: number) {
    this.beam([x,y+0.3,z-0.3],[x,y+0.3,z],0.07);
    this.part("box","gold","#534a42",x,y,z,0.28,0.48,0.25);
    this.part("box","window","#c19afa",x,y,z+0.02,0.19,0.32,0.24);
    this.part("cone","gold","#504740",x,y+0.3,z,0.4,0.2,0.35);
  }
  barrel(x: number, z: number) {
    this.part("cylinder","wood","#99744e",x,0.32,z,0.48,0.64,0.48);
    for(const y of [0.1,0.53])this.part("ring","gold","#4e5251",x,y,z,0.245,1,0.245);
  }
  crate(x: number,z: number) {
    this.part("box","wood","#b19564",x,0.3,z,0.6,0.6,0.6);
    for(const y of [0.06,0.52])this.part("box","wood","#6d5238",x,y,z+0.31,0.62,0.075,0.04);
    this.beam([x-0.24,0.05,z+0.32],[x+0.24,0.53,z+0.32],0.06);
  }
  tower(x: number,z: number,height = 5,r = 0.8,roof = "#665e94", ruined = false) {
    this.part("cylinder","stone","#bbbaa8",x,height/2,z,r*2,height,r*2);
    for(const y of [0.25,height*0.5,height-0.2])this.part("cylinder","stone","#d1c9b1",x,y,z,r*2.15,0.23,r*2.15);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      this.part("box","stone","#bdb9a4",x+Math.sin(a)*r,yMerlon(height,i,ruined),z+Math.cos(a)*r,0.28,0.55,0.28,0,a);
    }
    if(!ruined) {
      this.part("cone","roof",roof,x,height+1.15,z,r*3,2.8,r*3);
      this.part("sphere","gold","#e6c17c",x,height+2.6,z,0.22,0.22,0.22);
      this.window(x,height*0.67,z+r+0.01,0.36,0.85);
      this.window(x,height*0.3,z+r+0.01,0.3,0.65);
    }
  }
  house(width = 2.6, depth = 2.4, height = 2.2, roof = "#75617e", ornate = false) {
    this.part("box","stone","#b3afa0",0,0.2,0,width+0.22,0.4,depth+0.22);
    this.part("box","plaster","#e4ceb0",0,height/2+0.25,0,width,height,depth);
    this.part("roof","roof",roof,0,height+1.05,0,width+0.55,1.7,depth+0.7);
    const front=depth/2+0.035;
    for(const x of [-width/2,0,width/2])this.part("box","wood","#594939",x,height/2+0.25,front,0.13,height,0.12);
    for(const y of [0.38,height*0.55,height+0.23])this.part("box","wood","#66503c",0,y,front,width+0.12,0.13,0.14);
    for(const x of [-width*0.25,width*0.25]) {
      this.window(x,height*0.7,front+0.06,0.42,0.6);
      this.beam([x-width*0.2,0.5,front+0.03],[x+width*0.2,height*0.5,front+0.03],0.08);
    }
    this.beam([-width/2-0.25,height+0.22,front+0.25],[0,height+1.92,front+0.25],0.12);
    this.beam([0,height+1.92,front+0.25],[width/2+0.25,height+0.22,front+0.25],0.12);
    this.part("box","stone","#b5a18a",width*0.29,height+1.3,-depth*0.25,0.38,1.8,0.44);
    this.part("box","stone","#d3c4a9",width*0.29,height+2.22,-depth*0.25,0.5,0.18,0.55);
    this.door(0,front+0.11,0.7);
    if(ornate) {
      this.part("box","wood","#796249",0,height*0.55,front+0.6,width*0.7,0.16,1.1);
      for(let i=0;i<7;i++)this.part("box","wood","#67513e",(i-3)*width*0.1,height*0.55+0.35,front+1.1,0.06,0.7,0.06);
      this.part("box","wood","#b69565",0,height*0.55+0.68,front+1.1,width*0.75,0.09,0.09);
      this.lantern(-width/2-0.2,1.45,front+0.22);
      this.part("box","wood","#624834",width/2+0.3,1.7,front,0.7,0.4,0.1);
      this.part("sphere","gold","#e9cf8f",width/2+0.3,1.7,front+0.07,0.22,0.22,0.08);
    }
  }
  stall(x:number,z:number,color="#9a6476") {
    this.at(x,0,z,1,0,()=>{
      for(const a of [-0.8,0.8])for(const b of [-0.5,0.5])this.part("box","wood","#795d42",a,0.85,b,0.08,1.7,0.08);
      this.part("roof","cloth",color,0,1.8,0,1.9,0.45,1.5);
      this.part("box","wood","#a38352",0,0.68,0.35,1.8,0.2,0.7);
      for(let i=0;i<5;i++)this.part("sphere","leaves",i%2 ? "#ba7149":"#98aa51",(i-2)*0.3,0.88,0.35,0.25,0.25,0.25);
    });
  }
  landmark(kind: LandmarkKind) {
    if(kind === "keep" || kind === "topics" || kind === "records" || kind === "champions" || kind === "calculator") {
      drawOuterLandmark(this,kind); return;
    }
    if(kind === "arena") {
      const radius=3.4;
      this.part("cylinder","stone","#c4b895",0,0.25,0,radius*2+0.5,0.5,radius*2+0.5);
      this.part("cylinder","plaster","#b39364",0,0.55,0,radius*1.55,0.14,radius*1.55);
      for(let i=0;i<18;i++) {
        const a=i*Math.PI/9,x=Math.sin(a)*radius,z=Math.cos(a)*radius;
        if(z>radius*0.85&&Math.abs(x)<1.8)continue;
        this.part("cylinder","stone","#d4c9aa",x,1.7,z,0.4,2.7,0.4);
        this.part("box","stone","#c3b38f",x,3.08,z,1.2,0.38,0.6,0,a);
        if(i%3===0)this.flag(x,3.95,z,"#a17079");
      }
      return;
    }
    const roof = kind === "ranger" ? "#416e67" : kind === "guild" ? "#91645f" : "#74698e";
    const width = 4.2;
    this.house(width,3.1,2.8,roof,true);
    if(kind === "academy") {
      this.tower(-2.4,-0.5,5,0.7,roof);this.tower(2.4,-0.5,5,0.7,roof);
      this.part("sphere","gold","#dcba77",0,5.9,0,1.1,1.1,1.1);this.flag(0,7.1,0);
    } else if(kind === "guild") {
      this.at(-2.7,0,-0.5,0.8,0,()=>this.house(2.4,2.3,2.1,roof));
      this.stall(3,2,"#ae925d");this.flag(0,5.9,0,"#ae925d");this.barrel(-2.6,2.1);
    } else {this.tower(2,-1.2,4.2,0.65,roof);this.flag(0,5.8,0,"#72977c");}
  }
}
function yMerlon(height:number,i:number,ruined:boolean) { return height + (ruined ? Math.sin(i*2)*0.45:0.25); }
