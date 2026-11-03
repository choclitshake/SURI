import type { ArchitectureBuilder } from "./architecture";
import { SITES, type RoutingSite } from "./landscape";
import { MASONRY as C, battlement, block, cornice, foundation, hall, inscription, lancet, roundTower, staircase, strut } from "./architecturalModules";

export function principalFacing(kind:RoutingSite){const [x,z]=SITES[kind];return kind==="keep"?0:Math.atan2(-x,-z);}

function library(b:ArchitectureBuilder){
  foundation(b,12.2,10.7);
  hall(b,0,.4,-.65,5.2,5.8,6.1,"#69578f");
  for(const side of [-1,1]){
    hall(b,side*3.65,.4,-.6,2.05,3.2,5.8,"#7a689d");
    roundTower(b,side*4.65,2.35,6.45,.73,"#675395");
    for(const z of [-2.8,-.7,1.4]){
      b.part("buttress","stone",C.light,side*4.98,1.78,z,.46,2.8,1.35,0,side*Math.PI/2,0);
      lancet(b,side*4.69,1.22,z,.58,1.65,side*Math.PI/2);
      strut(b,[side*2.55,4.8,z],[side*4.7,2.8,z],.18,.28,C.light);
      lancet(b,side*2.63,3.8,z,.65,1.7,side*Math.PI/2);
    }
    for(const x of [side*1.48,side*3.65])lancet(b,x,1.25,2.43,.68,1.75);
    lancet(b,side*1.48,3.55,2.43,.85,2.05);
    // Arcade on the lower wings: open Gothic frames supported on real piers.
    for(const z of [-2.9,-1.05,.8])b.part("ogive","stone",C.light,side*3.65,.55,z,.92,2.15,1,0,side*Math.PI/2,0);
  }
  roundTower(b,.5,-3.45,9.92,.82,"#5b478a");
  for(const x of [-1.7,0,1.7]){
    block(b,x,6.4,-.65,.15,.4,6.6,C.iron,"iron");
    if(x!==0)lancet(b,x,4.5,-3.72,.65,1.3,Math.PI);
  }
  lancet(b,0,.4,2.47,1.55,2.65,0,true);
  b.part("ogive","stone",C.light,0,.38,2.59,2.18,3.05,1.9);
  b.part("scholarRelief","carving","#b1a88c",0,4.72,2.46,1.3,1.25,1);
  // An elevated reading bay, with deep stone window reveals and tiled coping.
  block(b,0,5.58,2.58,1.9,.24,.7,C.light);
  staircase(b,2.65,4.98,2.35,.42,9);
  for(const side of [-1,1]){
    block(b,side*1.42,.62,3.47,.3,1.2,1.45,C.stone);
    b.lantern(side*1.42,1.22,4.22);
  }
}

function archive(b:ArchitectureBuilder){
  foundation(b,10.6,9.6,"#817e92");
  block(b,0,1.82,-.65,6.7,3.05,4.55,"#7e8880");
  cornice(b,0,3.45,-.65,7.12,4.9,"#989d8e");
  block(b,0,3.6,-.65,6.65,.2,4.48,"#68756d");
  // A load-bearing monolith emerges through the archive's ancient stone vault.
  for(const [x,z,h,w,d] of [[.2,-1.2,10.7,2.6,1.9],[-3.35,-1.9,8.1,1.9,1.7],[3.35,-2.1,7.1,1.9,1.7]]){
    block(b,x,.48,z,w+1.05,.38,d+.9,"#69746e");
    b.part("obelisk","stone",x<0?"#948b9e":"#7e788f",x,.65+h/2,z,w,h,d);
    b.part("inscription","carving","#899187",x,.65+h*.49,z+d*.405,w*.54,h*.43,1,-.02,0,0);
    block(b,x,.75,z,w+1.2,.13,d+1.05,"#a0a591");
  }
  for(const side of [-1,1]){
    for(const z of [-2.9,-1.1,.8])b.part("buttress","stone","#697872",side*3.67,1.72,z,.6,2.7,1.5,0,side*Math.PI/2,0);
    inscription(b,side*2,1.98,1.65,.74,1.65);
    block(b,side*2.25,.65,3.55,.7,.6,.72,"#828c7e");
    b.part("rock","stone","#84917e",side*4.25,.38,2.1,.85,.64,1.1);
    b.part("sphere","leaves","#5e7051",side*3.95,.58,-2.8,.8,.22,.7);
  }
  // An ancient post-and-lintel portal distinguishes the archive from the
  // academic Gothic facades. Its heavy lintel bears on two full-height piers.
  block(b,0,1.54,1.67,1.8,2.32,.12,"#3d3d32","wood");
  for(const side of [-1,1]){
    block(b,side*1.2,1.6,1.88,.5,2.45,.72,"#a1a895");
    for(const y of [1.02,2.02])block(b,side*.45,y,1.75,.76,.06,.045,C.iron,"iron");
  }
  block(b,0,3.04,1.92,2.95,.45,.82,"#a2a58e");
  inscription(b,0,3.05,2.34,1.75,.25);
  staircase(b,1.95,4.58,2.55,.42,9);
  // Broken enclosure walls remain low enough to expose the route entrance.
  for(const side of [-1,1]){
    block(b,side*4.25,.72,1.7,.4,1.2,3.2,"#77836e");
    for(let j=0;j<4;j++)block(b,side*4.25,1.38-j*.09,.45+j*.8,.48,.24,.56,"#949b86");
  }
}

function observatory(b:ArchitectureBuilder){
  foundation(b,11.5,10.6);
  b.part("towerShaft","stone","#aaa998",.45,2.45,-.5,5.8,4.2,5.8);
  for(const y of [.55,2.1,4.5])b.part("cylinder","stone",C.light,.45,y,-.5,6.05,.18,6.05);
  for(let j=0;j<8;j++){
    const a=j*Math.PI/4;
    lancet(b,.45+Math.sin(a)*2.72,1.45,-.5+Math.cos(a)*2.72,.62,1.9,a);
    b.part("buttress","stone",C.stone,.45+Math.sin(a)*3.04,1.33,-.5+Math.cos(a)*3.04,.42,1.9,.95,0,a,0);
  }
  b.part("dome","gold","#87739c",.45,4.62,-.5,5.88,2.05,5.88);
  // Copper meridians run over the supported dome; a real raised observing slit.
  for(let j=0;j<12;j++){
    const a=j*Math.PI/6;
    for(let k=0;k<5;k++){
      const p=k/5*Math.PI/2,q=(k+1)/5*Math.PI/2;
      strut(b,[.45+Math.sin(a)*Math.cos(p)*2.96,4.65+Math.sin(p)*2.08,-.5+Math.cos(a)*Math.cos(p)*2.96],
        [.45+Math.sin(a)*Math.cos(q)*2.96,4.65+Math.sin(q)*2.08,-.5+Math.cos(a)*Math.cos(q)*2.96],.045,.045,"#9b9e7f","gold");
    }
  }
  for(let k=0;k<6;k++){
    const a=(k+.5)/6*Math.PI/2;
    block(b,.45,4.66+Math.sin(a)*2.08,-.5+Math.cos(a)*2.97,.24,.48,.12,"#394b4d","iron");
  }
  roundTower(b,-3.6,-2.9,7.85,.72,"#4c6268");
  // Balcony on the instrument tower has corbels under its cantilevered slabs.
  block(b,-3.6,5.45,-1.94,2.35,.22,1.15,C.light);
  for(const x of [-4.42,-2.78])strut(b,[x,4.65,-2.5],[x,5.36,-1.54],.2,.25,C.stone);
  for(const x of [-4.5,-4.05,-3.6,-3.15,-2.7])block(b,x,5.85,-1.42,.055,.68,.06,C.iron,"iron");
  block(b,-3.6,6.21,-1.42,1.86,.07,.07,C.iron,"iron");
  lancet(b,.45,.38,2.31,1.2,2.1,0,true);staircase(b,2.5,4.95,2.15,.43,9,.45);
  // A small armillary and a grounded telescope communicate mathematical work.
  block(b,3.65,.66,2.9,.9,.65,.9,C.stone);
  for(const [rx,rz] of [[0,0],[Math.PI/2,0],[.7,.6]])b.part("ring","gold",C.bronze,3.65,1.78,2.9,.72,.72,.72,rx,0,rz);
  b.part("sphere","gold","#8e9f9b",3.65,1.78,2.9,.24,.24,.24);
  b.part("cylinder","iron",C.iron,3.6,1.05,-2.8,.1,1.45,.1);
  strut(b,[3.15,1.62,-2.1],[4.3,2.1,-3.2],.22,.22,C.bronze,"gold");
  b.part("astralRelief","carving",C.bronze,3.6,.39,.15,2,2,1,-Math.PI/2,0,0);
}

function citadel(b:ArchitectureBuilder){
  foundation(b,11.9,10.8);
  // Three supported levels ascend from the gate to a single high watchtower.
  block(b,0,.71,-.8,8.35,.72,6.45,"#959f92");
  block(b,0,1.28,-1.15,6.8,.42,5.6,"#a6aa97");
  hall(b,.55,1.46,-1.7,4.45,3.7,3.85,"#586166");
  roundTower(b,-2.1,-2.85,8.35,.78,"#505d65",false);
  for(const side of [-1,1]){
    roundTower(b,side*4.3,1.55,4.6,.75,"#5c6263",false);
    battlement(b,[side*4.3,-3.55],[side*4.3,1.5],.35,1.62);
    b.part("buttress","stone",C.light,side*4.7,1.25,-1.6,.55,1.9,1.15,0,side*Math.PI/2,0);
  }
  battlement(b,[-4.3,-3.55],[4.3,-3.55],.35,1.7);
  battlement(b,[-4.3,1.55],[-1.45,1.55],.35,1.45);
  battlement(b,[1.45,1.55],[4.3,1.55],.35,1.45);
  b.part("ogive","stone",C.light,0,.35,1.65,2.9,3,2.5);
  b.part("ogive","iron",C.iron,0,.44,1.7,2.4,2.5,1.2);
  lancet(b,.55,1.5,.26,1.08,1.95,0,true);
  for(const x of [-.7,1.8])lancet(b,x,3.6,.26,.62,1.3);
  staircase(b,1.32,4.95,2.32,.45,10);
  // The internal stair climbs to the actual elevated hall floor.
  for(let j=0;j<9;j++)block(b,.55,.55+j*.1,1.23-j*.12,1.55,.18,.18,C.light);
  for(const x of [-3.1,-2.25,-1.4,1.6,3.05]){
    block(b,x,.74,3.65,.48,.76,.5,"#a6aa96");inscription(b,x,.84,3.91,.25,.38);
  }
  b.flag(-2.1,9.38,-2.85,"#8b4dcb");b.flag(4.3,5.5,1.55,"#8b4dcb");
  b.part("heraldry","carving","#a38b58",0,2.55,1.9,.74,.7,1);
}

function trainingKeep(b:ArchitectureBuilder){
  foundation(b,11.9,11.2);
  // An intentionally open forecourt: rear keep and a lower timber workshop.
  hall(b,-1.15,.42,-1.6,4.15,3.55,3.8,"#74659d");
  roundTower(b,-3.4,-2.75,4.85,.67,"#8570a8");
  roundTower(b,1.25,-2.8,5.28,.66,"#70598f");
  hall(b,3.5,.42,-.7,2,2.2,4.1,"#8c719e");
  for(const z of [-2.05,-.6,.85]){
    block(b,3.5,1.35,z,2.13,.12,.13,C.timber,"wood");
    strut(b,[2.48,.6,z],[2.48,2.25,z+.7],.1,.1,C.timber,"wood");
    lancet(b,2.48,1.0,z,.55,1.08,-Math.PI/2);
  }
  battlement(b,[-4.65,-3.7],[-4.65,3.8],.35,.82);
  battlement(b,[-4.65,-3.7],[4.65,-3.7],.35,.82);
  battlement(b,[4.65,-3.7],[4.65,3.8],.35,.82);
  lancet(b,-1.15,.42,.33,1.05,1.95,0,true);
  for(const x of [-2.25,0])lancet(b,x,2.35,.33,.65,1.25);
  staircase(b,3.65,5.35,2.6,.4,7);
  // Worktables, timber gantry and a chalked geometric training court.
  b.part("astralRelief","carving","#b8b29c",0,.39,2.45,2.45,2.45,1,-Math.PI/2,0,0);
  block(b,3.15,1.15,2.35,1.65,.14,.85,C.timber,"wood");
  for(const x of [2.5,3.8])for(const z of [2.04,2.66])block(b,x,.76,z,.1,.72,.1,C.timber,"wood");
  for(const x of [-3.65,-2.1])block(b,x,1.28,2.55,.12,1.8,.12,C.timber,"wood");
  block(b,-2.875,2.18,2.55,1.75,.14,.16,C.timber,"wood");
  b.part("ring","iron",C.iron,-2.875,1.6,2.55,.4,.4,.4,Math.PI/2,0,0);
  b.barrel(3.45,3.25);b.crate(3.9,1.35);
  b.flag(1.25,6.82,-2.8,"#a26bda");
}

const designs={topics:library,keep:archive,calculator:observatory,champions:citadel,records:trainingKeep};
/** Authoring only. The live scene loads the compiled instance manifest. */
export function drawPrincipalLandmark(b:ArchitectureBuilder,kind:RoutingSite){
  b.at(0,0,0,1,principalFacing(kind),()=>designs[kind](b));
}
