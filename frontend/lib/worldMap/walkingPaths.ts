import * as THREE from "three";
import { terrainHeight } from "./landscape";

/** Spatially indexed triangle sampling for the coast-aligned island meshes.
 * Build once per static terrain; paths then query only a few nearby triangles.
 */
export function createTerrainSampler(geometry:THREE.BufferGeometry) {
  const p=geometry.attributes.position,index=geometry.index!,cellSize=2;
  const cells=new Map<string,number[]>();
  for(let face=0;face<index.count;face+=3){
    const a=index.getX(face),b=index.getX(face+1),c=index.getX(face+2);
    const minX=Math.floor(Math.min(p.getX(a),p.getX(b),p.getX(c))/cellSize);
    const maxX=Math.floor(Math.max(p.getX(a),p.getX(b),p.getX(c))/cellSize);
    const minZ=Math.floor(Math.min(p.getZ(a),p.getZ(b),p.getZ(c))/cellSize);
    const maxZ=Math.floor(Math.max(p.getZ(a),p.getZ(b),p.getZ(c))/cellSize);
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
      const key=`${x}:${z}`,list=cells.get(key);
      if(list)list.push(face);else cells.set(key,[face]);
    }
  }
  return (x:number,z:number)=>{
    let height=-Infinity;
    for(const face of cells.get(`${Math.floor(x/cellSize)}:${Math.floor(z/cellSize)}`)??[]){
      const a=index.getX(face),b=index.getX(face+1),c=index.getX(face+2);
      const ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c);
      const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
      if(Math.abs(d)<1e-10)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;
      if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)height=Math.max(height,u*p.getY(a)+v*p.getY(b)+(1-u-v)*p.getY(c));
    }
    return Number.isFinite(height)?height:terrainHeight(x,z);
  };
}

/** Interpolate the actual terrain triangles, including the low-detail grid. */
export function terrainSurface(geometry: THREE.PlaneGeometry, x: number, z: number) {
  const { widthSegments: columns, heightSegments: rows } = geometry.parameters;
  const positions=geometry.attributes.position;
  const minX=positions.getX(0), minZ=positions.getZ(0);
  const maxX=positions.getX(columns), maxZ=positions.getZ(rows*(columns+1));
  const gx=(x-minX)/(maxX-minX)*columns, gz=(z-minZ)/(maxZ-minZ)*rows;
  if(gx<0||gz<0||gx>columns||gz>rows)return terrainHeight(x,z);
  const column=Math.min(columns-1,Math.floor(gx)),row=Math.min(rows-1,Math.floor(gz));
  const u=gx-column,v=gz-row,index=row*(columns+1)+column;
  const a=positions.getY(index),b=positions.getY(index+columns+1);
  const c=positions.getY(index+columns+2),d=positions.getY(index+1);
  return u+v<=1 ? a+(d-a)*u+(b-a)*v : c+(b-c)*(1-u)+(d-c)*(1-v);
}

/** Closely spaced cross-sections prevent wide ribbons cutting through slopes. */
export function walkingRibbon(points: THREE.Vector3[], halfWidth: (x:number,z:number)=>number, surface: (x:number,z:number)=>number) {
  const samples: THREE.Vector3[]=[points[0]];
  for(let i=1;i<points.length;i++){
    const steps=Math.max(1,Math.ceil(points[i-1].distanceTo(points[i])/0.25));
    for(let step=1;step<=steps;step++)samples.push(points[i-1].clone().lerp(points[i],step/steps));
  }
  const vertices:number[]=[],indices:number[]=[],colors:number[]=[];
  const color=new THREE.Color("#baae8e"),slices=6,stride=slices+1;
  samples.forEach((point,i)=>{
    const tangent=samples[Math.min(samples.length-1,i+1)].clone().sub(samples[Math.max(0,i-1)]);
    tangent.y=0;tangent.normalize();
    const width=halfWidth(point.x,point.z);
    for(let j=0;j<=slices;j++){
      const offset=(j/slices*2-1)*width;
      const x=point.x+tangent.z*offset,z=point.z-tangent.x*offset;
      vertices.push(x,surface(x,z),z);
      // Subtle packed-earth variation, continuous across overlapping junctions.
      const shade=0.98+0.025*Math.sin(x*1.7+z*2.3);
      colors.push(color.r*shade,color.g*shade,color.b*shade);
      if(i<samples.length-1&&j<slices){
        const n=i*stride+j;indices.push(n,n+stride,n+1,n+1,n+stride,n+stride+1);
      }
    }
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
