import * as THREE from "three";
import type { Shape } from "./architecture";
import { makeFoliageGeometry } from "./foliageGeometry";
import { ARCHITECTURAL_SHAPES, makeArchitecturalGeometry, type ArchitecturalShape } from "./architecturalGeometry";

const geometries = new Map<string, THREE.BufferGeometry>();
export function geometryForShape(shape: Shape,lowDetail=false) {
  const key=`${shape}:${lowDetail}`;
  if(geometries.has(key))return geometries.get(key)!;
  let geometry: THREE.BufferGeometry;
  if((ARCHITECTURAL_SHAPES as readonly string[]).includes(shape))geometry=makeArchitecturalGeometry(shape as ArchitecturalShape);
  else if(shape === "broadleaf"||shape === "conifer")geometry=makeFoliageGeometry(shape==="conifer",lowDetail);
  else if(shape === "rock"){
    geometry=new THREE.IcosahedronGeometry(.5,lowDetail?1:2);
    const p=geometry.attributes.position;
    for(let j=0;j<p.count;j++){
      const x=p.getX(j),y=p.getY(j),z=p.getZ(j);
      const erosion=.88+.13*Math.sin(x*19+z*13)*Math.cos(y*16-z*7);
      p.setXYZ(j,x*erosion,y*(.94+.09*Math.sin(x*15+z*11)),z*erosion);
    }
    geometry.computeVertexNormals();
  }
  else if(shape === "box")geometry=new THREE.BoxGeometry(1,1,1);
  else if(shape === "cylinder")geometry=new THREE.CylinderGeometry(0.5,0.5,1,12);
  else if(shape === "cone")geometry=new THREE.ConeGeometry(0.5,1,12);
  else if(shape === "sphere")geometry=new THREE.IcosahedronGeometry(0.5,1);
  else if(shape === "crystal")geometry=new THREE.OctahedronGeometry(0.5,0);
  else if(shape === "ring"){geometry=new THREE.TorusGeometry(1,0.045,6,32);geometry.rotateX(Math.PI/2);}
  else if(shape === "arch") {
    const outline=new THREE.Shape();outline.moveTo(-0.5,0);outline.lineTo(0.5,0);outline.lineTo(0.5,0.55);outline.absarc(0,0.55,0.5,0,Math.PI,false);outline.lineTo(-0.5,0);
    geometry=new THREE.ShapeGeometry(outline,10);
  } else if(shape === "roof") {
    const outline=new THREE.Shape();outline.moveTo(-0.5,-0.5);outline.lineTo(0.5,-0.5);outline.lineTo(0,0.5);outline.closePath();
    geometry=new THREE.ExtrudeGeometry(outline,{depth:1,bevelEnabled:false});geometry.translate(0,0,-0.5);
  } else if(shape === "sail") {
    geometry=new THREE.PlaneGeometry(1,1,5,5);
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,Math.cos(p.getX(i)*Math.PI)*Math.sin((p.getY(i)+0.5)*Math.PI)*0.18);
    geometry.computeVertexNormals();
  } else {
    const outline=new THREE.Shape();outline.moveTo(0,-0.5);outline.quadraticCurveTo(0.65,-0.15,0.4,0.4);outline.quadraticCurveTo(0,0.65,-0.4,0.4);outline.quadraticCurveTo(-0.65,-0.15,0,-0.5);
    geometry=new THREE.ExtrudeGeometry(outline,{depth:0.35,bevelEnabled:true,bevelSize:0.12,bevelThickness:0.15,bevelSegments:1,steps:1,curveSegments:6});geometry.rotateX(Math.PI/2);geometry.translate(0,0.2,0);
  }
  geometries.set(key,geometry);return geometry;
}
