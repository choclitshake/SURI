// Run with: node scripts/test-walking-paths.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Load pure TS geometry without a new dependency. */
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),THREE=require('three');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true},
}).outputText,file);
const world=require('../lib/worldMap/landscape.ts');
const {makeArchipelagoTerrain,makeCitadelWater}=require('../lib/worldMap/terrainGeometry.ts');
const {createTerrainSampler,walkingRibbon}=require('../lib/worldMap/walkingPaths.ts');
const {playableProjectionBounds}=require('../lib/worldMap/worldBounds.ts');
const {worldFrame,CAMERA_POSITION,CAMERA_TARGET}=require('../lib/worldMap/framing.ts');
const {responsiveCamera}=require('../lib/worldMap/responsiveCamera.ts');
const {ISLAND_ROUTES}=require('../lib/worldMap/navigation.ts');

assert.deepEqual(ISLAND_ROUTES,{'/progress':'champions','/topics':'topics','/calculator':'calculator','/playground':'records','/history-logs':'keep'});
assert.equal(Object.keys(world.PRIMARY_ISLANDS).length,5);
assert.equal(new Set(Object.values(world.PRIMARY_ISLANDS).map(i=>i.biome)).size,5);
assert.equal(Object.keys(world.SECONDARY_ISLANDS).length,46);
assert.deepEqual(CAMERA_POSITION,[45,121,190]);assert.deepEqual(CAMERA_TARGET,[0,1,-8]);
const bounds=playableProjectionBounds();
assert.deepEqual(bounds.min.toArray(),[-61.27058338861446,-34.47901018620054]);
assert.deepEqual(bounds.max.toArray(),[69.59187298283034,28.24409964504922]);
const anchors={keep:[0,6.21,-3],topics:[-11,4.86,-35],champions:[-43,4.26,-5],calculator:[16,4.56,34],records:[47,3.36,1]};
for(const [key,anchor]of Object.entries(anchors)){
  world.sitePosition(key).forEach((value,i)=>assert(Math.abs(value-anchor[i])<1e-10,`${key}: original camera anchor`));
  const island=world.PRIMARY_ISLANDS[world.SITE_ISLAND[key]],height=world.FOUNDATION_HEIGHTS[key];
  for(let a=0;a<32;a++){
    const x=anchor[0]+Math.cos(a*Math.PI/16)*5.1,z=anchor[2]+Math.sin(a*Math.PI/16)*5.1;
    assert(world.islandScore(x,z,island)>1,`${key}: dry foundation footprint`);
    assert(Math.abs(world.terrainHeight(x,z)-height)<1e-8,`${key}: level foundation`);
  }
}

const areas=[];
for(const [key,island]of Object.entries(world.PRIMARY_ISLANDS)){
  let area=0,minHeight=Infinity,maxHeight=-Infinity;
  for(let x=island.x-island.rx*1.25;x<island.x+island.rx*1.25;x+=0.5)for(let z=island.z-island.rz*1.25;z<island.z+island.rz*1.25;z+=0.5){
    if(world.islandScore(x,z,island)<=0)continue;
    area+=0.25;
    const height=world.islandHeight(x,z,island);minHeight=Math.min(minHeight,height);maxHeight=Math.max(maxHeight,height);
    for(const other of Object.values(world.PRIMARY_ISLANDS))if(other!==island)assert(world.islandScore(x,z,other)<-1,`${key}: ocean separates primary landmasses`);
  }
  assert(maxHeight-minHeight>5,`${key}: meaningful vertical geography`);areas.push(area);
}
assert(Math.max(...areas)/Math.min(...areas)<1.2,'balanced land areas, no dominant hub');

for(const low of [false,true]){
  const geometry=makeArchipelagoTerrain(low),p=geometry.attributes.position,index=geometry.index;
  const sample=createTerrainSampler(geometry);
  assert(p.count<39000,'bounded terrain vertex budget including thirteen northern islands');
  assert(p.count>(low?15000:28000),'sufficient coast-aligned detail');
  let submerged=0;
  for(let i=0;i<p.count;i++){
    assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)),'finite terrain');
    if(p.getY(i)<-1)submerged++;
  }
  assert(submerged>1000,'bedrock continues below the ocean');
  for(let j=0;j<index.count;j+=3){
    const a=new THREE.Vector3().fromBufferAttribute(p,index.getX(j)),b=new THREE.Vector3().fromBufferAttribute(p,index.getX(j+1)),c=new THREE.Vector3().fromBufferAttribute(p,index.getX(j+2));
    const centroid=a.clone().add(b).add(c).multiplyScalar(1/3);
    const normal=b.clone().sub(a).cross(c.clone().sub(a));
    assert(normal.y>0,'upward winding, no folded coastal triangles');
    if(j%93===0)assert(sample(centroid.x,centroid.z)>=centroid.y-2e-4,'sampler follows uppermost triangle where submerged skirts overlap');
  }
  world.ROADS.forEach((road,i)=>{
    assert(road.length>16,'each landmark has a local approach');
    const key=world.LANDMARK_SITE_KEYS[i],island=world.PRIMARY_ISLANDS[world.SITE_ISLAND[key]];
    const ribbon=walkingRibbon(road,()=>0.42,(x,z)=>sample(x,z)+0.06),vertices=ribbon.attributes.position;
    for(let v=0;v<vertices.count;v++){
      const x=vertices.getX(v),y=vertices.getY(v),z=vertices.getZ(v);
      assert(world.islandScore(x,z,island)>0.6,`${key}: trail stays on its own dry island`);
      assert(Math.abs(y-sample(x,z)-0.06)<2e-5,'trail follows actual terrain without buried paving');
    }
    ribbon.dispose();
  });
  const water=makeCitadelWater(low,sample),wp=water.attributes.position;
  assert(wp.getY(0)-wp.getY(wp.count-1)>4,'waterfall descends to the coast');
  for(let v=0;v<wp.count;v++)assert(wp.getY(v)>sample(wp.getX(v),wp.getZ(v)),'stream stays above bedrock');
  console.log(`PASS: ${low?'low-power':'desktop'} terrain, ${p.count} vertices / ${index.count/3} triangles; five dry foundations, local trails, waterfall and submerged rock.`);
  water.dispose();geometry.dispose();
}

// The old envelope drives the unchanged camera; fit the new terrain inside it.
for(const [width,height]of [[1440,1000],[1366,768],[1920,1080],[1024,600]]){
  const frame=worldFrame(width,height,bounds),pose=responsiveCamera(width,height,bounds,false,88);
  const camera=new THREE.OrthographicCamera(-40*width/height,40*width/height,40,-40,0.5,650);
  camera.position.copy(pose.position);camera.quaternion.copy(pose.quaternion);camera.zoom=pose.zoom;
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
  for(const key of Object.keys(world.PRIMARY_ISLANDS)){
    const geometry=makeArchipelagoTerrain(false,key),p=geometry.attributes.position;
    for(let v=0;v<p.count;v++){
      if(p.getY(v)<0)continue;
      const projected=new THREE.Vector3().fromBufferAttribute(p,v).applyAxisAngle(new THREE.Vector3(0,1,0),frame.rotation).multiplyScalar(frame.scale).add(new THREE.Vector3(...frame.position)).project(camera);
      assert(Math.abs(projected.x)<0.99&&Math.abs(projected.y)<0.99,`${width}x${height}: ${key} fits original camera`);
    }
    geometry.dispose();
  }
}
console.log('PASS: five unchanged routes and camera anchors; balanced separate islands; original desktop framing.');
