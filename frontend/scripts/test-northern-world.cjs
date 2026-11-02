/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),T=require('three');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const w=require('../lib/worldMap/landscape.ts'),{NORTHERN_ISLANDS,WYRM_TOWER}=require('../lib/worldMap/northernIslands.ts');
const {responsiveCamera,applyOverviewPose}=require('../lib/worldMap/responsiveCamera.ts');
const {playableProjectionBounds}=require('../lib/worldMap/worldBounds.ts');
const {worldFrame}=require('../lib/worldMap/framing.ts');
assert.equal(w.LANDMARK_SITE_KEYS.length,5);assert.equal(Object.keys(w.PRIMARY_ISLANDS).length,5);
assert.equal(Object.keys(NORTHERN_ISLANDS).length,13);
for(const i of Object.values(NORTHERN_ISLANDS)){
  assert(i.z<=-24&&i.rx<6,'northern scenic islands remain secondary');
  for(let x=i.x-i.rx*1.2;x<i.x+i.rx*1.2;x+=.4)for(let z=i.z-i.rz*1.2;z<i.z+i.rz*1.2;z+=.4){
    if(w.islandScore(x,z,i)<.1)continue;
    assert(Object.values(w.PRIMARY_ISLANDS).every(primary=>w.islandScore(x,z,primary)<0),'new islands never merge into the five primary landmasses');
  }
}
for(const x of [-1.4,0,1.4])for(const z of [-1.4,0,1.4])assert(w.terrainHeight(WYRM_TOWER.x+x,WYRM_TOWER.z+z)<WYRM_TOWER.floor,'footing anchors below the tower floor');
// Broad, eroded mountain crests must retain a real shoulder, rather than a
// single point at the center. Sample the height field, not shader strings.
const peak=w.PRIMARY_ISLANDS.calculator,heights=[];
for(let x=peak.x-8;x<=peak.x+9;x+=.25)for(let z=peak.z-10;z<=peak.z-4;z+=.25)heights.push({x,z,h:w.islandHeight(x,z,peak)});
const summit=heights.reduce((a,b)=>a.h>b.h?a:b),shoulder=heights.filter(p=>p.h>summit.h-1.5);
assert(shoulder.length*.0625>4,'mountain has a broad crest area');assert(summit.h<16&&summit.h>9,'dramatic, bounded mountain elevation');

const bounds=playableProjectionBounds();
for(const [width,height] of [[1440,900],[1366,768],[1024,768],[768,1024],[390,844]]){
  const header=width<540?70:88,a=responsiveCamera(width,height,bounds,false,header),touch=responsiveCamera(width,height,bounds,true,header);
  assert.equal(a.zoom,touch.zoom,'attaching/detaching a pointer cannot zoom');assert(a.position.equals(touch.position));assert(a.quaternion.equals(touch.quaternion));
  const camera=new T.OrthographicCamera(-40*width/height,40*width/height,40,-40,.5,650),offset=new T.Vector2();
  applyOverviewPose(camera,a,offset);const original=camera.projectionMatrix.toArray(),position=camera.position.toArray();
  for(let update=0;update<1200;update++){
    // Simulate an unwanted control reset plus repeated scene/quality updates.
    camera.zoom=.25;camera.quaternion.identity();applyOverviewPose(camera,a,offset);
    assert.deepEqual(camera.projectionMatrix.toArray(),original);assert.deepEqual(camera.position.toArray(),position);
  }
  if(width>=1024){
    const frame=worldFrame(width,height,bounds),matrix=new T.Matrix4().compose(new T.Vector3(...frame.position),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),frame.rotation),new T.Vector3().setScalar(frame.scale));
    const top=new T.Vector3(WYRM_TOWER.x,WYRM_TOWER.floor+8.7,WYRM_TOWER.z).applyMatrix4(matrix).project(camera);
    const foot=new T.Vector3(WYRM_TOWER.x,1,WYRM_TOWER.z).applyMatrix4(matrix).project(camera);
    console.log(`${width}x${height}: tower top ${((1-top.y)*height/2).toFixed(1)}px; island shore ${((1-foot.y)*height/2).toFixed(1)}px; zoom ${a.zoom.toFixed(3)}`);
    assert(Math.abs(top.x)<.86&&top.y<1&&foot.y>-1,'northern tower fits the existing shot');
  }
}
for(const tier of ['high','balanced']){
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,`../public/world-map/scene/${tier}.json`)));
  assert(!manifest.drake&&!Object.keys(manifest.geometries).some(id=>id.includes('drake')),'dragon geometry is completely removed');
  assert.equal(Object.keys(manifest.landmarks).length,5);
}
console.log('PASS: northern hierarchy, broad ridges, pointer-independent framing and 6000 rejected zoom resets.');
