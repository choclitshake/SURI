import type { ArchitectureBuilder } from "./architecture";
import { block, lancet, strut, MASONRY as C } from "./architecturalModules";
import { WYRM_TOWER } from "./northernIslands";
import { terrainHeight } from "./landscape";

/** Offline assembly: an abandoned signal tower, not a selectable destination. */
export function drawNorthernArchitecture(b:ArchitectureBuilder) {
  const {x,z,floor,turn}=WYRM_TOWER;
  b.at(x,floor,z,1,turn,()=>{
    // Rubble footing penetrates the graded bedrock, including the exposed ledge.
    b.part("cylinder","stone",C.dark,0,-1.25,0,4.1,2.8,4.1);
    b.part("cylinder","stone",C.light,0,.08,0,3.9,.3,3.9);
    b.part("towerShaft","stone","#9b9d96",0,3.96,0,2.7,7.65,2.7);
    for(const y of [.48,2.65,5.1,7.65])b.part("cylinder","stone",C.light,0,y,0,2.87,.16,2.87);
    for(let j=0;j<6;j++){
      const a=j*Math.PI/3,s=Math.sin(a),c=Math.cos(a);
      block(b,s*1.39,2.2,c*1.39,.38,4.1,.48,C.dark);
      strut(b,[s*1.83,.15,c*1.83],[s*1.35,3.8,c*1.35],.28,.36,C.stone);
      lancet(b,s*1.34,3.3,c*1.34,.43,1.5,a);
      lancet(b,s*1.34,5.65,c*1.34,.36,1.2,a);
      // Corbels bear a broad broken parapet beneath the animal's resting feet.
      strut(b,[s*1.2,6.88,c*1.2],[s*1.7,7.75,c*1.7],.25,.3);
    }
    b.part("cylinder","stone",C.dark,0,7.85,0,3.7,.3,3.7);
    b.part("cylinder","stone","#b4b3a3",0,7.97,0,3.52,.06,3.52);
    for(let j=0;j<9;j++){
      const a=Math.PI/2+j*Math.PI/8;
      if(j===3||j===6)continue;
      block(b,Math.sin(a)*1.65,8.28,Math.cos(a)*1.65,.3,.5+(j%3)*.12,.35,C.stone);
    }
    lancet(b,0,.12,1.38,.94,2.1,0,true);
    for(let j=0;j<7;j++)block(b,0,.12-j*.1,1.8+j*.22,1.35,.3,.29,C.dark);
    b.part("towerShaft","stone",C.stone,-1.43,2.4,-.3,1.05,4.8,1.05);
    b.part("spireRoof","roof",C.slate,-1.43,5.14,-.3,1.4,.8,1.4);
    for(const side of [-1,1]){
      block(b,side*1.43,5.3,.3,.09,1.65,.42,"#8a5ac1","cloth");
      block(b,side*1.43,6.15,.3,.14,.07,.65,C.iron,"iron");
    }
    // A ruined cloister and keeper's shelter nestle into the lower ledge.
    b.part("ogive","stone",C.stone,2.32,-.1,-.6,1.6,2,1);
    block(b,2.95,.45,-.65,.4,1.1,1.1,C.dark);
    block(b,-2.35,-.25,-1.15,1.7,1.15,1.8,C.stone);
    b.part("hipRoof","roof",C.slate,-2.35,.56,-1.15,2.1,.65,2.15);
  });
  for(const [px,pz,h] of [[-40.2,-38.2,1.8],[-30.5,-48.1,1.1],[32.4,-39.3,1.7]]){
    const y=terrainHeight(px,pz);
    b.part("cylinder","stone",C.dark,px,y+h*.42,pz,.45,h,.45);
    block(b,px,y+h*.9,pz,.68,.16,.68,C.light);
    b.part("rock","stone",C.dark,px+.6,y+.14,pz+.35,.7,.32,.48,.15,.4,.2);
  }
}
