import * as THREE from "three";
import { seededRandom } from "./landscape";

/** Shared opaque crown clusters, with baked inner-canopy occlusion. No alpha
 * overdraw, billboard rotation, per-tree materials or animated CPU transforms.
 */
export function makeFoliageGeometry(conifer:boolean,lowDetail=false) {
  const random=seededRandom(conifer?189:432),positions:number[]=[],colors:number[]=[];
  const count=lowDetail?(conifer?12:10):(conifer?18:14);
  for(let j=0;j<count;j++){
    const level=conifer?Math.floor(j/3)/6:random();
    const a=j*2.39996,r=conifer?(1-level)*.33:Math.sqrt(random())*.32;
    const x=Math.cos(a)*r,z=Math.sin(a)*r,y=conifer?level*.82-.36:(level-.45)*.55;
    const size=conifer?.2*(1-level*.67):.21+random()*.09;
    const cluster=new THREE.IcosahedronGeometry(1,0),p=cluster.attributes.position;
    for(let k=0;k<p.count;k++){
      const jitter=.88+random()*.24;
      positions.push(x+p.getX(k)*size*jitter,y+p.getY(k)*size*(conifer?.52:1.1),z+p.getZ(k)*size*jitter);
      const light=.65+(p.getY(k)+1)*.17+random()*.08;
      colors.push(light*.94,light,light*.86);
    }
    cluster.dispose();
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  geometry.computeBoundingSphere();return geometry;
}
