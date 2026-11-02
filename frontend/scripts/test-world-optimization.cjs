/* eslint-disable @typescript-eslint/no-require-imports -- This test uses the existing CommonJS TypeScript harness. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript'),T=require('three');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const zlib=require('node:zlib');
const root=path.join(__dirname,'..'),world=require('../lib/worldMap/landscape.ts'),{makeArchipelagoTerrain}=require('../lib/worldMap/terrainGeometry.ts'),{geometryForShape}=require('../lib/worldMap/primitiveGeometry.ts'),quality=require('../lib/worldMap/renderQuality.ts');
const original=JSON.parse(fs.readFileSync(path.join(root,'public/world-map/architecture/instances.json')));
const manifests={};
for(const tier of ['high','balanced']){
  const m=JSON.parse(fs.readFileSync(path.join(root,`public/world-map/scene/${tier}.json`))),buffer=fs.readFileSync(path.join(root,'public/world-map/scene',m.buffer));manifests[tier]=m;
  assert.deepEqual(zlib.gunzipSync(fs.readFileSync(path.join(root,'public/world-map/scene',m.compressedBuffer))),buffer,'compressed and legacy raw scene packets match');
  const hash=crypto.createHash('sha256');for(const file of m.sourceFiles)hash.update(fs.readFileSync(path.join(root,'lib/worldMap',file),'utf8').replace(/\r\n/g,'\n'));assert.equal(hash.digest('hex'),m.sourceHash,'scene packet matches sources');
  const types={f32:Float32Array,i16:Int16Array,u8:Uint8Array,u16:Uint16Array,u32:Uint32Array};
  const read=a=>{assert.equal(a.offset%4,0);const values=new types[a.type](buffer.buffer,buffer.byteOffset+a.offset,a.count);assert(values.every(Number.isFinite));return values;};
  for(const g of Object.values(m.geometries)){
    assert(g.attributes.position);for(const a of Object.values(g.attributes))read(a);
    if(g.index){const indices=read(g.index);assert(Math.max(...indices)<g.attributes.position.count/3);}
    assert.equal(g.attributes.normal.type,'i16');assert.equal(g.attributes.normal.itemSize,4,'GPU-native aligned normal format');assert(g.sphere[3]>=0&&g.sphere.every(Number.isFinite));
  }
  assert.equal(Object.keys(m.terrain).length,6);assert.equal(Object.keys(m.roads).length,6);
  let chunkEnd=0;const secondary=m.geometries[m.terrain.secondary];
  assert.equal(m.terrainChunks.length,4,'secondary islands have four spatial views');
  for(const chunk of m.terrainChunks){assert.equal(chunk.start,chunkEnd);assert(chunk.count>0&&chunk.count%3===0);chunkEnd+=chunk.count;}
  assert.equal(chunkEnd,secondary.index.count,'spatial views retain every secondary-island triangle exactly once');
  assert(m.occlusionBoxes.length>0,'terrain supplies conservative solid occluders');
  const {createTerrainSampler}=require('../lib/worldMap/walkingPaths.ts'),ground=makeArchipelagoTerrain(tier==='balanced'),sample=createTerrainSampler(ground);
  for(const box of m.occlusionBoxes)for(const u of [0,.5,1])for(const v of [0,.5,1])assert(sample(box[0]+u*(box[3]-box[0]),box[2]+v*(box[5]-box[2]))>=box[4]+.1,'occluders stay below actual terrain');
  ground.dispose();
  for(const key of Object.keys(world.PRIMARY_ISLANDS)){
    const expected=makeArchipelagoTerrain(tier==='balanced',key),g=m.geometries[m.terrain[key]],actual=read(g.attributes.position);
    assert.deepEqual(Array.from(actual),Array.from(expected.attributes.position.array),`${tier}: exact coast/elevations for ${key}`);expected.dispose();
  }
  assert.equal(Object.keys(m.landmarks).length,5);
  for(const kind of world.LANDMARK_SITE_KEYS){
    const before=original.models[kind].reduce((sum,b)=>{const g=geometryForShape(b.shape);return sum+b.pieces.length*(g.index?.count??g.attributes.position.count)/3;},0);
    const after=m.landmarks[kind].reduce((sum,p)=>sum+m.geometries[p.geometry].index.count/3,0);
    assert.equal(after,before,`${kind}: merging retains every architectural triangle`);
  }
  for(const shape of ['broadleaf','conifer','rock']){
    const full=m.geometries[m.units[shape].full],low=m.geometries[m.units[shape].low];
    assert(low.attributes.position.count<full.attributes.position.count,`${shape}: real geometry LOD`);
  }
  assert(buffer.length<10*1048576);console.log(`PASS: ${tier} binary bounds, compact normals/masks, exact terrain and full-detail landmarks; ${(buffer.length/1048576).toFixed(2)} MiB.`);
}
const count=m=>Object.values(m.forest).flat().reduce((sum,b)=>sum+b.pieces.length,0);
assert.equal(count(manifests.high),count(manifests.balanced),'quality retains all vegetation placement');
assert.equal(quality.initialQuality({width:1440,cores:8,memory:8}),'high');assert.equal(quality.initialQuality({width:768,cores:8,memory:8}),'balanced');assert.equal(quality.initialQuality({width:1440,cores:2,memory:2}),'economy');
assert(quality.frameBudgetAdjustment(60,30,1.1,.9,1.5)<1.1);assert.equal(quality.frameBudgetAdjustment(60,30,.9,.9,1.5),.9);assert.equal(quality.frameBudgetAdjustment(30,30,1.5,.9,1.5),1.5);
const {TerrainOcclusion,OCCLUSION_DIRECTION}=require('../lib/worldMap/visibility.ts'),occlusion=new TerrainOcclusion([[-10,-10,-10,10,10,10]]);
const hiddenCenter=OCCLUSION_DIRECTION.clone().multiplyScalar(40),hiddenBox=new T.Box3().setFromCenterAndSize(hiddenCenter,new T.Vector3(1,1,1));
assert(occlusion.hides(hiddenBox),'fully hidden bounding box is culled');
assert(!occlusion.hides(hiddenBox.clone().expandByScalar(30)),'partially visible bounds must be retained');
assert(!occlusion.hides(new T.Box3().setFromCenterAndSize(hiddenCenter.clone().negate(),new T.Vector3(1,1,1))),'foreground objects must be retained');
(async()=>{
  const {retainWorldResource,acquireWorldResources}=require('../components/WorldMap/SharedWorldResources.ts');let disposed=0;retainWorldResource({dispose(){disposed++;}});
  const a=acquireWorldResources(),b=acquireWorldResources();a();await new Promise(r=>setTimeout(r,4));assert.equal(disposed,0);b();const c=acquireWorldResources();await new Promise(r=>setTimeout(r,4));assert.equal(disposed,0);c();await new Promise(r=>setTimeout(r,4));assert.equal(disposed,1);
  console.log('PASS: quality bounds, retained scenery, shared-resource lifetime and Strict Mode release/reacquire.');
})().catch(error=>{console.error(error);process.exitCode=1;});
