// Compile authored modules into static instancing data; no building grammar runs
// in the browser. Run before bake-environment.cjs when architecture changes.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const {ArchitectureBuilder}=require('../lib/worldMap/architecture.ts');
const {LANDMARK_SITE_KEYS}=require('../lib/worldMap/landscape.ts');
const {makeSupportingArchitecture,COASTAL_OUTPOSTS}=require('../lib/worldMap/supportingArchitecture.ts');
const {makeEnvironmentDecor,makeHarborBoat}=require('../lib/worldMap/environmentDecor.ts');
const {makeTraversalArchitecture}=require('../lib/worldMap/traversalArchitecture.ts');
const files=['architecture.ts','outerLandmarks.ts','architecturalModules.ts','landmarkDesigns.ts','supportingArchitecture.ts','northernIslands.ts','northernArchitecture.ts','traversalArchitecture.ts','traversal.ts','generated/traversal.json','worldPalette.ts','environmentDecor.ts'];
const hash=crypto.createHash('sha256');for(const file of files)hash.update(fs.readFileSync(path.join(__dirname,'../lib/worldMap',file),'utf8').replace(/\r\n/g,'\n'));
const round=n=>Math.round(n*100000)/100000;
const serialize=builder=>Array.from(builder.batches.values()).map(batch=>({shape:batch.shape,surface:batch.surface,
  pieces:batch.pieces.map(p=>[...p.matrix.toArray().map(round),...p.color.toArray().map(round)])}));
const models={};let pieces=0;
for(const kind of LANDMARK_SITE_KEYS){const b=new ArchitectureBuilder();b.landmark(kind);models[kind]=serialize(b);}
models.coastal=serialize(makeSupportingArchitecture());
models.transport=serialize(makeTraversalArchitecture());
models.decor=serialize(makeEnvironmentDecor());models.boat=serialize(makeHarborBoat());
for(const batches of Object.values(models))for(const batch of batches)pieces+=batch.pieces.length;
const output=path.join(__dirname,'../public/world-map/architecture');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'instances.json'),JSON.stringify({version:1,sourceHash:hash.digest('hex'),sourceFiles:files,outposts:COASTAL_OUTPOSTS.length,models})+'\n');
console.log(`Compiled ${LANDMARK_SITE_KEYS.length} primary landmarks + ${COASTAL_OUTPOSTS.length} non-interactive outposts: ${pieces} static instances.`);
