import * as THREE from "three";

export const ARCHITECTURAL_SHAPES=["gothic","ogive","dome","hipRoof","buttress","obelisk","towerShaft","spireRoof","inscription","scholarRelief","astralRelief","heraldry","bridgeArch"] as const;
export type ArchitecturalShape=typeof ARCHITECTURAL_SHAPES[number];

function pointedOutline(inset=0) {
  const s=new THREE.Shape(),left=-.5+inset,right=.5-inset,bottom=inset,shoulder=.54,tip=1-inset;
  s.moveTo(left,bottom);s.lineTo(right,bottom);s.lineTo(right,shoulder);
  s.quadraticCurveTo(right*.78,.82,0,tip);s.quadraticCurveTo(left*.78,.82,left,shoulder);s.closePath();
  return s;
}
function polyhedron(vertices:number[],indices:number[]) {
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);
  const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return flat;
}
/** Unit modules share one geometry per type. Ogives have real open centers;
 * window/door recesses and domes use a bottom-at-zero vertical convention.
 */
export function makeArchitecturalGeometry(shape:ArchitecturalShape):THREE.BufferGeometry {
  if(shape==="bridgeArch"){
    const p:number[]=[],idx:number[]=[],steps=20;
    for(let j=0;j<=steps;j++){
      const z=j/steps-.5,intrados=-.5+Math.sqrt(Math.max(0,1-(z*2)**2))*.76;
      p.push(-.5,.5,z,.5,.5,z,-.5,intrados,z,.5,intrados,z);
      if(j<steps){const n=j*4;
        idx.push(n,n+1,n+4,n+1,n+5,n+4,n+2,n+6,n+3,n+3,n+6,n+7,
          n,n+4,n+2,n+2,n+4,n+6,n+1,n+3,n+5,n+3,n+7,n+5);
      }
    }
    idx.push(0,2,1,1,2,3);const n=steps*4;idx.push(n,n+1,n+2,n+1,n+3,n+2);
    for(let j=0;j<idx.length;j+=3)[idx[j+1],idx[j+2]]=[idx[j+2],idx[j+1]];
    return polyhedron(p,idx);
  }
  if(shape==="gothic")return new THREE.ShapeGeometry(pointedOutline(),8);
  if(shape==="ogive"){
    const s=pointedOutline(),hole=new THREE.Path();
    const points=pointedOutline(.105).getPoints(8).reverse();hole.setFromPoints(points);s.holes.push(hole);
    const g=new THREE.ExtrudeGeometry(s,{depth:.16,bevelEnabled:false,curveSegments:8});g.translate(0,0,-.08);return g;
  }
  if(shape==="dome"){
    const g=new THREE.SphereGeometry(.5,24,10,0,Math.PI*2,0,Math.PI/2);g.scale(1,2,1);return g;
  }
  if(shape==="towerShaft")return new THREE.CylinderGeometry(.45,.5,1,24,1);
  if(shape==="spireRoof")return new THREE.LatheGeometry([
    new THREE.Vector2(.5,-.5),new THREE.Vector2(.45,-.42),new THREE.Vector2(.33,-.18),
    new THREE.Vector2(.18,.13),new THREE.Vector2(.025,.47),new THREE.Vector2(0,.5),
  ],24);
  if(["inscription","scholarRelief","astralRelief","heraldry"].includes(shape)){
    const g=new THREE.PlaneGeometry(1,1),uv=g.attributes.uv;
    const tile=shape==="inscription"?[0,1]:shape==="scholarRelief"?[1,1]:shape==="astralRelief"?[0,0]:[1,0];
    for(let j=0;j<uv.count;j++)uv.setXY(j,(.02+uv.getX(j)*.96+tile[0])*.5,(.02+uv.getY(j)*.96+tile[1])*.5);
    return g;
  }
  if(shape==="hipRoof")return polyhedron([
    -.5,-.5,-.5, .5,-.5,-.5, .5,-.5,.5, -.5,-.5,.5, 0,.5,-.23, 0,.5,.23,
  ],[0,4,1, 1,4,5,1,5,2, 2,5,3, 3,5,4,3,4,0, 0,1,2,0,2,3]);
  if(shape==="obelisk")return polyhedron([
    -.5,-.5,-.5,.5,-.5,-.5,.5,-.5,.5,-.5,-.5,.5,
    -.31,.31,-.31,.31,.31,-.31,.31,.31,.31,-.31,.31,.31,0,.5,0,
  ],[0,4,5,0,5,1, 1,5,6,1,6,2, 2,6,7,2,7,3, 3,7,4,3,4,0, 4,8,5,5,8,6,6,8,7,7,8,4, 0,1,2,0,2,3]);
  // Sloping external buttress: broad at the footing, tapered at the eaves.
  return polyhedron([
    -.5,-.5,-.5,.5,-.5,-.5,.5,-.5,.5,-.5,-.5,.5,
    -.5,.5,-.5,.5,.5,-.5,.5,.5,-.22,-.5,.5,-.22,
  ],[0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,7,6,4,6,5,0,1,2,0,2,3]);
}
