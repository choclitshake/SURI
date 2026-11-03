import * as THREE from "three";
import { ISLANDS, PRIMARY_ISLANDS, coastlineRadius, islandHeight, islandScore, type Island } from "./landscape";

const grass = new THREE.Color("#77965a"), moss = new THREE.Color("#506e4f");
const sand = new THREE.Color("#d9c99d"), wetSand = new THREE.Color("#9aa995");
const limestone = new THREE.Color("#aaa991"), slate = new THREE.Color("#747f83");
const strata = new THREE.Color("#6d7973");
function surfaceColor(x:number,y:number,z:number,i:Island,coast:number,color:THREE.Color,weights:number[]) {
  const slope=Math.hypot(islandHeight(x+0.12,z,i)-islandHeight(x-0.12,z,i),islandHeight(x,z+0.12,i)-islandHeight(x,z-0.12,i))/0.24;
  color.copy(grass).lerp(moss,(Math.sin(x*0.37+z*0.18)+1)*0.22);
  if(i.biome==="citadel")color.multiplyScalar(1.05);
  if(i.biome==="ruins")color.lerp(limestone,0.27);
  const beach=i.biome==="sanctuary"?2.3:0.6;
  if(y<0.65&&coast<beach)color.copy(sand).lerp(wetSand,1-THREE.MathUtils.smoothstep(y,-0.3,0.6));
  else {
    const rock=THREE.MathUtils.smoothstep(slope,0.65,1.65);
    color.lerp(i.biome==="peaks"?slate:limestone,rock);
    if(i.biome==="peaks")color.lerp(slate,THREE.MathUtils.smoothstep(y,6.8,9.5)*0.85);
    if(i.biome==="stack")color.copy(slate).lerp(limestone,0.3);
    // Horizontal beds remain visible along naturally eroded coastal faces.
    const bed=(Math.floor((y+0.12*Math.sin(x*0.45+z*0.3))/0.82)%3+3)%3;
    if(bed===0)color.lerp(strata,rock*0.34);
    if(bed===2)color.multiplyScalar(1+rock*0.09);
  }
  color.multiplyScalar(0.97+0.035*Math.sin(x*4.8+z*3.2));
  const rock=Math.max(THREE.MathUtils.smoothstep(slope,0.6,1.8),i.biome==="stack"?0.9:i.biome==="peaks"?THREE.MathUtils.smoothstep(y,6,10)*.85:0);
  const sandWeight=(1-THREE.MathUtils.smoothstep(y,.45,1.25))*(1-rock);
  const soil=(i.biome==="ruins"?.35:.12)+(Math.sin(x*.31+Math.cos(z*.24)*2)+1)*.13;
  const moisture=Math.exp(-Math.max(0,coast)/3)*.6+(1-THREE.MathUtils.smoothstep(y,4,12))*.2;
  weights.push(rock,sandWeight,soil,moisture);
}

/** Coast-aligned rings put vertices into cliff faces rather than empty ocean.
 * Every island is joined into one static indexed mesh, including its rock skirt.
 * Low detail reduces tessellation only; geography and elevations stay identical.
 */
export function makeArchipelagoTerrain(lowDetail=false,onlyIsland?:keyof typeof ISLANDS) {
  const positions:number[]=[],colors:number[]=[],weights:number[]=[],surfaceUv:number[]=[],indices:number[]=[],color=new THREE.Color();
  const islands=onlyIsland?[ISLANDS[onlyIsland]]:Object.values(ISLANDS);
  for(const i of islands) {
    const primary=Object.values(PRIMARY_ISLANDS).includes(i);
    const segments=primary?(lowDetail?80:128):(lowDetail?28:40);
    const rings=primary
      ? (lowDetail?[0.12,0.24,0.36,0.48,0.58,0.66,0.72,0.77,0.81,0.85,0.88,0.91,0.94,0.96,0.98,1]:[0.07,0.14,0.21,0.28,0.35,0.42,0.49,0.55,0.6,0.65,0.69,0.73,0.77,0.8,0.83,0.86,0.89,0.91,0.93,0.95,0.97,0.985,1])
      : [0.18,0.36,0.53,0.68,0.79,0.87,0.93,1];
    const minRadius=Math.min(i.rx,i.rz);
    const radii=[...rings,1+0.6/minRadius,1+1.3/minRadius,1+2.5/minRadius];
    const offset=positions.length/3;
    const add=(x:number,z:number)=>{
      const coast=islandScore(x,z,i),y=islandHeight(x,z,i,coast);
      positions.push(x,y,z);surfaceUv.push(x*.777-z*.629+Math.sin(z*.17+x*.09)*1.1,x*.629+z*.777+Math.sin(x*.11-z*.075)*1.3);surfaceColor(x,y,z,i,coast,color,weights);colors.push(color.r,color.g,color.b);
    };
    add(i.x,i.z);
    for(let ring=0;ring<radii.length;ring++)for(let a=0;a<segments;a++){
      const angle=a/segments*Math.PI*2,radius=coastlineRadius(angle,i)*radii[ring];
      const u=Math.cos(angle)*i.rx*radius,v=Math.sin(angle)*i.rz*radius,c=Math.cos(i.turn),s=Math.sin(i.turn);
      add(i.x+u*c-v*s,i.z+u*s+v*c);
      const current=offset+1+ring*segments+a,next=offset+1+ring*segments+(a+1)%segments;
      if(ring===0)indices.push(offset,next,current);
      else {const inner=current-segments,innerNext=next-segments;indices.push(inner,next,current,inner,innerNext,next);}
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute("environmentWeights",new THREE.Float32BufferAttribute(weights,4));
  geometry.setAttribute("surfaceUv",new THREE.Float32BufferAttribute(surfaceUv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

/** A static stream follows the citadel's terrace and spills down its sea cliff. */
export function makeCitadelWater(lowDetail=false,surface?:(x:number,z:number)=>number) {
  const i=PRIMARY_ISLANDS.progress,positions:number[]=[],indices:number[]=[];
  const steps=lowDetail?72:128;
  let end=14;
  for(let distance=3;distance<17;distance+=0.1){
    if(islandScore(i.x+3+Math.sin((distance-3)/14*3)*0.7,i.z+distance,i)<-0.2){end=distance-3;break;}
  }
  for(let j=0;j<=steps;j++){
    const t=j/steps,z=i.z+3+t*end,x=i.x+3+Math.sin(t*end/14*3)*0.7;
    for(const side of [-1,1]){
      const px=x+side*(0.36+t*0.13),coast=islandScore(px,z,i);
      positions.push(px,Math.max(-0.17,(surface?.(px,z)??islandHeight(px,z,i,coast))+0.08),z);
    }
    if(j<steps){const n=j*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
