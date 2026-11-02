import * as THREE from "three";
import { LANDMARK_BOUNDS,LANDMARK_SCALE,projectWorldPoint } from "./framing";
export type DashboardLandmark="keep"|"topics"|"records"|"champions"|"calculator";
function hull(points:THREE.Vector2[]){
  const sorted=points.sort((a,b)=>a.x-b.x||a.y-b.y),cross=(o:THREE.Vector2,a:THREE.Vector2,b:THREE.Vector2)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const half=(p:THREE.Vector2[])=>{const result:THREE.Vector2[]=[];for(const v of p){while(result.length>1&&cross(result[result.length-2],result[result.length-1],v)<=0)result.pop();result.push(v);}return result.slice(0,-1);};
  return [...half(sorted),...half([...sorted].reverse())];
}
// With a fixed camera orientation, only pixel scale and translation change.
// Convex footprints are computed once and used by native pointer hit testing.
export const PROJECTED_LANDMARKS=Object.fromEntries((Object.keys(LANDMARK_BOUNDS) as Array<keyof typeof LANDMARK_BOUNDS>).map(kind=>{
  const [w,h,d]=LANDMARK_BOUNDS[kind],points=[];
  for(const x of [-w/2,w/2])for(const y of [.7,h])for(const z of [-d/2,d/2])points.push(projectWorldPoint(new THREE.Vector3(x,y,z).multiplyScalar(LANDMARK_SCALE)));
  const polygon=hull(points),bounds=new THREE.Box2().setFromPoints(polygon),width=bounds.max.x-bounds.min.x,height=bounds.max.y-bounds.min.y;
  return [kind,{minX:bounds.min.x,maxY:bounds.max.y,width,height,clip:`polygon(${polygon.map(p=>`${(p.x-bounds.min.x)/width*100}% ${(bounds.max.y-p.y)/height*100}%`).join(",")})`}];
})) as Record<DashboardLandmark,{minX:number;maxY:number;width:number;height:number;clip:string}>;
