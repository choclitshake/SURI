import compiled from "./generated/traversal.json";
export type WalkPoint=[number,number,number];
export type WalkPath={id:string;island:string;from:string;to:string;width:number;points:WalkPoint[];ground:number[]};
export type Bridge={id:string;from:string;to:string;islands:[string,string];kind:"stone"|"fortified"|"timber";width:number;a:WalkPoint;b:WalkPoint;length:number;spans:number};
export type TraversalPlan={version:number;nodes:Array<{id:string;island:string;point:WalkPoint}>;bridges:Bridge[];paths:WalkPath[]};
export const TRAVERSAL=compiled as unknown as TraversalPlan;

// A small static spatial index reserves corridor space during one-time scenery
// placement. It is never queried by pointer input or on a rendering frame.
type Segment={ax:number;az:number;bx:number;bz:number;radius:number};
const bins=new Map<string,Segment[]>();
for(const path of TRAVERSAL.paths)for(let j=1;j<path.points.length;j++){
  const a=path.points[j-1],b=path.points[j],segment={ax:a[0],az:a[2],bx:b[0],bz:b[2],radius:path.width/2};
  for(let x=Math.floor((Math.min(a[0],b[0])-2)/4);x<=Math.floor((Math.max(a[0],b[0])+2)/4);x++)
    for(let z=Math.floor((Math.min(a[2],b[2])-2)/4);z<=Math.floor((Math.max(a[2],b[2])+2)/4);z++){
      const key=`${x}:${z}`,bucket=bins.get(key);if(bucket)bucket.push(segment);else bins.set(key,[segment]);
    }
}
export function traversalClearance(x:number,z:number){
  let clearance=Infinity;
  for(const s of bins.get(`${Math.floor(x/4)}:${Math.floor(z/4)}`)??[]){
    const dx=s.bx-s.ax,dz=s.bz-s.az,t=Math.max(0,Math.min(1,((x-s.ax)*dx+(z-s.az)*dz)/(dx*dx+dz*dz||1)));
    clearance=Math.min(clearance,Math.hypot(x-s.ax-dx*t,z-s.az-dz*t)-s.radius);
  }
  return clearance;
}
export function bridgeDeck(bridge:Bridge,t:number){
  const y=bridge.a[1]+(bridge.b[1]-bridge.a[1])*t+Math.sin(t*Math.PI)*(bridge.kind==="timber"?.55:.24);
  return bridge.kind==="timber"&&t>0&&t<1?Math.ceil(y/.14)*.14:y;
}
