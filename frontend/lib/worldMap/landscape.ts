import * as THREE from "three";
import { WORLD_BOUNDS } from "./framing";
import { NORTHERN_ISLANDS } from "./northernIslands";
export { WORLD_BOUNDS } from "./framing";
export type MapPoint = [number, number];
export type Biome = "highlands" | "ruins" | "peaks" | "citadel" | "sanctuary" | "stack" | "reef";
export type Island = { x:number; z:number; rx:number; rz:number; turn:number; seed:number; hill:number; biome:Biome };
function island(x:number,z:number,rx:number,rz:number,turn:number,seed:number,hill:number,biome:Biome):Island {
  return {x,z,rx,rz,turn,seed,hill,biome};
}

// Five comparable landmasses. Landmark coordinates and foundation elevations
// remain identical to the previous world so every camera handoff is unchanged.
export const PRIMARY_ISLANDS = {
  hub: island(1,-1,17,14.5,-0.28,1,5.3,"sanctuary"),
  progress: island(-39,-3,16.2,14.5,-0.48,2,5.8,"citadel"),
  topics: island(-11,-33,18,13,0.24,3,6.4,"highlands"),
  records: island(41,-1,15.8,14,0.42,4,5.1,"ruins"),
  calculator: island(15,32,18,13,-0.32,5,6.2,"peaks"),
};

// Authored families, rather than a ring of evenly spaced miniature islands.
// Small reefs sit below the tide; stacks share the submerged bedrock profile.
export const SECONDARY_ISLANDS = {
  lanternCove: island(-28,19,5.1,3.1,0.5,6,2.5,"sanctuary"),
  lanternTooth: island(-33,22,1.4,2.2,-0.3,26,3.8,"stack"),
  lanternReef: island(-24,23,2.1,1.1,0.1,46,0.12,"reef"),
  tidewatch: island(34,-23,4.3,3.1,-0.6,7,3.1,"ruins"),
  tideTeeth: island(39,-25,1.1,1.7,0.4,27,4.5,"stack"),
  tideShelf: island(31,-27,2.3,1.2,-0.4,47,0.35,"reef"),
  mossrock: island(-35,-26,3.1,2.7,0.6,8,3.5,"highlands"),
  mossNeedle: island(-39,-24,1.1,1.5,0.3,28,4.1,"stack"),
  mossShelf: island(-33,-22,1.5,0.9,0.7,48,0.16,"reef"),
  starfall: island(-9,28,4.2,2.8,-0.2,9,2.2,"sanctuary"),
  starTeeth: island(-13,32,1.1,1.6,-0.7,29,3.1,"stack"),
  starShoal: island(-6,26,1.3,0.8,-0.4,49,0.1,"reef"),
  pebbleKey: island(37,24,3.7,2.8,0.5,10,3.1,"peaks"),
  pebbleFin: island(41,22,1.5,0.8,0.8,30,3.4,"stack"),
  pebbleReef: island(39,28,1.2,1.7,0.2,50,0.2,"reef"),
  wispReef: island(-54,18,3.8,2.6,-0.2,11,2.4,"citadel"),
  wispTooth: island(-57,22,1.1,1.5,0.5,31,3.1,"stack"),
  emberKey: island(-53,-24,2.3,2,0.45,12,2.7,"stack"),
  emberFoothill: island(-56,-27,1.4,0.9,-0.4,32,0.5,"reef"),
  moonShoal: island(-26,-43,3.2,2,-0.35,13,2.5,"highlands"),
  moonSkerry: island(-29,-41,1,1.4,0.7,33,2.9,"stack"),
  cloudrest: island(15,-46,2.6,1.9,0.2,14,2.8,"stack"),
  cloudShelf: island(18,-43,1.5,0.9,-0.2,34,0.12,"reef"),
  silverhook: island(24,-32,3.7,2.2,-0.48,15,2.4,"ruins"),
  silverTooth: island(27,-35,1.2,1.7,0.5,35,3.5,"stack"),
  prismCay: island(55,21,2.7,2.3,0.2,16,2.5,"peaks"),
  prismReef: island(57,24,0.9,1.4,-0.1,36,0.2,"reef"),
  heronRock: island(50,35,2.5,1.6,-0.1,17,3.4,"stack"),
  fernKey: island(-2,43,2.4,1.9,0.45,18,1.7,"sanctuary"),
  fernShelf: island(-5,45,1.2,0.8,0,38,0.18,"reef"),
  gullwatch: island(29,43,2.4,1.9,-0.38,19,2.8,"stack"),
  quietCairn: island(-49,33,2.8,2.1,0.3,20,2,"citadel"),
  quietTooth: island(-53,35,1,1.5,0.8,40,3.5,"stack"),
  ...NORTHERN_ISLANDS,
};
export const ISLANDS = {...PRIMARY_ISLANDS,...SECONDARY_ISLANDS};
const allIslands = Object.values(ISLANDS);
export const SITES = {
  keep:[0,-3], academy:[-12,-9], guild:[-12,5], ranger:[11,-4], arena:[3,12],
  champions:[-43,-5], topics:[-11,-35], records:[47,1], calculator:[16,34],
} satisfies Record<string,MapPoint>;
export const OUTER_HEIGHTS = {topics:4.8, records:3.3, champions:4.2, calculator:4.5};
export const LANDMARK_SITE_KEYS = ["keep","topics","records","champions","calculator"] as const;
export type RoutingSite = typeof LANDMARK_SITE_KEYS[number];
export const SITE_ISLAND = {keep:"hub",topics:"topics",records:"records",champions:"progress",calculator:"calculator"} as const;
export const FOUNDATION_HEIGHTS = {keep:6.15,...OUTER_HEIGHTS};

export function coastlineRadius(angle:number,i:Island) {
  const phase=i.seed*1.37;
  // Distinct headlands and a broad inlet, with smaller erosion along the shore.
  const inlet=Math.pow(Math.max(0,Math.cos(angle-phase*0.6)),12);
  return 0.96+0.12*Math.sin(3*angle+phase)+0.085*Math.cos(2*angle-phase)
    +0.052*Math.sin(5*angle+phase*0.7)+0.026*Math.cos(9*angle-phase)-0.17*inlet;
}
export function islandScore(x:number,z:number,i:Island) {
  const dx=x-i.x,dz=z-i.z,c=Math.cos(i.turn),s=Math.sin(i.turn);
  const u=(dx*c+dz*s)/i.rx,v=(-dx*s+dz*c)/i.rz;
  return Math.min(i.rx,i.rz)*(1-Math.hypot(u,v)/coastlineRadius(Math.atan2(v,u),i));
}
export function islandAt(x:number,z:number) {
  let nearest=allIslands[0],score=-Infinity;
  for(const i of allIslands){const next=islandScore(x,z,i);if(next>score){score=next;nearest=i;}}
  return {island:nearest,coast:score};
}
export function shoreDistance(x:number,z:number) {return islandAt(x,z).coast;}
export function segmentDistance(x:number,z:number,a:MapPoint,b:MapPoint) {
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}
const smooth=THREE.MathUtils.smoothstep;
function mound(x:number,z:number,cx:number,cz:number,rx:number,rz:number,height:number) {
  return height*Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2)*2);
}
function ridge(x:number,z:number,cx:number,cz:number,rx:number,rz:number,turn:number,height:number) {
  const dx=x-cx,dz=z-cz,c=Math.cos(turn),s=Math.sin(turn);
  const u=(dx*c+dz*s)/rx,v=(-dx*s+dz*c)/rz;
  // A rounded crest and broad talus apron, with longitudinal weathered gullies.
  const mass=Math.exp(-1.75*(u*u+v*v));
  const gullies=(Math.sin(u*13+Math.sin(v*5))*.07+Math.sin(u*23-v*4)*.025)*Math.min(1,Math.abs(v)*2);
  return height*mass*(1+gullies);
}
export function islandHeight(x:number,z:number,i:Island,coast=islandScore(x,z,i)) {
  // A continuous rock skirt reaches below the water plane at -0.2.
  if(coast<=0)return THREE.MathUtils.lerp(-2.3,0.05,smooth(coast,-2.5,0));
  const dx=x-i.x,dz=z-i.z;
  if(i.biome==="reef")return -0.18+i.hill*smooth(coast,0,0.8);
  const swell=(Math.sin(x*0.48+Math.cos(z*0.26))+Math.cos(z*0.39-x*0.17))*0.28;
  const beach=i.biome==="sanctuary"?2.2:i.biome==="ruins"?0.7:0.35;
  // Uneven ledges and gullies break up the faces without random vertex noise.
  const erosion=(Math.sin(x*1.6+z*0.53)+Math.sin(z*1.35-x*0.7))*0.13;
  const cliff=smooth(coast+erosion,beach,beach+0.74);
  let h=0.12+0.3*smooth(coast,0,beach)+cliff*(i.hill*0.58+swell);
  const inner=smooth(coast,1.2,4.5);
  if(i.biome==="highlands") {
    const terrace=smooth(coast,3.3,3.65)*0.9+smooth(coast,5.9,6.25)*0.8;
    h+=inner*(terrace+mound(dx,dz,6,-4,7,5,3.1));
  } else if(i.biome==="ruins") {
    h+=inner*(mound(dx,dz,-6,-3,4.8,10,4.8)+mound(dx,dz,4,-7,7,3,3.8));
    h-=inner*mound(dx,dz,-2,3,2.8,7,1.5);
  } else if(i.biome==="peaks") {
    const main=ridge(dx,dz,3,-7.2,8.8,3.8,-.3,8.2);
    const shoulder=ridge(dx,dz,-5,-6.3,5.7,3.2,.48,5.8);
    const spur=ridge(dx,dz,9,-3.5,5.3,3.2,-.5,4.4);
    // A broad saddle remains open on the observatory's inhabited approach.
    // The mountain mass sits beside the road rather than raising its abutment.
    const saddle=i===PRIMARY_ISLANDS.calculator?smooth(segmentDistance(x,z,[16,34],[11.7,22.5]),1.5,4.4):1;
    h+=inner*saddle*(Math.max(main,shoulder,spur)+.22*Math.min(main,shoulder)+mound(dx,dz,1,-5,12,6,.8));
  } else if(i.biome==="citadel") {
    h+=inner*(mound(dx,dz,6,-3,8,6,4.1)+smooth(coast,4.6,5)*1.1);
  } else if(i.biome==="sanctuary") {
    h+=inner*(mound(dx,dz,7,-3,6,7,2.6)+mound(dx,dz,-6,-4,4,7,1.8));
  } else if(i.biome==="stack") {
    h+=i.hill*0.7*Math.pow(Math.max(0,coast/Math.min(i.rx,i.rz)),0.7);
  }
  for(const key of LANDMARK_SITE_KEYS) {
    if(PRIMARY_ISLANDS[SITE_ISLAND[key]]!==i)continue;
    const [sx,sz]=SITES[key],distance=Math.hypot(x-sx,z-sz);
    h=THREE.MathUtils.lerp(FOUNDATION_HEIGHTS[key],h,smooth(distance,5.25,7.8));
  }
  if(i===NORTHERN_ISLANDS.wyrmrest)h=THREE.MathUtils.lerp(3.35,h,smooth(Math.hypot(dx,dz),2.25,4.2));
  return h;
}
export function terrainHeight(x:number,z:number,coast?:number) {
  const sample=islandAt(x,z);
  if(coast!==undefined&&coast<=0)return THREE.MathUtils.lerp(-2.3,0.05,smooth(coast,-2.5,0));
  return islandHeight(x,z,sample.island,coast??sample.coast);
}
export function terrainSlope(x:number,z:number) {
  return Math.hypot(terrainHeight(x+0.35,z)-terrainHeight(x-0.35,z),terrainHeight(x,z+0.35)-terrainHeight(x,z-0.35))/0.7;
}

// Short trails belong to their own island; ocean channels remain open.
// Existing destination entrances face toward the former civic center.
export const ROADS = LANDMARK_SITE_KEYS.map(key=>{
  const [sx,sz]=SITES[key],angle=key==="keep"?0:Math.atan2(-sx,-sz);
  const c=Math.cos(angle),s=Math.sin(angle);
  const points:MapPoint[]=[[0,2.4],[0,5.6],[1.6,7.2],[3.6,7.8]];
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(sx+x*c+z*s,0,sz-x*s+z*c)),false,"centripetal");
  return curve.getSpacedPoints(36).filter(p=>islandScore(p.x,p.z,PRIMARY_ISLANDS[SITE_ISLAND[key]])>1.2)
    .map(p=>p.setY(terrainHeight(p.x,p.z)+0.09));
});
export function roadDistance(x:number,z:number) {
  let distance=Infinity;
  for(const road of ROADS)for(let j=1;j<road.length;j++)distance=Math.min(distance,segmentDistance(x,z,[road[j-1].x,road[j-1].z],[road[j].x,road[j].z]));
  return distance;
}
export function roadHeight(x:number,z:number,ground=terrainHeight(x,z)){return ground+0.09;}
export function siteDistance(x:number,z:number){return Math.min(...LANDMARK_SITE_KEYS.map(key=>Math.hypot(x-SITES[key][0],z-SITES[key][1])));}
export function sitePosition(site:keyof typeof SITES):[number,number,number]{const [x,z]=SITES[site];return [x,terrainHeight(x,z)+0.06,z];}
export function seededRandom(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function insideWorld(x:number,z:number){return x>WORLD_BOUNDS.minX+2&&x<WORLD_BOUNDS.maxX-2&&z>WORLD_BOUNDS.minZ+2&&z<WORLD_BOUNDS.maxZ-2;}

// Retained placement helpers remain available to non-dashboard callers. Harbor
// grading no longer mutates the shared terrain after geometry has been sampled.
export const HARBOR_PATH_ORIGIN:MapPoint=[3.6,4.8];
export function registerHarborGrade(path:THREE.Vector3[]){for(const p of path)p.y=terrainHeight(p.x,p.z)+0.09;}
