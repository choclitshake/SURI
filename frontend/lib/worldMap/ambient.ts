export type AmbientPoint=[number,number,number];
export type AmbientRoute={id:string;kind:"water"|"walk";points:AmbientPoint[];length:number;closed:boolean;clearance:number};
export type VesselKind="rowboat"|"fishing"|"transport"|"merchant"|"harbor";
export type AmbientActor={id:string;model:VesselKind|"person";route:number;duration:number;pause:number;offset:number;scale:number;tint:string;idle?:boolean};
export type AmbientPose={x:number;y:number;z:number;yaw:number;moving:number;gait:number};
const TAU=Math.PI*2;
export function makeAmbientPose():AmbientPose{return {x:0,y:0,z:0,yaw:0,moving:0,gait:0};}
function travel(t:number,duration:number,out:AmbientPose){
  const ramp=Math.min(1.2,duration*.08),denominator=duration-ramp;
  if(t<ramp){out.moving=t/ramp;return .5*t*t/ramp/denominator;}
  if(t>duration-ramp){out.moving=(duration-t)/ramp;return 1-.5*(duration-t)**2/ramp/denominator;}
  out.moving=1;return (t-ramp*.5)/denominator;
}
/** Allocation-free route playback. Routes are uniformly resampled offline;
 * no spline evaluation, terrain query, collision or navigation runs here. */
export function sampleAmbientActor(actor:AmbientActor,route:AmbientRoute,time:number,out:AmbientPose){
  const duration=actor.duration,pause=actor.pause,lapPause=route.closed&&actor.model==="person",cycle=route.closed?duration+(lapPause?pause:0):2*(duration+pause);
  const t=((time+actor.offset)%cycle+cycle)%cycle;
  const turnSeconds=Math.min(actor.model==="person"?3:18,pause||1);
  let u=0,direction=1,turn=0,moving=1,distance=0;
  if(actor.idle){u=.5;moving=0;}
  else if(route.closed){if(lapPause&&t>=duration){u=0;moving=0;}else if(lapPause){u=travel(t,duration,out);moving=out.moving;}else u=t/duration;distance=u*route.length;}
  else if(t<duration){u=travel(t,duration,out);moving=out.moving;distance=u*route.length;}
  else if(t<duration+pause){u=1;moving=0;turn=Math.min(1,(t-duration)/turnSeconds);distance=route.length;}
  else if(t<duration*2+pause){const p=travel(t-duration-pause,duration,out);u=1-p;direction=-1;moving=out.moving;distance=(1+p)*route.length;}
  else{u=0;moving=0;turn=Math.min(1,(t-duration*2-pause)/turnSeconds);direction=-1;distance=2*route.length;}
  const n=route.points.length-1,f=Math.min(n-.000001,Math.max(0,u*n)),i=Math.floor(f),a=route.points[i],b=route.points[i+1],blend=f-i;
  out.x=a[0]+(b[0]-a[0])*blend;out.y=a[1]+(b[1]-a[1])*blend;out.z=a[2]+(b[2]-a[2])*blend;
  const previous=route.points[Math.max(0,i-1)],next=route.points[Math.min(n,i+2)];
  out.yaw=Math.atan2(next[0]-previous[0],next[2]-previous[2])+(direction<0?Math.PI:0)+turn*turn*(3-2*turn)*Math.PI;
  out.moving=moving;out.gait=distance/(.52*actor.scale)*TAU;
  return out;
}
