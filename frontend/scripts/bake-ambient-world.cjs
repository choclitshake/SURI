// Offline harbor dressing, navigable water corridors, pedestrian routes and
// merged low-detail actor meshes. Nothing here runs in the browser.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),ts=require('typescript'),T=require('three');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const root=path.join(__dirname,'..'),w=require('../lib/worldMap/landscape.ts'),{TRAVERSAL,bridgeDeck}=require('../lib/worldMap/traversal.ts');
const {GARDENS,gardenApproach,HARBOR_BOATS}=require('../lib/worldMap/environmentDecor.ts'),{LANDMARK_SCALE}=require('../lib/worldMap/framing.ts');
const {VESSELS,makeAmbientPerson,makeAmbientVessel,makeAmbientPorts}=require('../lib/worldMap/ambientModels.ts');
const {geometryForShape}=require('../lib/worldMap/primitiveGeometry.ts'),{createTerrainSampler}=require('../lib/worldMap/walkingPaths.ts'),{makeStaticLighting}=require('../lib/worldMap/staticLighting.ts');
const {makeArchipelagoTerrain}=require('../lib/worldMap/terrainGeometry.ts'),{ArchitectureBuilder}=require('../lib/worldMap/architecture.ts');
const {mergeGeometries}=require('three/examples/jsm/utils/BufferGeometryUtils.js');
const {WATER_LEVEL}=require('../lib/worldMap/environment.ts');
const out=path.join(root,'public/world-map/ambient');fs.mkdirSync(out,{recursive:true});
const sourceFiles=['ambient.ts','ambientModels.ts','environmentDecor.ts','landscape.ts','terrainGeometry.ts','walkingPaths.ts','architecture.ts','traversal.ts','generated/traversal.json','primitiveGeometry.ts','architecturalGeometry.ts','environment.ts','worldPalette.ts','staticLighting.ts'];
const hash=crypto.createHash('sha256');for(const name of sourceFiles)hash.update(fs.readFileSync(path.join(root,'lib/worldMap',name),'utf8').replace(/\r\n/g,'\n'));
hash.update(fs.readFileSync(__filename,'utf8').replace(/\r\n/g,'\n'));for(const name of ['architecture/instances.json','traversal/paths.json'])hash.update(fs.readFileSync(path.join(root,'public/world-map',name)));
const architecture=JSON.parse(fs.readFileSync(path.join(root,'public/world-map/architecture/instances.json'))),paving=JSON.parse(fs.readFileSync(path.join(root,'public/world-map/traversal/paths.json')));
const models={},geometries={},chunks=[];let byteOffset=0;
const terrainSurfaces=[false,true].map(low=>createTerrainSampler(makeArchipelagoTerrain(low)));
const ground=(x,z)=>Math.max(w.terrainHeight(x,z),...terrainSurfaces.map(sample=>sample(x,z)));
function pack(name,g){
  const attributes={};
  const append=array=>{while(byteOffset%4){chunks.push(Buffer.alloc(1));byteOffset++;}const start=byteOffset,b=Buffer.from(array.buffer,array.byteOffset,array.byteLength);chunks.push(b);byteOffset+=b.length;return start;};
  for(const [key,a]of Object.entries(g.attributes)){
    if(!['position','normal','color','motionJoint','bakedLight','uv','windWeight'].includes(key))continue;
    let values,type='f32',normalized=false,itemSize=a.itemSize;
    if(key==='normal'){values=new Int16Array(a.count*4);for(let j=0;j<a.count;j++)for(let c=0;c<3;c++)values[j*4+c]=Math.round(a.array[j*3+c]*32767);type='i16';normalized=true;itemSize=4;}
    else if(key==='color'||key==='bakedLight'){values=new Uint8Array(a.count*4);for(let j=0;j<a.count;j++)for(let c=0;c<4;c++)values[j*4+c]=Math.round(Math.max(0,Math.min(1,c<a.itemSize?a.array[j*a.itemSize+c]:1))*255);type='u8';normalized=true;itemSize=4;}
    else if(key==='windWeight'){values=Uint8Array.from(a.array,v=>Math.round(v*255));type='u8';normalized=true;}
    else values=Float32Array.from(a.array);
    attributes[key]={type,itemSize,normalized,count:values.length,offset:append(values)};
  }
  const indices=g.index?Uint32Array.from(g.index.array):Uint32Array.from({length:g.attributes.position.count},(_,i)=>i);
  g.computeBoundingBox();g.computeBoundingSphere();geometries[name]={attributes,index:{type:'u32',count:indices.length,itemSize:1,normalized:false,offset:append(indices)},sphere:[...g.boundingSphere.center.toArray(),g.boundingSphere.radius],box:[...g.boundingBox.min.toArray(),...g.boundingBox.max.toArray()]};return name;
}
function batchGeometry(batch,transform=new T.Matrix4()){
  const pieces=batch.pieces.map(values=>{const unit=geometryForShape(batch.shape),g=unit.clone().applyMatrix4(transform.clone().multiply(new T.Matrix4().fromArray(values))),c=new T.Color().fromArray(values,16),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(a,3));if(batch.surface==='cloth')g.setAttribute('windWeight',new T.Float32BufferAttribute(Array.from(unit.attributes.position.array).filter((_,i)=>i%3===1).map(y=>Math.max(0,Math.min(1,.5-y))),1));g.deleteAttribute('uv');return g;});
  const merged=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());return merged;
}
const portDeck=Math.max(.85,w.terrainHeight(-27.4,21.05)+.12);
const ports=[
  {id:'lantern-merchant-quay',island:'lanternCove',deck:portDeck,start:[-27.4,23.45],end:[-30.8,26],width:1.25,walk:[]},
  {id:'starfall-trading-pier',island:'starfall',deck:.95,start:[-7.4,29.7],end:[-5.5,34.6],width:1.25,walk:[]},
];
const shoreStarts=[TRAVERSAL.nodes.find(n=>n.id==='fishing-court').point,[-7.35,Math.max(.95,w.terrainHeight(-7.35,28.9)+.1),28.9]];
for(let k=0;k<ports.length;k++){
  const port=ports[k],a=shoreStarts[k],end=k===0?[-27.4,portDeck,21.05]:[...port.start.slice(0,1),port.deck,port.start[1]],length=Math.hypot(end[0]-a[0],end[2]-a[2]),steps=Math.ceil(length/.18);
  for(let j=0;j<=steps;j++){const t=j/steps,x=a[0]+(end[0]-a[0])*t,z=a[2]+(end[2]-a[2])*t;port.walk.push([x,Math.max(a[1]+(end[1]-a[1])*t,ground(x,z)+.08),z]);}
}
const portBuilder=makeAmbientPorts(ports),portBatches=[...portBuilder.batches.values()].map(b=>({shape:b.shape,surface:b.surface,pieces:b.pieces.map(p=>[...p.matrix.toArray(),...p.color.toArray()])}));
const lightScene=JSON.parse(fs.readFileSync(path.join(root,'.cache/environment-bake/scene.json'))),light=makeStaticLighting(lightScene.size,new Float32Array(Uint8Array.from(fs.readFileSync(path.join(root,'.cache/environment-bake/height-coast.f32'))).buffer),lightScene.shadows);
const portParts=[];
for(const surface of [...new Set(portBatches.map(b=>b.surface))]){
  const parts=portBatches.filter(b=>b.surface===surface).map(b=>batchGeometry(b)),g=mergeGeometries(parts);light.geometry(g);portParts.push({surface,geometry:pack('port/'+surface,g)});parts.forEach(g=>g.dispose());g.dispose();
}
models.person=pack('person',makeAmbientPerson());
const radii={};for(const kind of Object.keys(VESSELS)){const g=makeAmbientVessel(kind),box=g.boundingBox;radii[kind]=Math.hypot(Math.max(Math.abs(box.min.x),Math.abs(box.max.x)),Math.max(Math.abs(box.min.z),Math.abs(box.max.z)))+.2;models[kind]=pack(kind,g);g.dispose();}

// Actual rendered surfaces, including stone steps and both road-mesh tiers.
const walkMeshes=[];
for(const tier of ['full','low'])for(const p of paving[tier]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p.position,3));g.setIndex(p.index);walkMeshes.push(g);}
for(const batches of [architecture.models.transport,architecture.models.decor,portBatches])for(const b of batches)if(b.surface==='road'||batches===portBatches&&b.surface==='wood')walkMeshes.push(batchGeometry(b));
for(const g of walkMeshes){for(const key of Object.keys(g.attributes))if(key!=='position')g.deleteAttribute(key);}
const walkMesh=mergeGeometries(walkMeshes),walkSurface=createTerrainSampler(walkMesh);walkMeshes.forEach(g=>g.dispose());
let repairedSurface;
const walkFloor=(x,z)=>Math.max(walkSurface(x,z),ground(x,z)+.04,repairedSurface?repairedSurface(x,z):-Infinity);

// Small offline collision index for standing/walking people. Primitive AABBs
// are conservative; arch openings are represented by their individual faces.
const boxes=[],bins=new Map();
function addBox(box,local,matrix){if(box.max.y-box.min.y<.005)return;const id=boxes.length;boxes.push({box,local,matrix,inverse:matrix.clone().invert()});for(let x=Math.floor(box.min.x-1);x<=Math.ceil(box.max.x+1);x++)for(let z=Math.floor(box.min.z-1);z<=Math.ceil(box.max.z+1);z++){const key=x+':'+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(id);}}
function appendBoxes(batches,world=new T.Matrix4()){
  for(const b of batches){if(['window','magic','glass','carving','cloth','leaves'].includes(b.surface))continue;
    const unit=geometryForShape(b.shape);unit.computeBoundingBox();
    for(const p of b.pieces){const matrix=world.clone().multiply(new T.Matrix4().fromArray(p));
      if(['ogive','bridgeArch'].includes(b.shape))continue;
      addBox(unit.boundingBox.clone().applyMatrix4(matrix),unit.boundingBox.clone(),matrix);
    }
  }
}
for(const kind of w.LANDMARK_SITE_KEYS)appendBoxes(architecture.models[kind],new T.Matrix4().makeTranslation(...w.sitePosition(kind)).scale(new T.Vector3().setScalar(LANDMARK_SCALE)));
for(const b of [architecture.models.coastal,architecture.models.transport,architecture.models.decor,portBatches])appendBoxes(b);
const probe=new T.Vector3(),closest=new T.Vector3();
function personClear(p){
  for(const id of bins.get(Math.floor(p[0])+':'+Math.floor(p[2]))??[]){const o=boxes[id],b=o.box;
    if(p[0]<=b.min.x-.14||p[0]>=b.max.x+.14||p[2]<=b.min.z-.14||p[2]>=b.max.z+.14||p[1]+.18>=b.max.y||p[1]+.98<=b.min.y)continue;
    for(const height of [.25,.53,.84]){probe.set(p[0],p[1]+height,p[2]);closest.copy(probe).applyMatrix4(o.inverse).clamp(o.local.min,o.local.max).applyMatrix4(o.matrix);if(closest.distanceToSquared(probe)<.14**2)return false;}
  }
  return true;
}
const routes=[],actors=[];
const round=n=>Math.round(n*10000)/10000;
function resample(raw,step=.16){
  const points=[raw[0]],distances=[0];for(let j=1;j<raw.length;j++){const a=raw[j-1],p=raw[j],d=Math.hypot(p[0]-a[0],p[1]-a[1],p[2]-a[2]);if(d<.00001)continue;points.push(p);distances.push(distances.at(-1)+d);}
  const length=distances.at(-1),n=Math.max(1,Math.ceil(length/step)),result=[];let j=1;
  for(let k=0;k<=n;k++){const d=length*k/n;while(j<distances.length-1&&distances[j]<d)j++;const t=(d-distances[j-1])/(distances[j]-distances[j-1]||1),a=points[j-1],b=points[j];result.push(a.map((v,c)=>round(v+(b[c]-v)*t)));}return {points:result,length};
}
function route(id,kind,points,closed=false,clearance=.14){const sampled=resample(points,kind==='water'?.4:.12);routes.push({id,kind,...sampled,closed,clearance});return routes.length-1;}
const citizens=['#c3b2dd','#d0bc9b','#aaa9c7','#b4c8aa','#d6c5b7'];
function citizen(id,index,phase=0,idle=false){const r=routes[index],n=actors.length,speed=.31+(n%5)*.023;actors.push({id,model:'person',route:index,duration:r.length/speed+1.2,pause:4+n%7,offset:phase,scale:.88+(n%4)*.045,tint:citizens[n%citizens.length],idle});}
function lanePoints(points,lane=0){return points.map((p,j)=>{const a=points[Math.max(0,j-1)],b=points[Math.min(points.length-1,j+1)],length=Math.hypot(b[0]-a[0],b[2]-a[2])||1,x=p[0]+(b[2]-a[2])/length*lane,z=p[2]-(b[0]-a[0])/length*lane;return [x,Math.max(p[1],walkFloor(x,z))+.025,z];});}
function validRuns(points){
  if(points.length<2)return [];
  const runs=[];let run=[];
  // Probe between authored waypoints as well, so a thin retaining wall cannot
  // slip between two valid endpoints. Align feet to actual paving/stair tops.
  for(const p of resample(points,.055).points){p[1]=Math.max(p[1],walkFloor(p[0],p[2])+.02);if(personClear(p)){run.push(p);}else{if(run.length>1)runs.push(run);run=[];}}
  if(run.length>1)runs.push(run);return runs.filter(r=>r.length>3&&resample(r).length>.75);
}
// Villagers travel from court to court across each bridge, with separate lanes.
for(const bridge of TRAVERSAL.bridges){
  const a=TRAVERSAL.paths.find(p=>p.to===bridge.from),b=TRAVERSAL.paths.find(p=>p.to===bridge.to),cross=[];
  for(let j=0;j<=Math.ceil(bridge.length/.14);j++){const t=j/Math.ceil(bridge.length/.14);cross.push([bridge.a[0]+(bridge.b[0]-bridge.a[0])*t,bridgeDeck(bridge,t)+.025,bridge.a[2]+(bridge.b[2]-bridge.a[2])*t]);}
  for(const lane of [-.19,.19]){
    const raw=lanePoints([...a.points,...cross,...b.points.slice().reverse()],lane),runs=validRuns(raw);
    const longest=runs.sort((a,b)=>resample(b).length-resample(a).length)[0];if(!longest)throw Error('No pedestrian crossing '+bridge.id);
    const index=route('crossing-'+bridge.id+'-'+lane,'walk',longest);citizen('traveler-'+actors.length,index,routes[index].length*.7+(lane>0?25:0));
  }
}
for(const p of TRAVERSAL.paths.filter(p=>p.id.startsWith('forecourt'))){
  const site=p.id.slice(10),[sx,sz]=w.SITES[site],raw=lanePoints(p.points.filter(p=>Math.hypot(p[0]-sx,p[2]-sz)>4.1),.2),run=validRuns(raw).sort((a,b)=>b.length-a.length)[0];
  if(run){const index=route(p.id,'walk',run);citizen('door-'+site,index,actors.length*1.7);
    const other=validRuns(lanePoints(p.points.filter(p=>Math.hypot(p[0]-sx,p[2]-sz)>4.1),-.24)).sort((a,b)=>b.length-a.length)[0];
    if(other){const gather=route(p.id+'-gather','walk',other);citizen('gather-'+site,gather,0,true);}
  }
}
for(const site of ['champions','calculator']){
  const [sx,sz]=w.SITES[site],island=w.SITE_ISLAND[site],candidates=[];
  for(const p of TRAVERSAL.paths.filter(p=>p.island===island))for(const lane of [-.27,.27])for(const point of lanePoints(p.points,lane)){
    const d=Math.hypot(point[0]-sx,point[2]-sz);if(d>5.7&&d<9&&personClear(point))candidates.push(point);
  }
  candidates.sort((a,b)=>Math.hypot(a[0]-sx,a[2]-sz)-Math.hypot(b[0]-sx,b[2]-sz));const chosen=[];
  for(const p of candidates){if(chosen.some(q=>Math.hypot(p[0]-q[0],p[2]-q[2])<1.1))continue;chosen.push(p);if(chosen.length===2)break;}
  chosen.forEach((p,j)=>{const angle=Math.atan2(sx-p[0],sz-p[2]),q=[p[0]+Math.sin(angle)*.01,p[1],p[2]+Math.cos(angle)*.01],index=route('gate-attendant-'+site+'-'+j,'walk',[p,q]);citizen('attendant-'+site+'-'+j,index,0,true);});
}
// A real closed patrol uses the keep's open paved training courtyard. Other
// citizens shuttle along their roads, giving the population different habits.
{
  const [sx,sz]=w.SITES.records,angle=Math.atan2(-sx,-sz),c=Math.cos(angle),s=Math.sin(angle),y=w.sitePosition('records')[1]+.39*LANDMARK_SCALE+.025,points=[];
  for(let j=0;j<=48;j++){const a=j/48*Math.PI*2,x=Math.cos(a)*1.15,z=2.4+Math.sin(a)*.65;points.push([sx+(x*c+z*s)*LANDMARK_SCALE,y,sz+(-x*s+z*c)*LANDMARK_SCALE]);}
  if(!points.every(personClear))throw Error('Training courtyard patrol is obstructed');
  const index=route('training-courtyard-patrol','walk',points,true),citizen=actors.find(a=>a.id==='door-records');
  if(!citizen)throw Error('Missing training courtyard citizen');citizen.route=index;citizen.duration=routes[index].length/.34+1.2;citizen.pause=7;citizen.offset=3;
}
const repairs=new ArchitectureBuilder(),gardenPaths=[];
for(const [j,garden]of GARDENS.entries()){
  const floor=Math.max(...[-1,0,1].flatMap(dx=>[-1,0,1].map(dz=>w.terrainHeight(garden.x+dx,garden.z+dz))))+.08;
  const raw=gardenApproach(garden).filter(p=>Math.hypot(p[0]-garden.x,p[1]-garden.z)>1.65).map(p=>{const d=Math.hypot(p[0]-garden.x,p[1]-garden.z);return [p[0],Math.max(ground(...p)+.065,floor-Math.max(0,d-1.25)*.6,walkFloor(...p))+.025,p[1]];});
  for(let k=1;k<raw.length;k++){
    const a=raw[k-1],c=raw[k],x=(a[0]+c[0])/2,z=(a[2]+c[2])/2,top=Math.max(a[1],c[1])-.02;
    if(ground(x,z)<walkSurface(x,z)-.015)continue;
    const length=Math.hypot(c[0]-a[0],c[2]-a[2]),bottom=ground(x,z)-.15;
    repairs.part('box','road','#b7ae92',x,(top+bottom)/2,z,.65,Math.max(.16,top-bottom),length+.035,0,Math.atan2(c[0]-a[0],c[2]-a[2]));
  }
  gardenPaths.push({id:j,raw});
}
if(repairs.batches.size){const batches=[...repairs.batches.values()].map(b=>({shape:b.shape,surface:b.surface,pieces:b.pieces.map(p=>[...p.matrix.toArray(),...p.color.toArray()])})),parts=batches.map(b=>batchGeometry(b)),g=mergeGeometries(parts);repairedSurface=createTerrainSampler(g);appendBoxes(batches);light.geometry(g);portParts.push({surface:'road',geometry:pack('aligned-garden-paving',g)});parts.forEach(p=>p.dispose());g.dispose();}
for(const {id,raw}of gardenPaths){const run=validRuns(raw).sort((a,b)=>b.length-a.length)[0];if(run){const index=route('garden-'+id,'walk',run);citizen('garden-visitor-'+id,index,id*5.3);}}
for(const port of ports){
  const raw=port.walk.slice();if(port.id.startsWith('lantern'))raw.push([-27.4,port.deck,23.45]);
  const L=Math.hypot(port.end[0]-port.start[0],port.end[1]-port.start[1]);for(let j=0;j<=Math.ceil(L/.15);j++){const t=j/Math.ceil(L/.15);raw.push([port.start[0]+(port.end[0]-port.start[0])*t,port.deck+.025,port.start[1]+(port.end[1]-port.start[1])*t]);}
  const run=validRuns(raw).sort((a,b)=>b.length-a.length)[0];if(!run)throw Error('No clear quay aisle '+port.id);
  for(const side of [-.12,.12]){const lane=validRuns(lanePoints(run,side)).sort((a,b)=>b.length-a.length)[0];if(!lane)throw Error('Obstructed dock-worker lane '+port.id);const index=route(port.id+'-'+side,'walk',lane);citizen('dock-worker-'+actors.length,index,side<0?0:17);}
}

// Conservative water navigation: the whole vessel fits within the free disk.
// Bridges, quays, anchored vessels and shoals are all offline obstacles.
const waterBoxes=[];for(const b of portBatches)for(const p of b.pieces){const g=geometryForShape(b.shape);g.computeBoundingBox();waterBoxes.push(g.boundingBox.clone().applyMatrix4(new T.Matrix4().fromArray(p)));}
const moored=[{kind:'harbor',point:[-35.8,29.8],yaw:-.3},{kind:'harbor',point:[-7.4,39],yaw:.2}];
const fixed=HARBOR_BOATS.map(p=>({x:p.x,z:p.z,r:1.65}));
function distanceSegment(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
function waterClear(x,z,r,anchors=true){
  const coast=w.shoreDistance(x,z);
  if(coast>-r-.55)return false;
  // Coast-distance alone underestimates the skirts of oblique narrow skerries.
  // Check the expanded northern seabed during the offline bake. Existing
  // southern harbor corridors retain their independently validated margins.
  if(z<-20&&coast>-r-3.5)for(let j=0;j<8;j++){
    const angle=j*Math.PI/4;
    if(w.terrainHeight(x+Math.sin(angle)*r,z+Math.cos(angle)*r)>-.8)return false;
  }
  for(const b of TRAVERSAL.bridges)if(distanceSegment(x,z,[b.a[0],b.a[2]],[b.b[0],b.b[2]])<r+b.width*.5+.65)return false;
  for(const b of waterBoxes)if(x>b.min.x-r-.25&&x<b.max.x+r+.25&&z>b.min.z-r-.25&&z<b.max.z+r+.25)return false;
  if(anchors&&fixed.some(p=>Math.hypot(x-p.x,z-p.z)<r+p.r+.5))return false;
  return true;
}
function nearestWater(point,r,anchors=true){let best,distance=Infinity;for(let dz=-12;dz<=12;dz+=.6)for(let dx=-12;dx<=12;dx+=.6){const d=dx*dx+dz*dz;if(d>=distance)continue;const x=point[0]+dx,z=point[1]+dz;if(waterClear(x,z,r,anchors)){distance=d;best=[x,z];}}if(!best)throw Error('No water near '+point);return best;}
for(const [i,boat]of moored.entries()){boat.point=nearestWater(boat.point,radii[boat.kind]);fixed.push({x:boat.point[0],z:boat.point[1],r:radii[boat.kind]});const index=route('mooring-'+i,'water',[[boat.point[0],WATER_LEVEL,boat.point[1]],[boat.point[0]+Math.sin(boat.yaw)*.01,WATER_LEVEL,boat.point[1]+Math.cos(boat.yaw)*.01]],false,radii[boat.kind]);actors.push({id:'moored-flagship-'+i,model:boat.kind,route:index,duration:480,pause:25,offset:1.3+i*4.7,scale:1,tint:'#ffffff',idle:true});}
const gridStep=1.2,minX=-126,minZ=-103,cols=211,rows=173,gridCache=new Map();
function gridFor(radius){const key=radius.toFixed(2);if(gridCache.has(key))return gridCache.get(key);const free=new Uint8Array(cols*rows);for(let j=0;j<free.length;j++)free[j]=waterClear(minX+j%cols*gridStep,minZ+Math.floor(j/cols)*gridStep,radius+.4)?1:0;gridCache.set(key,free);return free;}
class Heap{a=[];push(v){let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(this.a[p][0]<=v[0])break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}pop(){const root=this.a[0],v=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1][0]<this.a[c][0])c++;if(v[0]<=this.a[c][0])break;this.a[i]=this.a[c];i=c;}this.a[i]=v;}return root;}}
function waterPath(start,end,r){
  const free=gridFor(r),nearest=p=>{let best=-1,d=Infinity;for(let j=0;j<free.length;j++)if(free[j]){const value=(minX+j%cols*gridStep-p[0])**2+(minZ+Math.floor(j/cols)*gridStep-p[1])**2;if(value<d){d=value;best=j;}}return best;};
  const source=nearest(start),target=nearest(end),cost=new Float64Array(free.length).fill(Infinity),previous=new Int32Array(free.length).fill(-1),heap=new Heap();cost[source]=0;heap.push([0,source]);
  while(heap.a.length){const [,current]=heap.pop();if(current===target)break;const cx=current%cols,cz=Math.floor(current/cols);
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const x=cx+dx,z=cz+dz,next=z*cols+x;if(x<0||z<0||x>=cols||z>=rows||!free[next]||dx&&dz&&(!free[cz*cols+x]||!free[z*cols+cx]))continue;const value=cost[current]+Math.hypot(dx,dz);if(value<cost[next]){cost[next]=value;previous[next]=current;heap.push([value+Math.hypot(x-target%cols,z-Math.floor(target/cols)),next]);}}
  }
  if(!Number.isFinite(cost[target]))throw Error('Disconnected marine corridor '+start+' -> '+end);
  const raw=[];for(let j=target;j!==-1;j=previous[j])raw.push([minX+j%cols*gridStep,minZ+Math.floor(j/cols)*gridStep]);raw.reverse();
  const clear=(a,b)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.3);for(let j=0;j<=n;j++)if(!waterClear(a[0]+(b[0]-a[0])*j/(n||1),a[1]+(b[1]-a[1])*j/(n||1),r+.2))return false;return true;};
  const simple=[raw[0]];for(let j=0;j<raw.length-1;){let k=Math.min(raw.length-1,j+18);while(k>j+1&&!clear(raw[j],raw[k]))k--;simple.push(raw[k]);j=k;}
  const rounded=[simple[0]];for(let j=1;j<simple.length-1;j++){const a=simple[j-1],b=simple[j],c=simple[j+1],q=[b[0]*.72+a[0]*.28,b[1]*.72+a[1]*.28],p=[b[0]*.72+c[0]*.28,b[1]*.72+c[1]*.28];if(clear(q,p)){for(let k=0;k<=8;k++){const t=k/8;rounded.push([(1-t)**2*q[0]+2*(1-t)*t*b[0]+t*t*p[0],(1-t)**2*q[1]+2*(1-t)*t*b[1]+t*t*p[1]]);}}else rounded.push(b);}rounded.push(simple.at(-1));return rounded;
}
const traffic=[
  ['merchant','western-arrival',[[-112,72],[-63,43],[-38,36]],510,174],
  ['transport','starfall-outbound',[[-2,39],[5,61],[74,99]],430,105],
  ['fishing','western-fisher',[[-60,14],[-65,-12],[-53,-42],[-29,-55]],570,90],
  ['rowboat','coastal-skiff',[[-31,31],[-24,36],[-21,24]],350,128],
  ['merchant','northern-trade',[[117,-84],[57,-53],[13,-57]],600,360],
  ['transport','outer-supply',[[-17,42],[-20,53],[-66,63]],480,82],
  ['fishing','eastern-fishing',[[66,-13],[65,10],[61,41]],390,180],
  ['rowboat','lantern-shuttle',[[-44,17],[-42,22],[-36,18]],325,170],
  ['fishing','harbor-ferry',[[-24,32],[-22,41],[-18,36]],410,147],
  ['merchant','southern-arrival',[[41,101],[14,67],[-15,47]],550,364],
  ['fishing','topics-coast',[[-5,-56],[-26,-53],[-39,-45],[-48,-29]],460,175],
  ['transport','east-outbound',[[66,25],[85,30],[125,49]],540,55],
  ['fishing','outer-harbor-loop',[[-55,27],[-59,37],[-50,43],[-44,38],[-44,28],[-55,27]],590,236],
];
for(const [kind,id,waypoints,duration,offset]of traffic){const r=radii[kind],raw=[];for(let j=1;j<waypoints.length;j++){const segment=waterPath(waypoints[j-1],waypoints[j],r);raw.push(...(j===1?segment:segment.slice(1)));}const closed=id.endsWith('loop'),points=raw.map(p=>[p[0],WATER_LEVEL,p[1]]);if(closed)points.push(points[0]);const index=route(id,'water',points,closed,r);actors.push({id,model:kind,route:index,duration,pause:25+actors.length%4*9,offset,scale:1,tint:actors.length%2?'#f1e6da':'#e4d8f1'});}

// Traffic repeats every twenty minutes. Offline right-of-way scheduling keeps
// whole vessels apart across that complete period, with no runtime avoidance.
const {makeAmbientPose,sampleAmbientActor}=require('../lib/worldMap/ambient.ts');
const trafficPeriod=1200,trafficStep=.5,trafficFrames=trafficPeriod/trafficStep,boats=actors.filter(a=>a.model!=='person');
let voyageIndex=0;
for(const a of boats)if(!a.idle){if(routes[a.route].closed){a.duration=600;a.pause=0;}else{a.duration=480+(voyageIndex++%5)*25;a.pause=600-a.duration;}}
const tracks=new Map();
for(const a of boats){const track=new Float32Array(trafficFrames*4),pose=makeAmbientPose();for(let j=0;j<trafficFrames;j++){sampleAmbientActor({...a,offset:0},routes[a.route],j*trafficStep,pose);track.set([pose.x,pose.z,Math.sin(pose.yaw),Math.cos(pose.yaw)],j*4);}tracks.set(a,track);}
function shipDimensions(a){const box=geometries[models[a.model]].box;return [(box[3]-box[0])/2+.28,(box[5]-box[2])/2+.28];}
function overlaps(a,offset,b){
  const A=tracks.get(a),B=tracks.get(b),[aw,al]=shipDimensions(a),[bw,bl]=shipDimensions(b),shift=Math.round(offset/trafficStep),otherShift=Math.round(b.offset/trafficStep),radius=Math.hypot(aw,al)+Math.hypot(bw,bl);
  for(let j=0;j<trafficFrames;j++){
    const ia=((j+shift)%trafficFrames)*4,ib=((j+otherShift)%trafficFrames)*4,dx=B[ib]-A[ia],dz=B[ib+1]-A[ia+1];if(dx*dx+dz*dz>radius*radius)continue;
    const as=A[ia+2],ac=A[ia+3],bs=B[ib+2],bc=B[ib+3];
    let separated=false;for(const [x,z]of [[as,ac],[ac,-as],[bs,bc],[bc,-bs]]){const distance=Math.abs(dx*x+dz*z),ra=Math.abs(as*x+ac*z)*al+Math.abs(ac*x-as*z)*aw,rb=Math.abs(bs*x+bc*z)*bl+Math.abs(bc*x-bs*z)*bw;if(distance>=ra+rb){separated=true;break;}}
    if(!separated)return true;
  }
  return false;
}
const fixedSchedule=boats.filter(a=>a.idle),moving=boats.filter(a=>!a.idle).sort((a,b)=>{
  const priority=id=>id==='outer-harbor-loop'?0:id==='coastal-skiff'?1:id==='harbor-ferry'?2:id==='lantern-shuttle'?3:4;return priority(a.id)-priority(b.id);
});
let scheduled=false,failedActor='';
for(let attempt=0;attempt<20&&!scheduled;attempt++){
  const chosen=[...fixedSchedule];scheduled=true;
  for(let j=0;j<moving.length;j++){
    const a=moving[j],cycle=routes[a.route].closed?a.duration:trafficPeriod,preferred=(a.offset+attempt*(37+j*11))%cycle;
    let found=false;
    for(let k=0;k<cycle/5;k++){
      const offset=(Math.round(preferred/5)*5+k*5)%cycle;
      if(chosen.every(b=>!overlaps(a,offset,b))){a.offset=offset;chosen.push(a);found=true;break;}
    }
    if(!found){failedActor=a.id;scheduled=false;break;}
  }
}
if(!scheduled)throw Error('Unable to schedule safe twenty-minute harbor traffic: '+failedActor);
const fountains=GARDENS.filter(g=>g.kind==='fountain').map(g=>({x:g.x,z:g.z,y:Math.max(...[-1,0,1].flatMap(dx=>[-1,0,1].map(dz=>w.terrainHeight(g.x+dx,g.z+dz))))+.08}));
const raw=Buffer.concat(chunks);fs.writeFileSync(path.join(out,'ambient.bin'),raw);fs.writeFileSync(path.join(out,'ambient.bin.gz'),zlib.gzipSync(raw,{level:9}));
const manifest={version:1,sourceHash:hash.digest('hex'),sourceFiles,buffer:'ambient.bin',compressedBuffer:'ambient.bin.gz',geometries,models,ports,portParts,routes,actors,fountains,trafficPeriod,waterObstacles:waterBoxes.map(b=>[...b.min.toArray(),...b.max.toArray()]),moored:fixed};
fs.writeFileSync(path.join(out,'ambient.json'),JSON.stringify(manifest)+'\n');
console.log(`Baked ${actors.filter(a=>a.model==='person').length} citizens, ${actors.filter(a=>a.model!=='person').length} vessels, ${routes.length} routes and ${ports.length} working quays. ${(raw.length/1024).toFixed(0)} KiB geometry, ${(fs.statSync(path.join(out,'ambient.bin.gz')).size/1024).toFixed(0)} KiB gzip.`);
