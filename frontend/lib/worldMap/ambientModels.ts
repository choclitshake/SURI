import * as THREE from "three";
import { ArchitectureBuilder } from "./architecture";
import { geometryForShape } from "./primitiveGeometry";
import { WORLD_PALETTE as P } from "./worldPalette";
import type { VesselKind } from "./ambient";

export const VESSELS:Record<VesselKind,{width:number;length:number;mast:number}>={
  rowboat:{width:1.05,length:2.35,mast:0},fishing:{width:1.35,length:3.15,mast:1.9},
  transport:{width:1.75,length:4.4,mast:2.6},merchant:{width:2.15,length:5.65,mast:4},harbor:{width:2.55,length:7.1,mast:5.1},
};
type MeshPart={g:THREE.BufferGeometry;color:string;joint?:[number,number,number,number]};
function merge(parts:MeshPart[]){
  const positions:number[]=[],normals:number[]=[],colors:number[]=[],joints:number[]=[],indices:number[]=[];
  for(const {g,color,joint=[0,0,0,0]}of parts){
    const offset=positions.length/3,p=g.attributes.position,n=g.attributes.normal,c=new THREE.Color(color);
    for(let j=0;j<p.count;j++){positions.push(p.getX(j),p.getY(j),p.getZ(j));normals.push(n.getX(j),n.getY(j),n.getZ(j));const shade=.94+.06*Math.min(1,Math.max(0,p.getY(j)));colors.push(c.r*shade,c.g*shade,c.b*shade);joints.push(...joint);}
    if(g.index)for(const i of g.index.array)indices.push(offset+i);else for(let i=0;i<p.count;i++)indices.push(offset+i);g.dispose();
  }
  const g=new THREE.BufferGeometry();for(const [name,array,size]of [["position",positions,3],["normal",normals,3],["color",colors,3],["motionJoint",joints,4]] as const)g.setAttribute(name,new THREE.Float32BufferAttribute(array,size));
  g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function piece(parts:MeshPart[],shape:"box"|"cylinder"|"sphere"|"cone"|"sail",color:string,x:number,y:number,z:number,w:number,h:number,d:number,joint?:MeshPart["joint"],rx=0,ry=0,rz=0){
  let g:THREE.BufferGeometry;
  if(shape==="sphere")g=new THREE.SphereGeometry(.5,8,5);
  else if(shape==="cylinder")g=new THREE.CylinderGeometry(.5,.5,1,8);
  else if(shape==="cone")g=new THREE.ConeGeometry(.5,1,8);
  else g=geometryForShape(shape).clone();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(w,h,d)));parts.push({g,color,joint});
}
export function makeAmbientPerson(){
  const parts:MeshPart[]=[],skin="#c8a381",cloth="#9180b0",boots="#584b44";
  piece(parts,"cone",cloth,0,.59,0,.34,.4,.27);
  piece(parts,"box",cloth,0,.72,0,.27,.25,.23);
  piece(parts,"box","#796546",0,.54,.005,.32,.045,.26);
  piece(parts,"sphere",skin,0,.94,.015,.22,.25,.22,[4,0,.84,0]);
  piece(parts,"sphere","#685746",0,1.015,-.025,.23,.12,.22,[4,0,.84,0]);
  for(const side of [-1,1]){
    const x=side*.083;
    piece(parts,"box","#746c70",x,.375,0,.115,.25,.125,[1,side,.5,0]);
    piece(parts,"box","#746c70",x,.155,0,.105,.22,.115,[2,side,.5,.25]);
    piece(parts,"box",boots,x,.045,.04,.125,.09,.21,[2,side,.5,.25]);
    piece(parts,"cylinder",cloth,side*.196,.64,0,.105,.32,.105,[3,side,.79,0],0,0,side*.12);
    piece(parts,"sphere",skin,side*.21,.46,.01,.09,.11,.09,[3,side,.79,0]);
  }
  // A small leather satchel supplies a readable medieval silhouette.
  piece(parts,"box","#8d7253",.18,.53,-.035,.13,.17,.14);
  return merge(parts);
}
function hull(width:number,length:number){
  const p:number[]=[],index:number[]=[],steps=12;
  for(let level=0;level<3;level++)for(let side=0;side<2;side++)for(let j=0;j<=steps;j++){
    const t=j/steps,z=(t-.5)*length,profile=Math.pow(Math.sin(t*Math.PI),.55),w=width*(level===0?.16:level===1?.42:.5);
    p.push((side?1:-1)*Math.max(.015,profile*w),[-.35,-.16,.24][level],z);
  }
  const stride=(steps+1)*2;
  for(let level=0;level<2;level++)for(let side=0;side<2;side++)for(let j=0;j<steps;j++){
    const a=level*stride+side*(steps+1)+j,b=a+1,c=a+stride,d=c+1;
    if(side)index.push(a,c,b,b,c,d);else index.push(a,b,c,b,d,c);
  }
  for(let j=0;j<steps;j++){const a=2*stride+j,b=2*stride+steps+1+j;index.push(a,b,a+1,a+1,b,b+1);}
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(p,3));g.setIndex(index);g.computeVertexNormals();return g;
}
export function makeAmbientVessel(kind:VesselKind){
  const {width:W,length:L,mast:H}=VESSELS[kind],parts:MeshPart[]=[{g:hull(W,L),color:kind==="harbor"?"#655469":"#927351"}];
  piece(parts,"box","#b79a70",0,.26,0,W*.66,.07,L*.68);
  for(const side of [-1,1])for(let j=0;j<6;j++){
    const t=(j+.5)/6,z=(t-.5)*L*.88,x=side*W*.49*Math.pow(Math.sin((t*.88+.06)*Math.PI),.55);
    piece(parts,"box",kind==="harbor"?P.indigo:"#715d4d",x,.3,z,.065,.1,L/6*.94,undefined,0,-side*(t-.5)*.8);
  }
  if(kind==="rowboat"){
    for(const z of [-.55,.05,.58])piece(parts,"box","#80684e",0,.39,z,W*.84,.07,.18);
    for(const side of [-1,1]){
      const joint:[number,number,number,number]=[side<0?2:3,side*W*.43,.35,.05];
      piece(parts,"cylinder","#b59c70",side*W*.85,.36,.1,.045,1.25,.045,joint,0,0,Math.PI/2);
      piece(parts,"box","#af956b",side*(W*.85+.55),.36,.1,.35,.055,.15,joint);
    }
  }else{
    piece(parts,"cylinder","#6a5847",0,.3+H*.5,-L*.05,.065,H,.065);
    piece(parts,"cylinder","#a48c65",0,.3+H*.77,-L*.05,.045,W*1.35,.045,undefined,0,0,Math.PI/2);
    piece(parts,"sail",kind==="fishing"?"#d8cbb0":P.violet,0,.3+H*.55,-L*.05,W*1.3,H*.63,1,[1,0,.3+H,-L*.05]);
    piece(parts,"sail",P.purple,W*.16,.34+H,-L*.05,W*.35,H*.12,1,[1,0,H,-L*.05]);
    if(kind!=="fishing"){
      piece(parts,"box","#998575",0,.56,-L*.3,W*.63,.52,L*.22);
      piece(parts,"box",P.indigo,0,.85,-L*.3,W*.75,.12,L*.27);
      for(const side of [-1,1])piece(parts,"box","#c3b1d1",side*W*.325,.6,-L*.29,.02,.16,L*.11);
      for(const z of [L*.12,L*.29])piece(parts,"box","#ad8e61",W*.19,.48,z,W*.3,.35,L*.1);
      if(kind==="harbor"||kind==="merchant"){
        piece(parts,"cylinder","#6b5b4d",0,.3+H*.38,L*.24,.055,H*.76,.055);
        piece(parts,"sail","#d2bfe8",0,.3+H*.43,L*.24,W*.95,H*.47,1,[1,0,H,L*.24]);
        piece(parts,"box",P.purple,0,.46,L*.38,W*.6,.22,L*.13);
      }
    }
  }
  return merge(parts);
}

export type PortPlan={id:string;island:string;deck:number;start:[number,number];end:[number,number];width:number;walk: [number,number,number][]};
/** Static harbor dressing remains subordinate to the routing architecture. */
export function makeAmbientPorts(ports:PortPlan[]){
  const b=new ArchitectureBuilder();
  for(const p of ports){
    const [x,z]=p.start,[ex,ez]=p.end,L=Math.hypot(ex-x,ez-z),angle=Math.atan2(ex-x,ez-z),y=p.deck;
    b.at(x,y,z,1,angle,()=>{
      for(let j=0;j<Math.ceil(L/.35);j++)b.part("box","wood","#ad9570",0,-.1,(j+.5)/Math.ceil(L/.35)*L,p.width,.2,L/Math.ceil(L/.35)-.015);
      for(const side of [-1,1])for(let d=.2;d<L;d+=1.4){
        b.part("cylinder","wood","#78654f",side*(p.width/2-.12),-1.8,d,.17,4.2,.17);
        b.part("cylinder","iron","#746b7d",side*(p.width/2-.12),.27,d,.2,.08,.2);
      }
      b.part("box","wood","#9b8566",0,-.1,L,p.width+2.0,.2,2.0);
      b.at(-p.width*.33,0,L-.55,.6,.2,()=>b.crate(0,0));
      b.at(p.width*.3,0,L+.35,.58,0,()=>b.barrel(0,0));
      // A compact open-sided cargo canopy leaves the walking aisle clear.
      for(const u of [-.4,.4])for(const v of [-.4,.4])b.part("box","wood","#74604d",-p.width/2-.5+u,.67,L+v,.07,1.4,.07);
      b.part("hipRoof","roof",P.indigo,-p.width/2-.5,1.53,L,1.15,.4,1.2);
      for(const side of [-1,1]){
        b.part("box","wood","#7e6952",side*(p.width/2+.15),.75,L-.7,.065,1.5,.065);
        b.part("sail","cloth",P.purple,side*(p.width/2+.15)+.2,1.1,L-.7,.4,.55,1);
      }
      // Sagging mooring ropes join posts, keeping the access lane open.
      for(const side of [-1,1])for(let d=.3;d<L-1;d+=1.4){
        b.beam([side*(p.width/2-.12),.28,d],[side*(p.width/2-.12),.16,d+.7],.035,"#b8a487");
        b.beam([side*(p.width/2-.12),.16,d+.7],[side*(p.width/2-.12),.28,d+1.4],.035,"#b8a487");
      }
    });
    // Baked stone treads join the shore and dock instead of a floating ramp.
    for(let j=1;j<p.walk.length;j++){
      const a=p.walk[j-1],c=p.walk[j],run=Math.hypot(c[0]-a[0],c[2]-a[2]);
      const top=Math.max(a[1],c[1]),bottom=Math.min(top-.18,-.3),height=top-bottom;
      b.part("box","stone","#bdb59e",(a[0]+c[0])/2,top-height/2,(a[2]+c[2])/2,.78,height,run+.035,0,Math.atan2(c[0]-a[0],c[2]-a[2]));
    }
  }
  return b;
}
