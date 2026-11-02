// Offline checks against the exact data loaded by the scene.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript'),THREE=require('three');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const world=require('../lib/worldMap/landscape.ts');
const {LANDMARK_BOUNDS,LANDMARK_SCALE}=require('../lib/worldMap/framing.ts');
const {ARCHITECTURAL_SHAPES,makeArchitecturalGeometry}=require('../lib/worldMap/architecturalGeometry.ts');
const {COASTAL_OUTPOSTS,outpostPosition}=require('../lib/worldMap/supportingArchitecture.ts');
const {principalFacing}=require('../lib/worldMap/landmarkDesigns.ts');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/world-map/architecture/instances.json'),'utf8'));
const hash=crypto.createHash('sha256');for(const file of manifest.sourceFiles)hash.update(fs.readFileSync(path.join(__dirname,'../lib/worldMap',file),'utf8').replace(/\r\n/g,'\n'));
assert.equal(hash.digest('hex'),manifest.sourceHash,'compiled architecture matches the authored sources');
assert.equal(manifest.outposts,9);assert.equal(Object.keys(manifest.models).length,9);
let total=0;
const boxes=new Map();
function shapeBox(shape){
  if(boxes.has(shape))return boxes.get(shape);
  let box;
  if(ARCHITECTURAL_SHAPES.includes(shape)){const g=makeArchitecturalGeometry(shape);g.computeBoundingBox();box=g.boundingBox.clone();g.dispose();}
  else if(shape==='arch')box=new THREE.Box3(new THREE.Vector3(-.5,0,0),new THREE.Vector3(.5,1.05,0));
  else if(shape==='ring')box=new THREE.Box3(new THREE.Vector3(-1.05,-.05,-1.05),new THREE.Vector3(1.05,.05,1.05));
  else box=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5));
  boxes.set(shape,box);return box;
}
for(const [kind,batches]of Object.entries(manifest.models)){
  const bounds=new THREE.Box3();let count=0;
  for(const batch of batches)for(const values of batch.pieces){
    assert.equal(values.length,19);assert(values.every(Number.isFinite));
    const matrix=new THREE.Matrix4().fromArray(values);
    assert(matrix.determinant()>0,'no singular or mirrored modules');
    bounds.union(shapeBox(batch.shape).clone().applyMatrix4(matrix));count++;
  }
  total+=count;
  if(['coastal','transport','decor','boat'].includes(kind))continue;
  assert(count>20&&count<400,`${kind}: bounded instance budget`);
  assert(bounds.max.y<LANDMARK_BOUNDS[kind][1],`${kind}: architecture fits unchanged label/selection height (${bounds.max.y})`);
  const site=world.sitePosition(kind),angle=principalFacing(kind),c=Math.cos(angle),s=Math.sin(angle);
  const slab=batches.find(b=>b.shape==='box'&&b.surface==='stone').pieces[0],matrix=new THREE.Matrix4().fromArray(slab);
  for(const u of [-.5,.5])for(const v of [-.5,.5]){
    const p=new THREE.Vector3(u,-.5,v).applyMatrix4(matrix).multiplyScalar(LANDMARK_SCALE).add(new THREE.Vector3(...site));
    assert(p.y<=world.terrainHeight(p.x,p.z)+.025,`${kind}: foundation touches terrain at ${p.x},${p.z}`);
    assert(world.shoreDistance(p.x,p.z)>1,`${kind}: footprint remains on dry stable land`);
  }
  // The front approach and portal face the original local trail axis.
  const approach=world.ROADS[world.LANDMARK_SITE_KEYS.indexOf(kind)][0];
  const localX=(approach.x-site[0])*c-(approach.z-site[2])*s;
  assert(Math.abs(localX)<.001,`${kind}: entrance aligns with original path`);
  console.log(`PASS: ${kind}, ${count} pieces, height ${bounds.max.y.toFixed(2)} / original ${LANDMARK_BOUNDS[kind][1]}.`);
}
assert(total<5000,'combined architectural instance budget including bridges');
for(const o of COASTAL_OUTPOSTS){
  assert(!Object.keys(world.PRIMARY_ISLANDS).includes(o.island),'supporting buildings stay on secondary islands');
  const [x,z]=outpostPosition(o),c=Math.cos(o.turn),s=Math.sin(o.turn);
  for(const u of [-2.175,2.175])for(const v of [-1.85,1.85]){
    assert(world.shoreDistance(x+(u*c+v*s)*o.scale,z+(-u*s+v*c)*o.scale)>.1,`${o.id}: dry islet footprint`);
  }
  assert(o.scale<.5,'outposts remain subordinate to the principal landmarks');
}
const ogive=makeArchitecturalGeometry('ogive');
const p=ogive.attributes.position,index=ogive.index;
function contains(x,y,a,b,c){
  const d=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(d)<1e-9)return false;
  const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/d,v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/d;
  return u>1e-6&&v>1e-6&&u+v<1-1e-6;
}
for(let j=0;j<(index?index.count:p.count);j+=3){
  const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(j+k):j+k));
  if(Math.max(...v.map(x=>x.z))-Math.min(...v.map(x=>x.z))<1e-5)assert(!contains(0,.42,...v),'Gothic arch center is an actual opening');
}
ogive.dispose();
console.log(`PASS: ${total} compiled instances; nine dry subordinate outposts; open arches and unchanged approaches.`);
