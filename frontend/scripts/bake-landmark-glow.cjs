/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),T=require('three');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const {geometryForShape}=require('../lib/worldMap/primitiveGeometry.ts');
const compiled=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/world-map/architecture/instances.json')));
const models={};
for(const [kind,batches]of Object.entries(compiled.models)){
  if(!['keep','topics','records','champions','calculator'].includes(kind))continue;
  const channels={shell:{position:[],normal:[],index:[]},windows:{position:[],normal:[],index:[]}};
  for(const batch of batches){
    if(['cloth','leaves','magic','carving'].includes(batch.surface))continue;
    const channel=['window','glass'].includes(batch.surface)?channels.windows:channels.shell;
    for(const piece of batch.pieces){
      const matrix=new T.Matrix4().fromArray(piece),p=new T.Vector3().setFromMatrixPosition(matrix);
      if(p.y<.8)continue;
      const g=geometryForShape(batch.shape).clone().applyMatrix4(matrix),offset=channel.position.length/3;
      channel.position.push(...g.attributes.position.array);channel.normal.push(...g.attributes.normal.array);
      if(g.index)for(const i of g.index.array)channel.index.push(offset+i);
      else for(let i=0;i<g.attributes.position.count;i++)channel.index.push(offset+i);
      g.dispose();
    }
  }
  for(const c of Object.values(channels))for(const name of ['position','normal'])c[name]=c[name].map(v=>Math.round(v*10000)/10000);
  models[kind]=channels;
}
fs.writeFileSync(path.join(__dirname,'../public/world-map/architecture/glow.json'),JSON.stringify({sourceHash:compiled.sourceHash,models})+'\n');
console.log('Compiled five architectural silhouette and window overlays.');
