import { ArchitectureBuilder } from "./architecture";
import { ISLANDS, PRIMARY_ISLANDS, SITES, WORLD_BOUNDS, insideWorld, islandAt, islandScore, roadDistance, seededRandom, siteDistance, terrainHeight, terrainSlope } from "./landscape";
import { decorClearance } from "./environmentDecor";
import { outpostDistance } from "./supportingArchitecture";
import { traversalClearance } from "./traversal";

function tree(b:ArchitectureBuilder,x:number,z:number,size:number,oak:boolean,highland=false,surface=terrainHeight) {
  const y=surface(x,z);
  b.part("cylinder","wood","#635846",x,y+size*1.2,z,0.12*size,2.4*size,0.12*size);
  if(oak){
    b.part("broadleaf","leaves",highland?"#628347":"#7a9250",x,y+2*size,z,2.2*size,2.35*size,1.9*size,0,x*1.7+z,0);
  } else b.part("conifer","leaves","#547744",x,y+2.1*size,z,1.9*size,3.1*size,1.9*size,0,z*2.3+x,0);
}

/** Environmental fragments only: the five routing buildings remain the heroes. */
export function makeSettlements(surface=terrainHeight) {
  const b=new ArchitectureBuilder(),random=seededRandom(381);
  for(const i of Object.values(ISLANDS)) {
    const primary=Object.values(PRIMARY_ISLANDS).includes(i);
    for(let j=0;j<(primary?95:9);j++) {
      const x=i.x+(random()-0.5)*i.rx*2.1,z=i.z+(random()-0.5)*i.rz*2.1;
      const coast=islandScore(x,z,i);
      if(coast< -0.65||coast>4.1||!insideWorld(x,z)||siteDistance(x,z)<7||roadDistance(x,z)<1.1||traversalClearance(x,z)<1.2||decorClearance(x,z)<.9||outpostDistance(x,z)<.4)continue;
      const y=surface(x,z),size=0.45+random()*1.05;
      const rocky=i.biome==="peaks"||i.biome==="ruins"||i.biome==="stack";
      b.part("rock","stone",rocky?"#768184":"#919588",x,y+size*0.12,z,size*1.4,size*(rocky?2.1:0.9),size,random()*0.5,random()*6,random()*0.5);
      if(primary&&j%4===0&&coast>0.5)b.part("sphere","leaves","#70814b",x,y+0.18,z,0.85,0.38,0.65);
    }
  }
  // Fallen masonry follows the ruined ridge, away from Playground's stelae.
  const ruins=PRIMARY_ISLANDS.records;
  for(let j=0;j<16;j++) {
    const x=ruins.x-7+random()*4,z=ruins.z-8+random()*15;
    if(islandScore(x,z,ruins)<2||roadDistance(x,z)<1.4||traversalClearance(x,z)<1.1)continue;
    const y=surface(x,z),standing=j%4===0;
    b.part("box","stone",j%2?"#9eaa98":"#b5b39b",x,y+(standing?0.9:0.22),z,0.7+random()*0.5,standing?1.8:0.45,0.6+random(),standing?0.08:0.25,random()*3,0.12);
  }
  // Ancient geological sentinels on the wooded terraces.
  for(const [x,z,h] of [[-4,-39,2.4],[-3,-34,1.6],[-20,-30,2.1]]){
    if(traversalClearance(x,z)<1.2)continue;
    const y=surface(x,z);
    b.part("rock","stone","#89938a",x,y+h*0.35,z,1.1,h,0.8,0.1,0.4,0.2);
    b.part("sphere","leaves","#6b8050",x-0.25,y+0.2,z+0.3,0.9,0.25,0.7);
  }
  return b;
}

/** Deterministic forest bands respect grade, treeline, trails and sight lines. */
export function makeVegetation(distant=false,surface=terrainHeight) {
  // Keep the same forest placement in both tiers. Geometry, animation cadence
  // and pixel ratio scale independently, so tablet mode retains its landscape.
  const b=new ArchitectureBuilder(),random=seededRandom(7319),spacing=1.85;
  for(let z=WORLD_BOUNDS.minZ+2;z<WORLD_BOUNDS.maxZ-2;z+=spacing)for(let x=WORLD_BOUNDS.minX+2;x<WORLD_BOUNDS.maxX-2;x+=spacing){
    const px=x+random()*spacing*0.75,pz=z+random()*spacing*0.75;
    const sample=islandAt(px,pz),biome=sample.island.biome;
    if(sample.coast<1.4||!insideWorld(px,pz)||siteDistance(px,pz)<6.3||roadDistance(px,pz)<1.25||traversalClearance(px,pz)<1.35||decorClearance(px,pz)<.8||outpostDistance(px,pz)<.7)continue;
    const slope=terrainSlope(px,pz),height=terrainHeight(px,pz);
    if(slope>0.85||height>9||biome==="reef"||biome==="stack")continue;
    const density=biome==="highlands"?0.96:biome==="citadel"?0.87:biome==="peaks"?0.4:biome==="ruins"?0.48:0.7;
    if(random()>density)continue;
    if(Object.values(SITES).some(([sx,sz])=>px<sx+2&&px>sx-5&&pz>sz&&pz<sz+6))continue;
    tree(b,px,pz,0.55+random()*0.65,random()>(biome==="highlands"?0.72:0.4),biome==="highlands",surface);
  }
  return b;
}
