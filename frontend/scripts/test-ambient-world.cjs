/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib'),ts=require('typescript'),T=require('three');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const root=path.join(__dirname,'..'),folder=path.join(root,'public/world-map/ambient'),m=JSON.parse(fs.readFileSync(path.join(folder,'ambient.json'))),buffer=fs.readFileSync(path.join(folder,m.buffer));
const w=require('../lib/worldMap/landscape.ts'),{TRAVERSAL}=require('../lib/worldMap/traversal.ts'),{makeAmbientPose,sampleAmbientActor}=require('../lib/worldMap/ambient.ts');
const {makeArchipelagoTerrain}=require('../lib/worldMap/terrainGeometry.ts'),{createTerrainSampler}=require('../lib/worldMap/walkingPaths.ts');
const {geometryForShape}=require('../lib/worldMap/primitiveGeometry.ts'),{LANDMARK_SCALE,worldFrame}=require('../lib/worldMap/framing.ts');
const {responsiveCamera}=require('../lib/worldMap/responsiveCamera.ts'),{playableProjectionBounds}=require('../lib/worldMap/worldBounds.ts');
const hash=crypto.createHash('sha256');for(const file of m.sourceFiles)hash.update(fs.readFileSync(path.join(root,'lib/worldMap',file),'utf8').replace(/\r\n/g,'\n'));hash.update(fs.readFileSync(path.join(__dirname,'bake-ambient-world.cjs'),'utf8').replace(/\r\n/g,'\n'));for(const file of ['architecture/instances.json','traversal/paths.json'])hash.update(fs.readFileSync(path.join(root,'public/world-map',file)));assert.equal(hash.digest('hex'),m.sourceHash,'ambient bake matches current terrain, roads, architecture and authoring');
assert.deepEqual(zlib.gunzipSync(fs.readFileSync(path.join(folder,m.compressedBuffer))),buffer);
assert(buffer.length<600*1024);assert(fs.statSync(path.join(folder,m.compressedBuffer)).size<100*1024);
const types={f32:Float32Array,i16:Int16Array,u8:Uint8Array,u32:Uint32Array};
const read=a=>new types[a.type](buffer.buffer,buffer.byteOffset+a.offset,a.count),decode=id=>{const packed=m.geometries[id],g=new T.BufferGeometry();for(const [key,a]of Object.entries(packed.attributes)){assert.equal(a.offset%4,0);assert(read(a).every(Number.isFinite));g.setAttribute(key,new T.BufferAttribute(read(a),a.itemSize,a.normalized));}g.setIndex(new T.BufferAttribute(read(packed.index),1));return g;};
for(const id of Object.keys(m.geometries)){const g=decode(id);assert(Math.max(...g.index.array)<g.attributes.position.count);g.dispose();}
assert.equal(Object.keys(m.models).length,6);assert.equal(m.ports.length,2);assert(m.actors.filter(a=>a.model==='person').length>=30);
assert(m.actors.some(a=>a.model==='person'&&m.routes[a.route].closed),'a citizen follows a closed courtyard loop');
for(const part of m.portParts){assert(m.geometries[part.geometry].attributes.bakedLight);if(part.surface==='cloth')assert(m.geometries[part.geometry].attributes.windWeight);}
const terrain=[false,true].map(low=>createTerrainSampler(makeArchipelagoTerrain(low)));
function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t);}
let waterSamples=0,walkSamples=0;
for(const route of m.routes){
  assert(route.points.length>=2&&route.points.flat().every(Number.isFinite));
  const distances=route.points.slice(1).map((p,i)=>Math.hypot(...p.map((v,c)=>v-route.points[i][c]))),spacing=route.length/(route.points.length-1);
  assert(Math.max(...distances)<spacing*1.04+.001,'precomputed uniform route lookup');
  if(route.closed)assert(Math.hypot(...route.points[0].map((v,c)=>v-route.points.at(-1)[c]))<.001,'closed routes do not teleport');
  for(const p of route.points){
    if(route.kind==='water'){
      const r=route.clearance;assert(w.shoreDistance(p[0],p[2])<-r-.45,route.id+': full vessel coast clearance');
      for(const bridge of TRAVERSAL.bridges)assert(segmentDistance(p[0],p[2],bridge.a,bridge.b)>r+bridge.width/2+.5,route.id+': avoids bridge/piers');
      for(const b of m.waterObstacles)assert(!(p[0]>b[0]-r-.1&&p[0]<b[3]+r+.1&&p[2]>b[2]-r-.1&&p[2]<b[5]+r+.1),route.id+': clear of quay');
      for(let j=0;j<8;j++){const angle=j*Math.PI/4;assert(w.terrainHeight(p[0]+Math.sin(angle)*r,p[2]+Math.cos(angle)*r)<-.65,route.id+': submerged rock clears hull');}waterSamples++;
    }else{
      assert(p[1]>.5,'pedestrians remain above water');assert(p[1]>Math.max(...terrain.map(sample=>sample(p[0],p[2])))-.11,route.id+': feet clear both terrain tiers');walkSamples++;
    }
  }
}
// Test against actual structural triangles, including open arches. Three small
// body spheres follow the route; this is offline geometry QA, not a Raycaster.
const architecture=JSON.parse(fs.readFileSync(path.join(root,'public/world-map/architecture/instances.json'))),faces=[],faceNames=[],bins=new Map();
function addTriangles(g,name){const p=g.attributes.position,index=g.index;for(let j=0;j<(index?.count??p.count);j+=3){const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,index?index.getX(j+k):j+k)),box=new T.Box3().setFromPoints(v),id=faces.length;faces.push(new T.Triangle(...v));faceNames.push(name);for(let x=Math.floor(box.min.x);x<=Math.floor(box.max.x);x++)for(let z=Math.floor(box.min.z);z<=Math.floor(box.max.z);z++){const key=x+':'+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(id);}}}
for(const [kind,batches]of Object.entries(architecture.models)){
  if(!w.LANDMARK_SITE_KEYS.includes(kind)&&!['transport','coastal','decor'].includes(kind))continue;
  const world=w.LANDMARK_SITE_KEYS.includes(kind)?new T.Matrix4().makeTranslation(...w.sitePosition(kind)).scale(new T.Vector3().setScalar(LANDMARK_SCALE)):new T.Matrix4();
  for(const b of batches){if(['window','glass','magic','carving','leaves','cloth'].includes(b.surface))continue;for(const a of b.pieces){const g=geometryForShape(b.shape).clone().applyMatrix4(world.clone().multiply(new T.Matrix4().fromArray(a)));addTriangles(g,kind+'/'+b.shape+'/'+b.surface);g.dispose();}}
}
for(const part of m.portParts){if(part.surface==='cloth')continue;const g=decode(part.geometry);addTriangles(g,part.geometry);g.dispose();}
const point=new T.Vector3(),closest=new T.Vector3();
for(const route of m.routes.filter(r=>r.kind==='walk'))for(let j=0;j<route.points.length;j+=2){const p=route.points[j];for(const h of [.28,.58,.86]){point.set(p[0],p[1]+h,p[2]);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const id of bins.get((Math.floor(p[0])+dx)+':'+(Math.floor(p[2])+dz))??[]){faces[id].closestPointToPoint(point,closest);assert(closest.distanceToSquared(point)>.085**2,`${route.id}: body intersects ${faceNames[id]} at ${p}, h=${h}`);}}}
for(const actor of m.actors){
  const route=m.routes[actor.route];assert(route&&m.models[actor.model]);
  if(actor.model!=='person'&&!actor.idle)assert(actor.duration>=300&&actor.duration<=600,'five to ten minute vessel journeys');
  const pose=makeAmbientPose(),again=makeAmbientPose(),end=actor.duration*2+actor.pause*2;
  for(let t=0;t<end;t+=.37){sampleAmbientActor(actor,route,t,pose);sampleAmbientActor(actor,route,t,again);assert.deepEqual(pose,again,'deterministic playback');assert(Object.values(pose).every(Number.isFinite));}
  if(!actor.idle&&!route.closed){sampleAmbientActor({...actor,offset:0},route,actor.duration+actor.pause*.5,pose);assert.equal(pose.moving,0,'occasional endpoint idle');}
}
for(const bridge of TRAVERSAL.bridges){
  const dx=bridge.b[0]-bridge.a[0],dz=bridge.b[2]-bridge.a[2],length2=dx*dx+dz*dz;
  assert(m.routes.filter(r=>r.id.startsWith('crossing-'+bridge.id)).some(r=>{
    const values=r.points.filter(p=>segmentDistance(p[0],p[2],bridge.a,bridge.b)<bridge.width/2).map(p=>((p[0]-bridge.a[0])*dx+(p[2]-bridge.a[2])*dz)/length2);
    return Math.min(...values)<.06&&Math.max(...values)>.94;
  }),bridge.id+': a pedestrian route crosses the complete bridge');
}
// Independently replay the complete repeating timetable at quarter-second
// intervals. Oriented full-model footprints include sails and rowing oars.
assert.equal(m.trafficPeriod,1200);
const vessels=m.actors.filter(a=>a.model!=='person'),poses=vessels.map(makeAmbientPose),dimensions=vessels.map(a=>{const b=m.geometries[m.models[a.model]].box;return [(b[3]-b[0])/2+.08,(b[5]-b[2])/2+.08];});
for(const a of vessels.filter(a=>!a.idle))assert.equal(m.trafficPeriod%(m.routes[a.route].closed?a.duration:2*(a.duration+a.pause)),0,'traffic timetable repeats exactly');
for(let t=0;t<m.trafficPeriod;t+=.25){
  vessels.forEach((a,i)=>sampleAmbientActor(a,m.routes[a.route],t,poses[i]));
  for(let i=0;i<vessels.length;i++)for(let j=i+1;j<vessels.length;j++){
    const a=poses[i],b=poses[j],dx=b.x-a.x,dz=b.z-a.z,[aw,al]=dimensions[i],[bw,bl]=dimensions[j];
    if(dx*dx+dz*dz>(Math.hypot(aw,al)+Math.hypot(bw,bl))**2)continue;
    let separate=false;for(const angle of [a.yaw,a.yaw+Math.PI/2,b.yaw,b.yaw+Math.PI/2]){const x=Math.sin(angle),z=Math.cos(angle),ra=Math.abs(Math.sin(a.yaw)*x+Math.cos(a.yaw)*z)*al+Math.abs(Math.cos(a.yaw)*x-Math.sin(a.yaw)*z)*aw,rb=Math.abs(Math.sin(b.yaw)*x+Math.cos(b.yaw)*z)*bl+Math.abs(Math.cos(b.yaw)*x-Math.sin(b.yaw)*z)*bw;if(Math.abs(dx*x+dz*z)>=ra+rb){separate=true;break;}}
    assert(separate,`vessel overlap: ${vessels[i].id} / ${vessels[j].id} at ${t}s`);
  }
}
const frame=worldFrame(1440,900,playableProjectionBounds()),response=responsiveCamera(1440,900,playableProjectionBounds(),false,88),camera=new T.OrthographicCamera(-64,64,40,-40,.5,650);camera.position.copy(response.position);camera.quaternion.copy(response.quaternion);camera.zoom=response.zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld();
const projection=p=>new T.Vector3(...p).applyAxisAngle(new T.Vector3(0,1,0),frame.rotation).multiplyScalar(frame.scale).add(new T.Vector3(...frame.position)).project(camera);
let arrivals=0;for(const a of m.actors.filter(a=>a.model!=='person'&&!a.idle)){const r=m.routes[a.route],p=projection(r.points[0]),q=projection(r.points.at(-1));if((Math.abs(p.x)>1.15||Math.abs(p.y)>1.15)&&(Math.abs(q.x)<1.15&&Math.abs(q.y)<1.15))arrivals++;}assert(arrivals>=2,'offscreen arrivals reach visible coastal water');
console.log(`PASS: ${m.actors.length} deterministic actors; ${waterSamples} water and ${walkSamples} walking samples; actual structural clearance, two terrain tiers, five-to-ten-minute voyages, a safe repeating twenty-minute vessel timetable and ${arrivals} offscreen arrivals. ${(buffer.length/1024).toFixed(0)} KiB buffers.`);
