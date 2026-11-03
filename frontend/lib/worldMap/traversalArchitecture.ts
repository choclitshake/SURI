import { ArchitectureBuilder } from "./architecture";
import { WORLD_PALETTE as P } from "./worldPalette";
import { terrainHeight } from "./landscape";
import { TRAVERSAL, bridgeDeck } from "./traversal";

/** Offline modular assembly. Bridges have full barrel vaults and seabed piers,
 * never a road strip suspended between two decorative posts. */
export function makeTraversalArchitecture(){
  const b=new ArchitectureBuilder();
  for(const bridge of TRAVERSAL.bridges){
    const dx=bridge.b[0]-bridge.a[0],dz=bridge.b[2]-bridge.a[2],angle=Math.atan2(dx,dz),L=bridge.length,W=bridge.width;
    b.at(bridge.a[0],0,bridge.a[2],1,angle,()=>{
      const timber=bridge.kind==="timber",span=L/bridge.spans;
      const count=timber?Math.ceil(L/.37):Math.ceil(L/1.1);
      for(let j=0;j<count;j++){
        const t0=j/count,t1=(j+1)/count,t=(t0+t1)/2,y=bridgeDeck(bridge,t),rise=bridgeDeck(bridge,t1)-bridgeDeck(bridge,t0);
        b.part("box",timber?"wood":"road",timber?"#897358":"#b4ac94",0,y-.11,L*t,W+.12,.22,L/count+.025,timber?0:-Math.atan2(rise,L/count));
        for(const side of [-1,1]){
          const x=side*(W/2+.15);
          b.part("box",timber?"wood":"stone",timber?"#675748":"#9d9e90",x,y+(timber?.81:.33),L*t,timber?.09:.28,timber?.09:.66,L/count+.025,-Math.atan2(rise,L/count));
          if(!timber)b.part("box","stone","#c1baa4",x,y+.7,L*t,.36,.1,L/count+.035,-Math.atan2(rise,L/count));
        }
      }
      for(let j=0;j<=bridge.spans;j++){
        const t=j/bridge.spans,y=bridgeDeck(bridge,t),x=bridge.a[0]+dx*t,z=bridge.a[2]+dz*t;
        const foot=Math.min(-2.8,terrainHeight(x,z)-.45),height=y-.18-foot;
        if(timber){
          for(const side of [-1,1]){
            b.part("box","stone","#858c83",side*W*.39,foot+.35,L*t,.48,.7,.55);
            b.part("box","wood","#685949",side*W*.39,(foot+y)/2,L*t,.2,y-foot+.1,.23);
            b.beam([side*W*.39,y-1.8,L*t],[0,y-.15,L*t],.14);
          }
          b.part("box","wood","#76654d",0,y-.27,L*t,W+.35,.2,.3);
        }else{
          b.part("box","stone","#8e9489",0,foot+height/2,L*t,W+.42,height,.86);
          b.part("box","stone","#b0ac99",0,y-.32,L*t,W+.63,.24,1.12);
          for(const side of [-1,1])b.part("buttress","stone","#a9a594",side*(W/2+.12),foot+Math.min(height,2)/2,L*t,.7,Math.min(height,2),1.2,0,side*Math.PI/2);
          if(j===0||j===bridge.spans)b.part("box","stone",P.lightStone,0,y-.34,L*t,W+1.0,.45,1.45);
          b.part("rock","stone","#818b83",0,foot+.38,L*t,W+.9,.8,1.6,0,j*.31);
        }
      }
      if(!timber)for(let j=0;j<bridge.spans;j++){
        const t0=j/bridge.spans,t1=(j+1)/bridge.spans,t=(t0+t1)/2,y=bridgeDeck(bridge,t);
        const slope=Math.atan2(bridgeDeck(bridge,t1)-bridgeDeck(bridge,t0),span),h=Math.min(2.65,y-.7);
        b.part("bridgeArch","stone","#a3a493",0,y-.2-h/2,L*t,W+.18,h,span-.5,-slope);
        for(const u of [-.78,-.4,0,.4,.78])for(const side of [-1,1]){
          const intrados=y-.2-h+Math.sqrt(1-u*u)*h*.76,tilt=Math.atan2(-u*h*1.52,span*Math.sqrt(1-u*u));
          b.part("box","stone","#d0c5aa",side*(W/2+.12),intrados+.13,L*t+u*(span-.5)/2,.13,.23,.42,tilt);
        }
        // Key stones emphasize the vault without individual masonry draw calls.
        for(const side of [-1,1])b.part("box","stone","#c5bea7",side*(W/2+.13),y-.4,L*t,.16,.43,.38,-slope);
      }
      for(let j=0;j<=count;j+=timber?3:count){
        const t=j/count,y=bridgeDeck(bridge,t);
        for(const side of [-1,1])b.part("box",timber?"wood":"stone",timber?"#645548":"#a7a796",side*(W/2+.16),y+.45,L*t,timber?.11:.45,timber?.94:.9,timber?.13:.45);
      }
      for(const t of [0,1]){
        const y=bridgeDeck(bridge,t);
        for(const side of [-1,1]){
          b.part("box","stone","#9e9f8f",side*(W/2+.4),y+.45,L*t,.42,.9,.5);
          b.part("hipRoof","stone","#c0baa4",side*(W/2+.4),y+.98,L*t,.54,.19,.6);
        }
        b.part("box","wood","#715e48",W/2+.85,y+.7,L*t,.09,1.4,.1);
        b.part("box","wood","#a18a65",W/2+.85,y+1.22,L*t,.66,.22,.08);
        b.part("sail","cloth",P.purple,W/2+.4,y+.28,L*t+.18,.32,.6,1);
        b.part("box","iron","#9c88ae",W/2+.4,y+.62,L*t+.18,.4,.045,.06);
        // Stone lanterns are shaded daylight props; no extra light sources.
        b.part("box","iron","#535c59",-W/2-.4,y+1.22,L*t,.22,.38,.22);
        b.part("box","glass",P.violet,-W/2-.4,y+1.22,L*t+.015,.15,.24,.2);
        b.part("hipRoof","iron","#596461",-W/2-.4,y+1.45,L*t,.32,.12,.32);
      }
    });
  }
  for(const path of TRAVERSAL.paths){
    const distances=[0];for(let j=1;j<path.points.length;j++)distances[j]=distances[j-1]+Math.hypot(path.points[j][0]-path.points[j-1][0],path.points[j][2]-path.points[j-1][2]);
    const at=(distance:number)=>{let j=1;while(j<distances.length-1&&distances[j]<distance)j++;const t=(distance-distances[j-1])/(distances[j]-distances[j-1]||1),a=path.points[j-1],c=path.points[j];return {p:[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t,a[2]+(c[2]-a[2])*t],ground:Math.min(path.ground[j-1],path.ground[j])};};
    const length=distances.at(-1)!;
    for(let distance=0;distance<length;distance+=.3){
      const a=at(distance),c=at(Math.min(length,distance+.3)),dx=c.p[0]-a.p[0],dz=c.p[2]-a.p[2],run=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),rise=Math.abs(c.p[1]-a.p[1]);
      if(run<.01)continue;
      const x=(a.p[0]+c.p[0])/2,z=(a.p[2]+c.p[2])/2,top=Math.max(a.p[1],c.p[1])+.015;
      if(rise/run>.3){const ground=Math.min(a.ground,c.ground);b.part("box","road","#c0b59d",x,(top+ground)/2,z,path.width,Math.max(.15,top-ground),run+.025,0,angle);}
      if(Math.floor(distance/.3)%3===0)for(const side of [-1,1]){
        const px=x+side*Math.cos(angle)*(path.width/2+.1),pz=z-side*Math.sin(angle)*(path.width/2+.1),base=terrainHeight(px,pz)-.12,h=Math.max(.18,top+.1-base);
        b.part("box","stone",P.lightStone,px,top+.1-h/2,pz,.14,h,Math.min(.78,length-distance)+.04,0,angle);
      }
    }
    for(let j=1;j<path.points.length;j++){
      const a=path.points[j-1],c=path.points[j],dx=c[0]-a[0],dz=c[2]-a[2],run=Math.hypot(dx,dz),rise=c[1]-a[1];
      if(run<.01)continue;
      const steep=Math.abs(rise)/run>.32;
      {
        const x=(a[0]+c[0])/2,z=(a[2]+c[2])/2,y=(a[1]+c[1])/2,ground=Math.min(path.ground[j-1],path.ground[j]);
        if(y-ground>.3)b.part("box","stone","#aaa997",x,(ground+y-.025)/2,z,path.width,Math.max(.16,y-ground-.025),run+.025,0,Math.atan2(dx,dz));
      }
      if(j%4===0&&steep){
        const angle=Math.atan2(dx,dz),x=(a[0]+c[0])/2,z=(a[2]+c[2])/2,y=Math.max(a[1],c[1]);
        for(const side of [-1,1]){
          const px=x+side*Math.cos(angle)*(path.width/2+.18),pz=z-side*Math.sin(angle)*(path.width/2+.18),ground=terrainHeight(px,pz)-.15;
          b.part("box","stone","#969e8e",px,(ground+y+.35)/2,pz,.26,Math.max(.3,y+.35-ground),run*4+.12,0,angle);
          b.part("box","stone","#b4b19a",px,y+.4,pz,.32,.1,run*4+.15,0,angle);
        }
      }
    }
  }
  return b;
}
