import * as THREE from "three";
import { LOCAL_SUN,ENVIRONMENT_BOUNDS } from "./environment";
export type ShadowProxy={x:number;z:number;top:number;ground:number;rx:number;rz:number;leaves:boolean};
/** Offline 2.5D horizon bake. No renderer, runtime queries or raycaster. */
export function makeStaticLighting(size:number,terrain:Float32Array,proxies:ShadowProxy[]){
  const bounds=ENVIRONMENT_BOUNDS,dx=(bounds.maxX-bounds.minX)/(size-1),dz=(bounds.maxZ-bounds.minZ)/(size-1),heights=new Float32Array(size*size);
  for(let i=0;i<heights.length;i++)heights[i]=terrain[i*2];
  for(const p of proxies){
    const x0=Math.max(0,Math.floor((p.x-p.rx-bounds.minX)/dx)),x1=Math.min(size-1,Math.ceil((p.x+p.rx-bounds.minX)/dx)),z0=Math.max(0,Math.floor((p.z-p.rz-bounds.minZ)/dz)),z1=Math.min(size-1,Math.ceil((p.z+p.rz-bounds.minZ)/dz));
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
      const r=((bounds.minX+x*dx-p.x)/p.rx)**2+((bounds.minZ+z*dz-p.z)/p.rz)**2;
      if(r>1)continue;const crown=p.leaves?Math.sqrt(1-r)*.7+.3:1;
      heights[z*size+x]=Math.max(heights[z*size+x],p.ground+(p.top-p.ground)*crown);
    }
  }
  const height=(x:number,z:number)=>{
    const u=THREE.MathUtils.clamp((x-bounds.minX)/dx,0,size-1.001),v=THREE.MathUtils.clamp((z-bounds.minZ)/dz,0,size-1.001),a=Math.floor(u),b=Math.floor(v),fx=u-a,fz=v-b;
    return (heights[b*size+a]*(1-fx)+heights[b*size+a+1]*fx)*(1-fz)+(heights[(b+1)*size+a]*(1-fx)+heights[(b+1)*size+a+1]*fx)*fz;
  };
  const sun=new THREE.Vector3(...LOCAL_SUN).normalize(),horizontal=Math.hypot(sun.x,sun.z),sx=sun.x/horizontal,sz=sun.z/horizontal,slope=sun.y/horizontal;
  const sample=(x:number,y:number,z:number,nx=0,ny=1,nz=0)=>{
    // Offset receivers along their normals, preventing self-contact speckles.
    x+=nx*.2;y+=Math.max(.14,ny*.2);z+=nz*.2;
    let visibility=1;
    for(const distance of [.35,.7,1.3,2.3,4,6.5,10,16,25]){
      const obstruction=height(x+sx*distance,z+sz*distance)-y-distance*slope;
      visibility=Math.min(visibility,THREE.MathUtils.clamp(.75-obstruction/(.24+distance*.035),0,1));
    }
    let occlusion=0;
    for(const [ax,az]of [[1,0],[-1,0],[0,1],[0,-1]])for(const radius of [.65,1.5])occlusion+=THREE.MathUtils.clamp((height(x+ax*radius,z+az*radius)-y)/radius,0,1);
    const ao=THREE.MathUtils.clamp(1-occlusion*.027,.76,1);
    const lambert=Math.max(0,nx*sun.x+ny*sun.y+nz*sun.z);
    return [lambert*(.16+.84*visibility),ao,visibility] as const;
  };
  function geometry(g:THREE.BufferGeometry,world=new THREE.Matrix4()){
    const p=g.attributes.position,n=g.attributes.normal,normalMatrix=new THREE.Matrix3().getNormalMatrix(world),point=new THREE.Vector3(),normal=new THREE.Vector3(),light=new Float32Array(p.count*4);
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(world);normal.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);
      light.set([...sample(point.x,point.y,point.z,normal.x,normal.y,normal.z),1],i*4);
    }
    g.setAttribute("bakedLight",new THREE.BufferAttribute(light,4));return g;
  }
  return {sample,geometry,sun:sun.toArray()};
}
