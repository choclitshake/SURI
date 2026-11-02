/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),T=require('three');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const w=require('../lib/worldMap/landscape.ts'),{TRAVERSAL,bridgeDeck}=require('../lib/worldMap/traversal.ts');
const {makeArchipelagoTerrain}=require('../lib/worldMap/terrainGeometry.ts'),{createTerrainSampler}=require('../lib/worldMap/walkingPaths.ts');
const f=require('../lib/worldMap/framing.ts'),{PROJECTED_LANDMARKS}=require('../lib/worldMap/landmarkInteraction.ts');
const plan=TRAVERSAL,graph=new Map();
function edge(a,b){if(!graph.has(a))graph.set(a,[]);graph.get(a).push(b);}
for(const e of [...plan.paths,...plan.bridges]){edge(e.from,e.to);edge(e.to,e.from);}
const seen=new Set(),queue=['entrance-keep'];while(queue.length){const id=queue.pop();if(seen.has(id))continue;seen.add(id);queue.push(...(graph.get(id)||[]));}
for(const site of w.LANDMARK_SITE_KEYS)assert(seen.has(`entrance-${site}`),`${site}: connected entrance`);
assert(seen.has('fishing-court'));assert.equal(plan.bridges.length,5);assert.equal(plan.paths.length,15);
const samplers=[false,true].map(low=>createTerrainSampler(makeArchipelagoTerrain(low)));
let worstPenetration=0,maxGrade=0;
for(const bridge of plan.bridges){
  for(const endpoint of [bridge.a,bridge.b])assert(w.shoreDistance(endpoint[0],endpoint[2])>2,`${bridge.id}: dry abutment`);
  const slope=Math.abs(bridge.a[1]-bridge.b[1])/bridge.length;
  assert(slope<(bridge.kind==='timber'?.25:.16));
  for(let j=1;j<100;j++){
    const t=j/100,x=bridge.a[0]+(bridge.b[0]-bridge.a[0])*t,z=bridge.a[2]+(bridge.b[2]-bridge.a[2])*t;
    const ground=Math.max(...samplers.map(s=>s(x,z)));
    worstPenetration=Math.max(worstPenetration,ground-bridgeDeck(bridge,t));
    assert(bridgeDeck(bridge,t)>0.7,`${bridge.id}: water clearance`);
  }
  for(const point of [bridge.a,bridge.b]){
    const approach=plan.paths.find(p=>p.to=== (point===bridge.a?bridge.from:bridge.to));
    assert.deepEqual(approach.points.at(-1),point,`${bridge.id}: exact approach/deck junction`);
  }
}
assert(worstPenetration<.12,`bridge decks clear coast geometry (${worstPenetration})`);
for(const route of plan.paths){
  assert(route.width>=1);
  for(let j=0;j<route.points.length;j++){
    const p=route.points[j];assert(w.islandScore(p[0],p[2],w.ISLANDS[route.island])>.8,`${route.id}: dry path`);
    if(j){const a=route.points[j-1],grade=Math.abs(p[1]-a[1])/Math.hypot(p[0]-a[0],p[2]-a[2]);maxGrade=Math.max(maxGrade,grade);}
  }
}
const packed=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/world-map/traversal/paths.json')));
for(const [tier,routes]of Object.entries(packed)){
  const surface=samplers[tier==='low'?1:0];assert.equal(routes.length,15);
  for(const route of routes){
    assert.equal(route.position.length,route.normal.length);
    for(let j=0;j<route.position.length;j+=3){const [x,y,z]=route.position.slice(j,j+3);assert(y-surface(x,z)>.06,`${tier}: paving clears terrain at ${x},${z}`);assert(y-surface(x,z)<4,`${tier}: bounded retaining foundation ${route.id} ${x},${z}, gap ${y-surface(x,z)}`);}
  }
}
// Compare the cached interaction region to independent camera projection at
// desktop/tablet/phone scales, including camera translation and zoom.
for(const [width,height]of [[390,844],[768,1024],[1024,768],[1440,900]])for(const zoom of [1,1.4]){
  const camera=new T.OrthographicCamera(-40*width/height,40*width/height,40,-40,.5,650);
  camera.position.set(...f.CAMERA_POSITION);camera.lookAt(...f.CAMERA_TARGET);camera.position.x+=.7;camera.zoom=zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  for(const site of w.LANDMARK_SITE_KEYS){
    const root=new T.Vector3(...w.sitePosition(site)).applyAxisAngle(new T.Vector3(0,1,0),f.WORLD_ROTATION),projected=root.clone().project(camera),shape=PROJECTED_LANDMARKS[site],ppu=height/80*zoom;
    const left=(projected.x*.5+.5)*width+shape.minX*ppu,top=(-projected.y*.5+.5)*height-shape.maxY*ppu;
    const [bw,bh,bd]=f.LANDMARK_BOUNDS[site],pixels=[];
    for(const x of [-bw/2,bw/2])for(const y of [.7,bh])for(const z of [-bd/2,bd/2]){
      const p=new T.Vector3(x,y,z).multiplyScalar(f.LANDMARK_SCALE).applyAxisAngle(new T.Vector3(0,1,0),f.WORLD_ROTATION).add(root).project(camera);
      pixels.push([(p.x*.5+.5)*width,(-p.y*.5+.5)*height]);
    }
    assert(Math.abs(left-Math.min(...pixels.map(p=>p[0])))<1e-6);assert(Math.abs(top-Math.min(...pixels.map(p=>p[1])))<1e-6);
  }
}
assert(maxGrade<.602,'steep terrain receives a supported gradual staircase profile');
const {landmarkZoneRadius}=require('../lib/worldMap/landmarkInteraction.ts');assert.equal(landmarkZoneRadius(2,3)*2,4.5,'the 1.5 multiplier applies to diameter');
for(const tier of ['high','balanced']){
  const scene=JSON.parse(fs.readFileSync(path.join(__dirname,`../public/world-map/scene/${tier}.json`)));
  assert.equal(Object.keys(scene.landmarkZones).length,5);
  for(const kind of w.LANDMARK_SITE_KEYS){
    const zone=scene.landmarkZones[kind],box=new T.Box3();
    for(const part of scene.landmarks[kind]){const bounds=scene.geometries[part.geometry].box;box.union(new T.Box3(new T.Vector3().fromArray(bounds),new T.Vector3().fromArray(bounds,3)));}
    const size=box.getSize(new T.Vector3());assert(Math.abs(zone.radius*2-Math.max(size.x,size.z)*f.LANDMARK_SCALE*1.5)<1e-8,'circle matches the actual longest ground dimension');
    assert.equal(zone.perimeter.length,64);
    for(const p of zone.perimeter)assert(Math.abs(Math.hypot(p[0]-zone.x,p[2]-zone.z)-zone.radius)<1e-8,'the complete hover outline follows the visible circle');
  }
}
console.log(`PASS: five connected entrances, five supported crossings, 15 baked paths in both tiers, ${worstPenetration.toFixed(3)}m deck interference, max terrain grade ${maxGrade.toFixed(2)}, projected building input and five sized hover circles.`);

