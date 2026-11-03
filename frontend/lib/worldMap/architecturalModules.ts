import * as THREE from "three";
import type { ArchitectureBuilder, Surface } from "./architecture";

export const MASONRY={stone:"#beb9a5",light:"#ded4bb",dark:"#747e7a",joint:"#73786e",slate:"#71629b",timber:"#665244",iron:"#4e5352",bronze:"#a28b5b",glass:"#a18bbd"};
export function block(b:ArchitectureBuilder,x:number,y:number,z:number,w:number,h:number,d:number,color=MASONRY.stone,surface:Surface="stone"){
  b.part("box",surface,color,x,y,z,w,h,d);
}
export function strut(b:ArchitectureBuilder,a:[number,number,number],c:[number,number,number],width:number,depth=width,color=MASONRY.stone,surface:Surface="stone"){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...c),mid=start.clone().add(end).multiplyScalar(.5);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize()),e=new THREE.Euler().setFromQuaternion(q);
  b.part("box",surface,color,mid.x,mid.y,mid.z,width,start.distanceTo(end),depth,e.x,e.y,e.z);
}
export function lancet(b:ArchitectureBuilder,x:number,y:number,z:number,w=.6,h=1.65,rotation=0,door=false){
  b.at(x,y,z,1,rotation,()=>{
    b.part("gothic",door?"wood":"glass",door?"#3f362e":MASONRY.glass,0,.08,.025,w*.78,h*.88,1);
    b.part("ogive","stone",MASONRY.light,0,0,.06,w,h,1);
    if(door){
      for(const side of [-1,1])for(const yy of [.4,.85])block(b,side*w*.19,yy*h,.075,w*.35,.045,.035,MASONRY.iron,"iron");
      block(b,0,h*.4,.085,.025,h*.65,.025,"#211e1b","wood");
    }else{
      block(b,0,h*.42,.07,.045,h*.71,.065,MASONRY.light);
      block(b,0,h*.42,.075,w*.66,.045,.07,MASONRY.light);
    }
    block(b,0,.01,.12,w*1.15,.12,.27,MASONRY.light);
  });
}
export function cornice(b:ArchitectureBuilder,x:number,y:number,z:number,w:number,d:number,color=MASONRY.light){
  block(b,x,y,z,w,.14,d,color);block(b,x,y-.15,z,w-.1,.12,d-.1,MASONRY.dark);
}
export function roundTower(b:ArchitectureBuilder,x:number,z:number,height:number,radius:number,roof=MASONRY.slate,pointed=true){
  b.at(x,0,z,1,0,()=>{
    b.part("towerShaft","stone",MASONRY.stone,0,height/2,0,radius*2,height,radius*2);
    for(const yy of [.2,height*.46,height-.18])b.part("cylinder","stone",MASONRY.light,0,yy,0,radius*2.05,.16,radius*2.05);
    for(let a=0;a<4;a++){
      const angle=a*Math.PI/2;
      lancet(b,Math.sin(angle)*radius*.94,height*.55,Math.cos(angle)*radius*.94,.4,1.15,angle);
      if(height>6.5){
        lancet(b,Math.sin(angle)*radius*.97,height*.24,Math.cos(angle)*radius*.97,.33,1.05,angle);
        block(b,Math.sin(angle+.65)*radius*.97,height*.24,Math.cos(angle+.65)*radius*.97,.15,height*.43,.15,MASONRY.dark);
      }
    }
    if(pointed){
      b.part("spireRoof","roof",roof,0,height+1.05,0,radius*2.55,2.25,radius*2.55);
      b.part("cylinder","iron",MASONRY.iron,0,height+2.22,0,.045,.3,.045);
    }else{
      b.part("cylinder","stone",MASONRY.dark,0,height+.08,0,radius*1.6,.12,radius*1.6);
      for(let j=0;j<10;j++){
        const a=j*Math.PI/5;
        block(b,Math.sin(a)*radius*.9,height+.28,Math.cos(a)*radius*.9,.27,.5,.27,MASONRY.light);
      }
    }
  });
}
export function hall(b:ArchitectureBuilder,x:number,y:number,z:number,w:number,h:number,d:number,roof=MASONRY.slate){
  block(b,x,y+h/2,z,w,h,d);
  cornice(b,x,y+.18,z,w+.2,d+.18);cornice(b,x,y+h,z,w+.25,d+.25);
  b.part("hipRoof","roof",roof,x,y+h+.85,z,w+.55,1.7,d+.55);
  // Lead ridge and eaves are structural details, not repeated roof ornaments.
  block(b,x,y+h+1.71,z,.11,.1,d*.49,MASONRY.iron,"iron");
}
export function battlement(b:ArchitectureBuilder,a:[number,number],c:[number,number],y:number,height=1.45){
  const length=Math.hypot(c[0]-a[0],c[1]-a[1]),angle=Math.atan2(c[0]-a[0],c[1]-a[1]);
  b.at((a[0]+c[0])/2,y,(a[1]+c[1])/2,1,angle,()=>{
    block(b,0,height/2,0,.36,height,length);
    for(let z=-length/2+.17;z<length/2;z+=.7)block(b,0,height+.2,z,.43,.4,.34,MASONRY.light);
    block(b,0,height-.1,0,.48,.12,length+.12,MASONRY.light);
  });
}
export function staircase(b:ArchitectureBuilder,zStart:number,zEnd:number,width:number,rise=.58,steps=7,x=0){
  const run=(zEnd-zStart)/steps;
  for(let j=0;j<steps;j++){
    const top=rise*(1-j/steps);
    block(b,x,top/2-.04,zStart+(j+.5)*run,width,top+.08,Math.abs(run)+.025,j%3?MASONRY.stone:MASONRY.light);
  }
}
export function foundation(b:ArchitectureBuilder,w:number,d:number,color=MASONRY.dark){
  block(b,0,-.14,0,w,.64,d,color);
  block(b,0,.22,0,w-.18,.14,d-.18,"#a9a38f");
  // Raised paving with a recessed drainage margin anchors every facade.
  block(b,0,.31,0,w-.5,.1,d-.5,"#9b9783");
}
export function inscription(b:ArchitectureBuilder,x:number,y:number,z:number,w:number,h:number,rotation=0){
  b.part("inscription","carving","#666b62",x,y,z,w,h,1,0,rotation,0);
}
