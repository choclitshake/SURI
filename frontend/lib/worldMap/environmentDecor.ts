import { ArchitectureBuilder } from "./architecture";
import { ISLANDS,SITES,LANDMARK_SITE_KEYS,islandScore,terrainHeight,terrainSlope,type RoutingSite,type MapPoint } from "./landscape";
import { traversalClearance,TRAVERSAL } from "./traversal";
import { WORLD_PALETTE as P } from "./worldPalette";

type Garden={site:RoutingSite;x:number;z:number;turn:number;kind:"fountain"|"shrine"};
const islandFor={keep:"hub",topics:"topics",records:"records",champions:"progress",calculator:"calculator"} as const;
export const GARDENS:Garden[]=LANDMARK_SITE_KEYS.flatMap((site,index)=>{
  const [sx,sz]=SITES[site],front=site==="keep"?0:Math.atan2(-sx,-sz),result:Garden[]=[];
  // The observatory's mountain-facing flank is intentionally left undeveloped.
  for(const side of site==="calculator"?[1]:[0,1])for(let j=0;j<24;j++){
    const angle=front+(side?1:-1)*(1.1+j*.085),r=6.8+(j%4)*.45,x=sx+Math.sin(angle)*r,z=sz+Math.cos(angle)*r;
    if(islandScore(x,z,ISLANDS[islandFor[site]])<2.6||terrainSlope(x,z)>.65||traversalClearance(x,z)<1.5)continue;
    if(result.some(p=>Math.hypot(p.x-x,p.z-z)<3))continue;
    result.push({site,x,z,turn:front,kind:(index+side)%2?"shrine":"fountain"});break;
  }
  return result;
});
export function decorClearance(x:number,z:number){return Math.min(...GARDENS.map(p=>Math.hypot(x-p.x,z-p.z)-1.45));}
/** Offline garden links skirt the occupied foundation, never cut through it.
 * Try direct approaches first, then contour arcs around the landmark. */
export function gardenApproach(garden:Garden,surface=terrainHeight):MapPoint[]{
  const {site,x,z}=garden,[sx,sz]=SITES[site],island=ISLANDS[islandFor[site]];
  const endpoints=TRAVERSAL.paths.filter(p=>p.island===islandFor[site]).flatMap(p=>p.points.filter((_,j)=>j%5===0||j===p.points.length-1))
    .filter(p=>{const r=Math.hypot(p[0]-sx,p[2]-sz);return r>5.7&&r<10;});
  let best:MapPoint[]=[],bestCost=Infinity;
  const consider=(corners:MapPoint[])=>{
    const points:MapPoint[]=[corners[0]];let cost=0;
    for(let j=1;j<corners.length;j++){
      const a=corners[j-1],b=corners[j],length=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(length/.3);
      for(let k=1;k<=steps;k++)points.push([a[0]+(b[0]-a[0])*k/steps,a[1]+(b[1]-a[1])*k/steps]);
    }
    for(let j=0;j<points.length;j++){
      const p=points[j];if(islandScore(p[0],p[1],island)<1.2||Math.hypot(p[0]-sx,p[1]-sz)<5.55)return;
      if(GARDENS.some(g=>g!==garden&&Math.hypot(g.x-p[0],g.z-p[1])<1.4))return;
      if(j){const a=points[j-1],length=Math.hypot(p[0]-a[0],p[1]-a[1]),rise=Math.abs(surface(...p)-surface(...a));if(rise>length*.9)return;cost+=length+rise*2;}
    }
    if(cost<bestCost){bestCost=cost;best=points;}
  };
  const start=Math.atan2(x-sx,z-sz);
  for(const p of endpoints){
    const end:MapPoint=[p[0],p[2]];consider([[x,z],end]);
    const finish=Math.atan2(end[0]-sx,end[1]-sz);
    for(const direction of [-1,1])for(const radius of [6.2,6.7,7.2]){
      const sweep=((finish-start)*direction+Math.PI*4)%(Math.PI*2),steps=Math.ceil(sweep*radius/.65),arc:MapPoint[]=[];
      for(let j=0;j<=steps;j++){const angle=start+direction*sweep*j/(steps||1);arc.push([sx+Math.sin(angle)*radius,sz+Math.cos(angle)*radius]);}
      consider([[x,z],...arc,end]);
    }
  }
  return best;
}
function lantern(b:ArchitectureBuilder,x:number,y:number,z:number){
  b.part("box","stone",P.stone,x,y+.2,z,.35,.4,.35);
  b.part("cylinder","iron","#6d617e",x,y+.9,z,.07,1.4,.07);
  b.part("box","iron","#62566f",x,y+1.6,z,.24,.34,.24);
  b.part("sphere","magic",P.violet,x,y+1.61,z,.18,.23,.18);
  b.part("hipRoof","roof",P.indigo,x,y+1.83,z,.35,.14,.35);
}
function banner(b:ArchitectureBuilder,x:number,y:number,z:number,turn:number){
  b.at(x,y,z,1,turn,()=>{
    b.part("cylinder","stone",P.lightStone,0,.12,0,.44,.24,.44);
    b.part("cylinder","iron","#746984",0,1.05,0,.065,2.1,.065);
    b.part("box","iron","#8c7f9c",.35,1.95,0,.82,.07,.07);
    b.part("sail","cloth",P.purple,.35,1.35,0,.65,1.05,1);
    b.part("heraldry","carving",P.pale,.35,1.44,.035,.27,.3,1);
    b.part("sphere","gold","#d6bd83",0,2.14,0,.14,.14,.14);
  });
}
/** Authored clusters reserve breathing room and never become routing targets. */
export function makeEnvironmentDecor(surface=terrainHeight){
  const b=new ArchitectureBuilder();
  for(const garden of GARDENS){
    const {x,z,turn,kind,site}=garden;
    const floor=Math.max(...[-1,0,1].flatMap(dx=>[-1,0,1].map(dz=>surface(x+dx,z+dz))))+.08;
    const bottom=Math.min(...[-1,1].flatMap(dx=>[-1,1].map(dz=>surface(x+dx,z+dz))))-.2;
    b.at(x,floor,z,1,turn,()=>{
      b.part("cylinder","stone",P.stone,0,(bottom-floor)/2,0,2.75,floor-bottom,2.75);
      b.part("cylinder","road","#c5bfa5",0,.045,0,2.8,.09,2.8);
      if(kind==="fountain"){
        b.part("cylinder","stone",P.lightStone,0,.22,0,1.72,.3,1.72);
        b.part("cylinder","glass","#a8c9d8",0,.39,0,1.4,.035,1.4);
        b.part("ring","stone",P.lightStone,0,.4,0,.77,2,.77);
        b.part("cylinder","stone",P.stone,0,.76,0,.24,.74,.24);
        b.part("cylinder","stone",P.lightStone,0,1.14,0,.84,.12,.84);
        b.part("sphere","magic",P.violet,0,1.42,0,.2,.35,.2);
      }else{
        b.part("box","stone",P.lightStone,0,.2,0,.92,.35,.84);
        b.part("ogive","stone",P.stone,0,.3,-.24,1.18,1.55,1.3);
        b.part(site==="calculator"?"crystal":"obelisk","stone",site==="champions"?"#d4c8a9":"#b6afc8",0,.94,.02,.46,1.13,.4);
        b.part("crystal","magic",P.purple,0,1.61,.02,.24,.32,.24);
        b.part("inscription","carving",P.indigo,0,.45,.46,.56,.25,1);
      }
      for(const side of [-1,1]){
        b.part("box","stone",P.stone,side*1.05,.16,-.7,.5,.3,.75);
        b.part("sphere","leaves",P.foliage,side*1.05,.42,-.7,.6,.35,.83);
        for(let j=0;j<3;j++)b.part("sphere","cloth",j%2?P.violet:"#cfb0e7",side*1.05+(j-1)*.13,.62,-.7,.12,.13,.13);
        b.part("box","wood","#998263",side*1.02,.38,.83,.55,.12,.5);
        for(const leg of [-1,1])b.part("box","stone",P.stone,side*1.02+leg*.18,.2,.83,.12,.35,.36);
      }
    });
    banner(b,x+Math.cos(turn)*1.7,surface(x+Math.cos(turn)*1.7,z-Math.sin(turn)*1.7),z-Math.sin(turn)*1.7,turn);
    lantern(b,x-Math.cos(turn)*1.6,surface(x-Math.cos(turn)*1.6,z+Math.sin(turn)*1.6),z+Math.sin(turn)*1.6);
    // A short paved connection joins the nearest existing approach, not a
    // decorative trail that ends on a cliff or crosses a principal building.
    const approach=gardenApproach(garden,surface);
    for(let j=1;j<approach.length;j++){
      const a=approach[j-1],p=approach[j],px=(a[0]+p[0])/2,pz=(a[1]+p[1])/2,length=Math.hypot(p[0]-a[0],p[1]-a[1]),distance=Math.hypot(px-x,pz-z);
      const ground=surface(px,pz)-.12,top=Math.max(surface(px,pz)+.08,floor-Math.max(0,distance-1.25)*.6);
      b.part("box","road","#b7ae92",px,(top+ground)/2,pz,.65,Math.max(.1,top-ground),length+.04,0,Math.atan2(p[0]-a[0],p[1]-a[1]));
    }
  }
  // Inhabited fishing quay: driven piles, decking and practical cargo props.
  const cove=ISLANDS.lanternCove,x=cove.x+.6,z=cove.z+2.05,land=surface(x,z),deck=Math.max(.85,land+.12);
  b.part("box","wood","#a58b67",x,deck-.13,z+1.05,1.55,.24,3.05);
  for(const side of [-1,1])for(const d of [-.1,1.2,2.35]){
    const px=x+side*.61,pz=z+d,foot=Math.min(-2.3,surface(px,pz)-.3);
    b.part("cylinder","wood","#75604c",px,(foot+deck+.35)/2,pz,.17,deck+.35-foot,.17);
    b.part("ring","iron","#7b7181",px,deck+.22,pz,.105,1,.105);
  }
  b.at(x-.39,deck,z+.75,.55,.2,()=>b.crate(0,0));
  b.at(x+.34,deck,z-.14,.65,0,()=>b.barrel(0,0));
  lantern(b,x-.62,deck,z+.08);banner(b,x+.75,deck,z-.4,.2);
  // Ruined columns form a small archaeological corner, beside the archive garden.
  const ruin=GARDENS.find(g=>g.site==="keep");
  if(ruin)for(let j=0;j<3;j++){const px=ruin.x-1.2+j*.55,pz=ruin.z-2.2,y=surface(px,pz);if(traversalClearance(px,pz)<.8)continue;b.part("cylinder","stone",P.stone,px,y+.35+j*.13,pz,.28,.7+j*.26,.28);}
  return b;
}

export const HARBOR_BOATS=[{x:-25.85,z:26,turn:.3},{x:-28.85,z:25.2,turn:-.2}];
export function makeHarborBoat(){
  const b=new ArchitectureBuilder();
  b.part("hull","wood","#8d6d4e",0,.06,0,1.1,.8,2.4);
  b.part("box","wood","#c4ab80",0,.26,0,.63,.08,1.6);
  for(const z of [-.55,.3])b.part("box","wood","#7c5c47",0,.38,z,.92,.09,.18);
  b.part("cylinder","wood","#8c7252",0,1.02,-.13,.055,1.65,.055);
  b.part("sail","cloth",P.purple,.27,1.14,-.13,.52,.68,1);
  b.part("box","roof",P.indigo,0,.33,.78,.9,.12,.12);
  return b;
}
