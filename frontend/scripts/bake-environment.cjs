// Offline only. node scripts/bake-environment.cjs, then python scripts/bake-environment.py
/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript'),THREE=require('three');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const w=require('../lib/worldMap/landscape.ts'),e=require('../lib/worldMap/environment.ts');
const {makeVegetation,makeSettlements}=require('../lib/worldMap/settlements.ts');
const {ArchitectureBuilder}=require('../lib/worldMap/architecture.ts');
const {makeSupportingArchitecture}=require('../lib/worldMap/supportingArchitecture.ts');
const {makeEnvironmentDecor}=require('../lib/worldMap/environmentDecor.ts');
const {makeTraversalArchitecture}=require('../lib/worldMap/traversalArchitecture.ts');
const {LANDMARK_SCALE}=require('../lib/worldMap/framing.ts');
const size=512,b=e.ENVIRONMENT_BOUNDS,data=new Float32Array(size*size*2);
for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const wx=b.minX+x/(size-1)*(b.maxX-b.minX),wz=b.minZ+z/(size-1)*(b.maxZ-b.minZ),i=(z*size+x)*2;
  const sample=w.islandAt(wx,wz);data[i]=w.islandHeight(wx,wz,sample.island,sample.coast);data[i+1]=sample.coast;
}
const shadows=[];
function append(builder,transform=new THREE.Matrix4()){
  for(const batch of builder.batches.values()){
    if(['window','magic','gold','glass','carving'].includes(batch.surface))continue;
    for(const piece of batch.pieces){
      const matrix=transform.clone().multiply(piece.matrix),p=new THREE.Vector3().setFromMatrixPosition(matrix),s=new THREE.Vector3().setFromMatrixScale(matrix);
      if(s.y<0.15)continue;
      shadows.push({x:p.x,z:p.z,top:p.y+s.y*.5,ground:w.terrainHeight(p.x,p.z),rx:Math.max(.12,s.x*.48),rz:Math.max(.12,s.z*.48),leaves:batch.surface==='leaves'});
    }
  }
}
append(makeVegetation());append(makeSettlements());append(makeSupportingArchitecture());append(makeTraversalArchitecture());append(makeEnvironmentDecor());
for(const site of w.LANDMARK_SITE_KEYS){const builder=new ArchitectureBuilder();builder.landmark(site);append(builder,new THREE.Matrix4().makeTranslation(...w.sitePosition(site)).scale(new THREE.Vector3().setScalar(LANDMARK_SCALE)));}
const out=path.join(__dirname,'../.cache/environment-bake');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'height-coast.f32'),Buffer.from(data.buffer));
const sourceFiles=['landscape.ts','settlements.ts','environment.ts','architecture.ts','outerLandmarks.ts','architecturalModules.ts','landmarkDesigns.ts','supportingArchitecture.ts','northernIslands.ts','northernArchitecture.ts','traversalArchitecture.ts','traversal.ts','generated/traversal.json','worldPalette.ts','environmentDecor.ts'];
const sourceHash=crypto.createHash('sha256');for(const file of sourceFiles)sourceHash.update(fs.readFileSync(path.join(__dirname,'../lib/worldMap',file),'utf8').replace(/\r\n/g,'\n'));
const probes=[[0,-3],[-43,-5],[-11,-35],[47,1],[16,34],[22,0],[0,18],[-25,-2],[5,-18]].map(([x,z])=>({x,z,coast:w.shoreDistance(x,z)}));
fs.writeFileSync(path.join(out,'scene.json'),JSON.stringify({size,bounds:b,sun:e.LOCAL_SUN,version:e.ENVIRONMENT_ASSET_VERSION,sourceHash:sourceHash.digest('hex'),shadows,probes}));
console.log(`Baked ${size}x${size} height/coast samples and ${shadows.length} static shadow proxies.`);
