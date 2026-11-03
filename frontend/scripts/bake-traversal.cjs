// Offline terrain routing and mesh alignment. No pathfinding ships in the app.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),T=require('three');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,resolveJsonModule:true}}).outputText,f);
const w=require('../lib/worldMap/landscape.ts');
const {makeArchipelagoTerrain}=require('../lib/worldMap/terrainGeometry.ts');
const {createTerrainSampler,walkingRibbon}=require('../lib/worldMap/walkingPaths.ts');
const {outpostPosition,COASTAL_OUTPOSTS}=require('../lib/worldMap/supportingArchitecture.ts');
const primary={hub:'keep',progress:'champions',topics:'topics',records:'records',calculator:'calculator'};
const samplers=[false,true].map(low=>createTerrainSampler(makeArchipelagoTerrain(low)));
const safeSurface=(x,z)=>Math.max(w.terrainHeight(x,z),samplers[0](x,z),samplers[1](x,z));
const plan={version:1,nodes:[],bridges:[],paths:[]};
const round=n=>Math.round(n*10000)/10000;
const point=(x,z)=>[round(x),round(safeSurface(x,z)+.09),round(z)];
const roots={};
const forecourts=[];
for(const [island,site]of Object.entries(primary)){
  const road=w.ROADS[w.LANDMARK_SITE_KEYS.indexOf(site)];
  const stop=road.findIndex(p=>Math.hypot(p.x-w.SITES[site][0],p.z-w.SITES[site][1])>5.75);
  const approach=road.slice(0,stop+1),end=approach.at(-1);roots[island]=point(end.x,end.z);
  forecourts.push({id:`forecourt-${site}`,island,from:`entrance-${site}`,to:`court-${site}`,width:1.2,points:approach.map(p=>point(p.x,p.z))});
  plan.nodes.push({id:`court-${site}`,island,point:roots[island]});
}
const house=COASTAL_OUTPOSTS.find(o=>o.id==='fisher-house'),[hx,hz]=outpostPosition(house);
roots.lanternCove=point(hx+.6,hz+1.15);plan.nodes.push({id:'fishing-court',island:'lanternCove',point:roots.lanternCove});

// Select dry abutments on real coast contours, considering both mesh tiers.
function landing(island,toward,offset,clearance){
  const i=w.ISLANDS[island],j=w.ISLANDS[toward],len=Math.hypot(j.x-i.x,j.z-i.z),dx=(j.x-i.x)/len,dz=(j.z-i.z)/len;
  let result;
  for(let d=0;d<Math.max(i.rx,i.rz)*1.5;d+=.1){
    const x=i.x+dx*d-dz*offset,z=i.z+dz*d+dx*offset;
    if(w.islandScore(x,z,i)<clearance)break;
    result=point(x,z);
  }
  return result;
}
for(const [a,b,kind]of [['hub','topics','stone'],['hub','progress','fortified'],['hub','records','stone'],['hub','calculator','fortified'],['progress','lanternCove','timber']]){
  let best;
  for(const offset of [-2,-1,0,1,2]){
    const width=kind==='timber'?1.25:kind==='fortified'?1.9:1.7;
    const pa=landing(a,b,offset,3.1),pb=landing(b,a,-offset,b==='lanternCove'?2.3:3.1);
    if(!pa||!pb)continue;
    const length=Math.hypot(pb[0]-pa[0],pb[2]-pa[2]);
    let obstruction=0;
    for(let j=0;j<=30;j++){
      const t=j/30,x=pa[0]+(pb[0]-pa[0])*t,z=pa[2]+(pb[2]-pa[2])*t;
      obstruction=Math.max(obstruction,safeSurface(x,z)-(pa[1]+(pb[1]-pa[1])*t));
    }
    const score=length+Math.abs(pb[1]-pa[1])*3+Math.max(0,obstruction)*20;
    // The short fishing spur uses timber treads rather than an overly steep
    // ramp. Main masonry crossings retain a conservative continuous grade.
    if(obstruction>.3||Math.abs(pb[1]-pa[1])/length>(kind==='timber'?.25:.16))continue;
    if(!best||score<best.score)best={score,id:`${a}-${b}`,from:`landing-${a}-${b}`,to:`landing-${b}-${a}`,islands:[a,b],kind,width,a:pa,b:pb,length:round(length),spans:Math.max(2,Math.ceil(length/(kind==='timber'?4.8:6.5)))};
  }
  if(!best)throw Error(`No safe bridge abutments: ${a} -> ${b}`);
  const {score,...bridge}=best;plan.bridges.push(bridge);
  plan.nodes.push({id:bridge.from,island:a,point:bridge.a},{id:bridge.to,island:b,point:bridge.b});
}

class Heap{
  a=[];
  push(item){let i=this.a.length;this.a.push(item);while(i){const p=(i-1)>>1;if(this.a[p][0]<=item[0])break;this.a[i]=this.a[p];i=p;}this.a[i]=item;}
  pop(){const root=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1][0]<this.a[c][0])c++;if(last[0]<=this.a[c][0])break;this.a[i]=this.a[c];i=c;}this.a[i]=last;}return root;}
}
const gridStep=.65,grids=new Map();
function gridFor(key){
  if(grids.has(key))return grids.get(key);
  const island=w.ISLANDS[key],minX=island.x-island.rx*1.4,minZ=island.z-island.rz*1.4,cols=Math.ceil(island.rx*2.8/gridStep),rows=Math.ceil(island.rz*2.8/gridStep);
  const heights=new Float32Array(cols*rows),valid=new Uint8Array(cols*rows);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x=minX+c*gridStep,z=minZ+r*gridStep,index=r*cols+c;
    heights[index]=safeSurface(x,z);
    const blocked=w.LANDMARK_SITE_KEYS.some(site=>Math.hypot(x-w.SITES[site][0],z-w.SITES[site][1])<5.65);
    const hamlet=key==='lanternCove'&&COASTAL_OUTPOSTS.filter(o=>o.island===key).some(o=>{const [sx,sz]=outpostPosition(o);return Math.abs(x-sx)<o.scale*1.8&&Math.abs(z-sz)<o.scale*1.55;});
    valid[index]=w.islandScore(x,z,island)>1.2&&!blocked&&!hamlet?1:0;
  }
  const grid={key,minX,minZ,cols,rows,heights,valid};grids.set(key,grid);return grid;
}
function route(island,start,end){
  const g=gridFor(island),{cols,rows}=g;
  const nearest=p=>{
    let best=-1,dist=Infinity;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(g.valid[r*cols+c]){
      const d=Math.hypot(g.minX+c*gridStep-p[0],g.minZ+r*gridStep-p[2]);if(d<dist){dist=d;best=r*cols+c;}
    }
    return best;
  };
  const source=nearest(start),target=nearest(end),cost=new Float64Array(cols*rows).fill(Infinity),prev=new Int32Array(cols*rows).fill(-1),heap=new Heap();
  cost[source]=0;heap.push([0,source]);
  while(heap.a.length){
    const [,current]=heap.pop();if(current===target)break;
    const cx=current%cols,cz=Math.floor(current/cols);
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
      const x=cx+dx,z=cz+dz,next=z*cols+x;
      if(x<0||z<0||x>=cols||z>=rows||!g.valid[next])continue;
      if(dx&&dz&&(!g.valid[cz*cols+x]||!g.valid[z*cols+cx]))continue;
      const run=Math.hypot(dx,dz)*gridStep,slope=Math.abs(g.heights[next]-g.heights[current])/run;
      if(slope>.7)continue;
      const value=cost[current]+run*(1+slope*.9+Math.max(0,slope-.23)**2*9);
      if(value<cost[next]){cost[next]=value;prev[next]=current;const h=Math.hypot(x-target%cols,z-Math.floor(target/cols))*gridStep;heap.push([value+h,next]);}
    }
  }
  if(!Number.isFinite(cost[target]))throw Error(`No dry path on ${island}`);
  const raw=[];for(let i=target;i!==-1;i=prev[i])raw.push([g.minX+(i%cols)*gridStep,g.minZ+Math.floor(i/cols)*gridStep]);raw.reverse();
  raw[0]=[start[0],start[2]];raw[raw.length-1]=[end[0],end[2]];
  // Simplify only safe gentle runs. Steep sections stay short enough for stairs.
  const safe=(a,b)=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(length/.25));let last;
    for(let j=0;j<=n;j++){
      const t=j/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
      if(w.islandScore(x,z,w.ISLANDS[island])<1.12||w.LANDMARK_SITE_KEYS.some(k=>Math.hypot(x-w.SITES[k][0],z-w.SITES[k][1])<5.5))return false;
      const h=w.terrainHeight(x,z);if(last!==undefined&&Math.abs(h-last)/(length/n)>.32)return false;last=h;
    }
    return true;
  };
  const simple=[raw[0]];for(let j=0;j<raw.length-1;){let k=Math.min(raw.length-1,j+7);while(k>j+1&&!safe(raw[j],raw[k]))k--;simple.push(raw[k]);j=k;}
  // Round grid corners within the dry corridor. Endpoints stay exact.
  if(simple.length>2){
    const rounded=[simple[0]];
    for(let j=1;j<simple.length-1;j++){
      const a=simple[j-1],p=simple[j],b=simple[j+1],q=[p[0]*.78+a[0]*.22,p[1]*.78+a[1]*.22],r=[p[0]*.78+b[0]*.22,p[1]*.78+b[1]*.22];
      if(safe(q,r)){rounded.push(q,r);}else rounded.push(p);
    }
    rounded.push(simple.at(-1));simple.splice(0,simple.length,...rounded);
  }
  const dense=[];
  for(let j=1;j<simple.length;j++){
    const a=simple[j-1],b=simple[j],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.28));
    for(let k=j===1?0:1;k<=steps;k++){const t=k/steps;dense.push(point(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t));}
  }
  return dense;
}
for(const bridge of plan.bridges)for(let side=0;side<2;side++){
  const island=bridge.islands[side],start=roots[island],end=side?bridge.b:bridge.a,root=plan.nodes.find(n=>n.island===island&&n.id.startsWith(island==='lanternCove'?'fishing':'court'));
  plan.paths.push({id:`approach-${bridge.id}-${side}`,island,from:root.id,to:side?bridge.to:bridge.from,width:bridge.kind==='timber'?1.05:1.35,points:route(island,start,end)});
}

// Pack both terrain-aligned tiers; generation and triangle lookups stop here.
plan.paths.push(...forecourts);
// A masonry bed raises short eroded hollows rather than following every bump.
// Resolve shared junction elevations together, then limit stair flights to 0.6
// rise/run. The fixed building entrances are already on level foundations.
for(const route of plan.paths)for(let j=0;j<route.points.length;j++){
  const p=route.points[j],a=route.points[Math.max(0,j-1)],b=route.points[Math.min(route.points.length-1,j+1)],length=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
  for(const side of [-.5,0,.5])p[1]=Math.max(p[1],safeSurface(p[0]-(b[2]-a[2])/length*route.width*side,p[2]+(b[0]-a[0])/length*route.width*side)+.09);
}
const junctions=new Map(plan.nodes.map(n=>[n.id,n.point[1]]));
for(let pass=0;pass<20;pass++){
  let changed=0;
  for(const route of plan.paths){
    const points=route.points;
    points[0][1]=Math.max(points[0][1],junctions.get(route.from)||-Infinity);
    points.at(-1)[1]=Math.max(points.at(-1)[1],junctions.get(route.to)||-Infinity);
    for(const direction of [1,-1])for(let k=1;k<points.length;k++){
      const j=direction===1?k:points.length-1-k,p=points[j],a=points[j-direction];
      p[1]=Math.max(p[1],a[1]-.6*Math.hypot(p[0]-a[0],p[2]-a[2]));
    }
    for(const [id,p]of [[route.from,points[0]],[route.to,points.at(-1)]]){const before=junctions.get(id)||-Infinity;junctions.set(id,Math.max(before,p[1]));if(p[1]>before+.00001)changed++;}
  }
  if(!changed)break;
}
for(const node of plan.nodes)node.point[1]=round(junctions.get(node.id));
for(const bridge of plan.bridges){bridge.a[1]=round(junctions.get(bridge.from));bridge.b[1]=round(junctions.get(bridge.to));}
for(const route of plan.paths)for(const p of route.points)p[1]=round(p[1]);
for(const route of plan.paths)route.ground=route.points.map((p,j)=>{
  const a=route.points[Math.max(0,j-1)],b=route.points[Math.min(route.points.length-1,j+1)],length=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
  return round(Math.min(...[-.55,0,.55].flatMap(side=>{
    const x=p[0]-(b[2]-a[2])/length*route.width*side,z=p[2]+(b[0]-a[0])/length*route.width*side;
    return [w.terrainHeight(x,z),...samplers.map(sample=>sample(x,z))];
  }))-.18);
});
const meshes={full:[],low:[]};
for(let tier=0;tier<2;tier++){
  for(const route of plan.paths){
    const points=route.points.map(p=>new T.Vector3(...p));
    const paving=(x,z)=>{
      let distance=Infinity,height=0;
      for(let j=1;j<points.length;j++){
        const a=points[j-1],b=points[j],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1))),d=(x-a.x-dx*t)**2+(z-a.z-dz*t)**2;
        if(d<distance){distance=d;height=a.y+(b.y-a.y)*t;}
      }
      return Math.max(height,samplers[tier](x,z)+.065);
    };
    const g=walkingRibbon(points,()=>route.width/2,paving);
    meshes[tier?'low':'full'].push({id:route.id,island:route.island,position:Array.from(g.attributes.position.array).map(round),normal:Array.from(g.attributes.normal.array).map(round),index:Array.from(g.index.array)});g.dispose();
  }
}
const dest=path.join(__dirname,'../lib/worldMap/generated/traversal.json');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(plan)+'\n');
const output=path.join(__dirname,'../public/world-map/traversal');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'paths.json'),JSON.stringify(meshes)+'\n');
console.log(`Baked ${plan.bridges.length} bridges and ${plan.paths.length} connected approaches.`);
for(const bridge of plan.bridges)console.log(`${bridge.id}: ${bridge.length.toFixed(1)}m, ${bridge.spans} spans, abutments ${bridge.a[1].toFixed(2)} / ${bridge.b[1].toFixed(2)}.`);

