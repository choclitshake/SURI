import { ArchitectureBuilder } from "./architecture";
import { ISLANDS, terrainHeight } from "./landscape";
import { MASONRY as C, block, foundation, hall, lancet, roundTower } from "./architecturalModules";
import { drawNorthernArchitecture } from "./northernArchitecture";
import { WYRM_TOWER } from "./northernIslands";

type SupportKind="cottage"|"watch"|"lighthouse"|"ruin";
export const COASTAL_OUTPOSTS:Array<{id:string;island:keyof typeof ISLANDS;dx:number;dz:number;scale:number;turn:number;kind:SupportKind}>= [
  {id:"fisher-house",island:"lanternCove",dx:-1,dz:-.15,scale:.43,turn:.3,kind:"cottage"},
  {id:"net-house",island:"lanternCove",dx:1.05,dz:.15,scale:.35,turn:-.25,kind:"cottage"},
  {id:"tide-gate",island:"tidewatch",dx:0,dz:0,scale:.45,turn:-.5,kind:"ruin"},
  {id:"woodland-watch",island:"mossrock",dx:0,dz:0,scale:.38,turn:.2,kind:"watch"},
  {id:"starfall-cottage",island:"starfall",dx:0,dz:0,scale:.4,turn:.25,kind:"cottage"},
  {id:"pebble-light",island:"pebbleKey",dx:0,dz:0,scale:.4,turn:.2,kind:"lighthouse"},
  {id:"silver-ruin",island:"silverhook",dx:0,dz:0,scale:.38,turn:-.3,kind:"ruin"},
  {id:"fern-remains",island:"fernKey",dx:0,dz:0,scale:.32,turn:.3,kind:"ruin"},
  {id:"cairn-cottage",island:"quietCairn",dx:0,dz:0,scale:.32,turn:.2,kind:"cottage"},
];
export function outpostPosition(outpost:typeof COASTAL_OUTPOSTS[number]){
  const island=ISLANDS[outpost.island];return [island.x+outpost.dx,island.z+outpost.dz] as const;
}
export function outpostDistance(x:number,z:number){
  return Math.min(Math.hypot(x-WYRM_TOWER.x,z-WYRM_TOWER.z)-3.4,...COASTAL_OUTPOSTS.map(o=>{const [sx,sz]=outpostPosition(o);return Math.hypot(x-sx,z-sz)-o.scale*2.6;}));
}
export function makeSupportingArchitecture(){
  const b=new ArchitectureBuilder();
  for(const o of COASTAL_OUTPOSTS){
    const [x,z]=outpostPosition(o),s=o.scale,c=Math.cos(o.turn),sn=Math.sin(o.turn);
    let floor=-Infinity;
    for(const u of [-2.05,0,2.05])for(const v of [-1.65,0,1.65])floor=Math.max(floor,terrainHeight(x+(u*c+v*sn)*s,z+(-u*sn+v*c)*s));
    floor+=.08;
    b.at(x,floor,z,s,o.turn,()=>{
      // Deep rubble plinths reach into the islet even where its terrain slopes.
      block(b,0,-.65,0,4.2,1.55,3.6,"#879080");foundation(b,4.35,3.7);
      if(o.kind==="cottage"){
        hall(b,0,.38,0,3.25,2.25,2.55,"#827098");
        for(const side of [-1,1])block(b,side*1.52,1.45,1.3,.12,2.1,.12,C.timber,"wood");
        block(b,0,1.5,1.34,3.22,.12,.12,C.timber,"wood");
        lancet(b,-.5,.4,1.32,.72,1.55,0,true);lancet(b,.8,1.14,1.32,.5,.9);
        block(b,1.1,3.5,-.45,.42,1.25,.45,C.dark);b.barrel(-1.48,1.47);
      }else if(o.kind==="watch"){
        roundTower(b,0,0,4.35,.95,C.slate,false);lancet(b,0,.38,.97,.75,1.65,0,true);
      }else if(o.kind==="lighthouse"){
        b.part("towerShaft","stone","#b0b19c",0,2.65,0,2.1,4.6,2.1);
        b.part("cylinder","stone",C.light,0,4.95,0,2.65,.2,2.65);
        for(let j=0;j<6;j++){
          const a=j*Math.PI/3;
          block(b,Math.sin(a)*.83,5.55,Math.cos(a)*.83,.1,1.05,.1,C.iron,"iron");
        }
        b.part("cylinder","glass","#89988d",0,5.55,0,1.55,.9,1.55);
        b.part("spireRoof","roof",C.slate,0,6.35,0,2.5,1,2.5);
        lancet(b,0,.4,1.03,.72,1.7,0,true);
      }else{
        for(const side of [-1,1]){
          block(b,side*1.4,1.03,0,.6,1.4,2.4,C.dark);
          block(b,side*1.4,1.8,-.65,.65,.35,1.05,C.stone);
        }
        b.part("ogive","stone",C.light,0,.38,-.7,2.25,2.35,1.3);
        block(b,0,.41,.6,1.7,.15,1.65,"#78816f");
        b.part("rock","stone",C.dark,.65,.51,1.2,.7,.45,.55);
      }
    });
  }
  drawNorthernArchitecture(b);
  return b;
}
