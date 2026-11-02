/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const root=path.join(__dirname,'..'),w=require('../lib/worldMap/landscape.ts'),{TRAVERSAL}=require('../lib/worldMap/traversal.ts');
const {GARDENS,gardenApproach,HARBOR_BOATS}=require('../lib/worldMap/environmentDecor.ts');
const {makeStaticLighting}=require('../lib/worldMap/staticLighting.ts'),{LOCAL_SUN,WATER_LEVEL}=require('../lib/worldMap/environment.ts');
assert.equal(GARDENS.length,9);
for(const site of w.LANDMARK_SITE_KEYS)assert(GARDENS.some(g=>g.site===site));
for(const garden of GARDENS){
  const points=gardenApproach(garden),site=w.SITES[garden.site],island=w.ISLANDS[w.SITE_ISLAND[garden.site]];
  assert(points.length>1,`${garden.site}: accessible ${garden.kind}`);
  for(const p of points){assert(w.islandScore(...p,island)>1.2);assert(Math.hypot(p[0]-site[0],p[1]-site[1])>=5.55,'garden link avoids the occupied foundation');}
  const end=points.at(-1);assert(TRAVERSAL.paths.some(p=>p.island===w.SITE_ISLAND[garden.site]&&p.points.some(a=>Math.hypot(a[0]-end[0],a[2]-end[1])<1e-8)),'garden link joins a real approach');
}
for(const boat of HARBOR_BOATS)for(let i=0;i<=8;i++)for(let j=0;j<=16;j++){
  const x=(i/8-.5)*1.1,z=(j/16-.5)*2.4,px=boat.x+x*Math.cos(boat.turn)+z*Math.sin(boat.turn),pz=boat.z-x*Math.sin(boat.turn)+z*Math.cos(boat.turn);
  assert(w.terrainHeight(px,pz)<WATER_LEVEL-.5,'hull bounding footprint clears submerged rock, including bobbing');
}
// A fixed raised blocker must cast a sun-opposite shadow; a receiver on its
// sunward side remains bright. This checks the bake rather than shader strings.
const size=256,terrain=new Float32Array(size*size*2),clear=makeStaticLighting(size,terrain,[]),blocked=makeStaticLighting(size,terrain,[{x:0,z:0,top:8,ground:0,rx:1,rz:1,leaves:false}]);
const x=-LOCAL_SUN[0]/LOCAL_SUN[1]*3,z=-LOCAL_SUN[2]/LOCAL_SUN[1]*3;
assert(blocked.sample(x,0,z)[2]<.3,'directional cast shadow');
assert(blocked.sample(-x,0,-z)[2]>.9,'sunward receiver');
assert(clear.sample(x,0,z)[0]>blocked.sample(x,0,z)[0]*2,'baked irradiance includes shadow visibility');
for(const tier of ['high','balanced']){
  const m=JSON.parse(fs.readFileSync(path.join(root,`public/world-map/scene/${tier}.json`))),buffer=fs.readFileSync(path.join(root,'public/world-map/scene',m.buffer));
  const baked=[...Object.values(m.terrain),...Object.values(m.roads),...Object.values(m.landmarks).flat().map(p=>p.geometry),...m.dressings.map(p=>p.geometry)];
  for(const id of baked){const g=m.geometries[id],a=g.attributes.bakedLight;assert(a&&a.type==='u8'&&a.normalized&&a.itemSize===4);assert.equal(a.count,g.attributes.position.count/3*4);const data=buffer.subarray(a.offset,a.offset+a.count);assert(data.some(v=>v>0),'nonempty light bake');}
  for(const p of m.dressings.filter(p=>p.surface==='cloth'))assert(m.geometries[p.geometry].attributes.windWeight,'static flag envelope with GPU fabric motion');
  for(const p of m.harbor)assert(m.geometries[p.geometry].attributes.motionPhase,'GPU-only boat motion');
  assert.equal(m.boatShadows.length,2);
}
console.log('PASS: nine connected garden clusters, clear boat hulls, fixed directional shadows and compact light/AO data on all static terrain, paving and architecture.');

// Exercise Fiber's real store subscription: setDpr calls its camera resize
// helper. The application-owned frustum must survive every quality adjustment.
(async()=>{
  const T=require('three'),{createRoot,_roots}=require('@react-three/fiber');
  const canvas={},root=createRoot(canvas),store=_roots.get(canvas).store;
  const camera=new T.OrthographicCamera(-64,64,40,-40,.5,650);camera.manual=true;camera.zoom=1.375;camera.position.set(45,121,190);camera.lookAt(0,1,-8);camera.updateProjectionMatrix();
  let resizes=0;const renderer={setPixelRatio(){},setSize(){resizes++;}};
  store.setState({camera,gl:renderer});store.getState().setSize(1440,900);
  const projection=camera.projectionMatrix.toArray(),position=camera.position.toArray();
  for(const dpr of [1,.9,1.15,1]){store.getState().setDpr(dpr);assert.deepEqual(camera.projectionMatrix.toArray(),projection);assert.deepEqual(camera.position.toArray(),position);}
  assert(resizes>=4,'actual renderer resize subscription exercised');
  await root.unmount();
  console.log('PASS: real Fiber DPR changes preserve the original orthographic projection and camera position.');
})().catch(error=>{console.error(error);process.exitCode=1;});
