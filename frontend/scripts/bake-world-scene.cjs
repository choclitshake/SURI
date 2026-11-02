// Exact terrain, water, scenery, unit assets and merged landmarks, compiled once.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),ts=require('typescript'),T=require('three');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const w=require('../lib/worldMap/landscape.ts'),{makeArchipelagoTerrain,makeCitadelWater}=require('../lib/worldMap/terrainGeometry.ts');
const {makeStaticLighting}=require('../lib/worldMap/staticLighting.ts');
const {HARBOR_BOATS}=require('../lib/worldMap/environmentDecor.ts');
const {LANDMARK_SCALE}=require('../lib/worldMap/framing.ts');
const {landmarkZoneRadius}=require('../lib/worldMap/landmarkInteraction.ts');
const {WATER_LEVEL}=require('../lib/worldMap/environment.ts');
const {createTerrainSampler}=require('../lib/worldMap/walkingPaths.ts'),{makeSettlements,makeVegetation}=require('../lib/worldMap/settlements.ts'),{geometryForShape}=require('../lib/worldMap/primitiveGeometry.ts');
const root=path.join(__dirname,'../lib/worldMap'),out=path.join(__dirname,'../public/world-map/scene');fs.mkdirSync(out,{recursive:true});
const sourceFiles=['landscape.ts','terrainGeometry.ts','settlements.ts','architecture.ts','architecturalGeometry.ts','primitiveGeometry.ts','foliageGeometry.ts','traversal.ts','generated/traversal.json','landmarkDesigns.ts','landmarkInteraction.ts','architecturalModules.ts','supportingArchitecture.ts','northernIslands.ts','northernArchitecture.ts','environmentDecor.ts','worldPalette.ts','environment.ts','staticLighting.ts'];
const hash=crypto.createHash('sha256');for(const file of sourceFiles)hash.update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'));
const {mergeGeometries}=require('three/examples/jsm/utils/BufferGeometryUtils.js');
const sourceHash=hash.digest('hex'),architecture=JSON.parse(fs.readFileSync(path.join(out,'../architecture/instances.json'))),paths=JSON.parse(fs.readFileSync(path.join(out,'../traversal/paths.json'))),glow=JSON.parse(fs.readFileSync(path.join(out,'../architecture/glow.json')));
const lightingScene=JSON.parse(fs.readFileSync(path.join(__dirname,'../.cache/environment-bake/scene.json')));
const light=makeStaticLighting(lightingScene.size,new Float32Array(Uint8Array.from(fs.readFileSync(path.join(__dirname,'../.cache/environment-bake/height-coast.f32'))).buffer),lightingScene.shadows);
function packer(){
  const chunks=[],geometries={};let offset=0;
  const append=array=>{while(offset%4){chunks.push(Buffer.alloc(1));offset++;}const start=offset,buffer=Buffer.from(array.buffer,array.byteOffset,array.byteLength);chunks.push(buffer);offset+=buffer.length;return start;};
  const pack=(name,g)=>{
    const attributes={};
    for(const [key,attr]of Object.entries(g.attributes)){
      if(!['position','normal','uv','color','environmentWeights','surfaceUv','bakedLight','windWeight','motionPhase'].includes(key))continue;
      let values,type='f32',normalized=false,itemSize=attr.itemSize;
      if(key==='normal'){values=new Int16Array(attr.count*4);for(let j=0;j<attr.count;j++)for(let c=0;c<3;c++)values[j*4+c]=Math.round(Math.max(-1,Math.min(1,attr.array[j*3+c]))*32767);type='i16';normalized=true;itemSize=4;}
      else if(key==='color'||key==='environmentWeights'||key==='bakedLight'){values=new Uint8Array(attr.count*4);for(let j=0;j<attr.count;j++)for(let c=0;c<4;c++)values[j*4+c]=c<attr.itemSize?Math.round(Math.max(0,Math.min(1,attr.array[j*attr.itemSize+c]))*255):255;type='u8';normalized=true;itemSize=4;}
      else if(key==='windWeight'){values=Uint8Array.from(attr.array,v=>Math.round(v*255));type='u8';normalized=true;}
      else values=Float32Array.from(attr.array);
      attributes[key]={type,normalized,itemSize,count:values.length,offset:append(values)};
    }
    let index;if(g.index){const values=g.attributes.position.count<65536?Uint16Array.from(g.index.array):Uint32Array.from(g.index.array);index={type:values instanceof Uint16Array?'u16':'u32',itemSize:1,normalized:false,count:values.length,offset:append(values)};}
    g.computeBoundingSphere();g.computeBoundingBox();
    geometries[name]={attributes,index,sphere:[...g.boundingSphere.center.toArray(),g.boundingSphere.radius],box:[...g.boundingBox.min.toArray(),...g.boundingBox.max.toArray()]};return name;
  };
  return {pack,write(name,metadata){const raw=Buffer.concat(chunks),compressed=zlib.gzipSync(raw,{level:9});fs.writeFileSync(path.join(out,name+'.bin'),raw);fs.writeFileSync(path.join(out,name+'.bin.gz'),compressed);fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify({version:1,sourceHash,sourceFiles,buffer:name+'.bin',compressedBuffer:name+'.bin.gz',geometries,...metadata})+'\n');console.log(`${name}: ${Object.keys(geometries).length} geometries, ${(offset/1048576).toFixed(2)} MiB binary, ${(compressed.length/1048576).toFixed(2)} MiB transfer`);}};
}
function merge(pieces){
  const p=[],n=[],uv=[],color=[],windValues=[],phases=[],idx=[];let hasWind=false,hasPhase=false;
  for(const {geometry,matrix,tint,wind,phase}of pieces){
    const g=geometry.clone().applyMatrix4(matrix),offset=p.length/3,a=g.attributes;
    p.push(...a.position.array);n.push(...a.normal.array);hasWind=hasWind||!!wind;hasPhase=hasPhase||phase!==undefined;
    for(let j=0;j<a.position.count;j++){phases.push(phase??0);windValues.push(wind?Math.max(0,Math.min(1,.5-geometry.attributes.position.getY(j))):0);uv.push(a.uv?.getX(j)??0,a.uv?.getY(j)??0);color.push(tint.r*(a.color?.getX(j)??1),tint.g*(a.color?.getY(j)??1),tint.b*(a.color?.getZ(j)??1));}
    if(g.index)for(const i of g.index.array)idx.push(offset+i);else for(let i=0;i<a.position.count;i++)idx.push(offset+i);g.dispose();
  }
  const g=new T.BufferGeometry();for(const [key,array,size]of [['position',p,3],['normal',n,3],['uv',uv,2],['color',color,3]])g.setAttribute(key,new T.Float32BufferAttribute(array,size));g.setIndex(idx);if(hasWind)g.setAttribute("windWeight",new T.Float32BufferAttribute(windValues,1));if(hasPhase)g.setAttribute("motionPhase",new T.Float32BufferAttribute(phases,1));return g;
}
const serialize=b=>Array.from(b.batches.values()).map(batch=>({shape:batch.shape,surface:batch.surface,pieces:batch.pieces.map(p=>[...p.matrix.toArray(),...p.color.toArray()])}));
function terrainOccluders(terrain){
  const cells=new Map(),step=3,p=terrain.attributes.position,indices=terrain.index.array;
  // The minimum of every overlapping triangle is a lower bound on the whole
  // cell, not a center-point height estimate. Only dry interior cells qualify.
  for(let j=0;j<indices.length;j+=3){
    const ids=[indices[j],indices[j+1],indices[j+2]],xs=ids.map(i=>p.getX(i)),zs=ids.map(i=>p.getZ(i)),height=Math.min(...ids.map(i=>p.getY(i)));
    for(let x=Math.floor(Math.min(...xs)/step);x<=Math.floor(Math.max(...xs)/step);x++)for(let z=Math.floor(Math.min(...zs)/step);z<=Math.floor(Math.max(...zs)/step);z++){
      const key=x+':'+z;cells.set(key,Math.min(cells.get(key)??Infinity,height));
    }
  }
  const boxes=[];
  for(const [key,height]of cells){
    if(height<1)continue;const [ix,iz]=key.split(':').map(Number),x=ix*step,z=iz*step;
    if([0,.5,1].some(u=>[0,.5,1].some(v=>w.shoreDistance(x+u*step,z+v*step)<1)))continue;
    boxes.push([x,-3,z,x+step,height-.16,z+step]);
  }
  return boxes;
}
for(const low of [false,true]){
  const pack=packer(),terrain=makeArchipelagoTerrain(low),surface=createTerrainSampler(terrain),terrainNames={};
  const secondary=[];
  for(const key of Object.keys(w.ISLANDS)){
    const g=makeArchipelagoTerrain(low,key);g.deleteAttribute('color');
    if(w.PRIMARY_ISLANDS[key]){light.geometry(g);terrainNames[key]=pack.pack('terrain/'+key,g);g.dispose();}else{const i=w.ISLANDS[key];g.userData.region=(i.x>=0?1:0)+(i.z>=0?2:0);secondary.push(g);}
  }
  secondary.sort((a,b)=>a.userData.region-b.userData.region);
  const terrainChunks=[];let chunkOffset=0;
  for(let region=0;region<4;region++){
    const pieces=secondary.filter(g=>g.userData.region===region);if(!pieces.length)continue;
    const box=new T.Box3();let count=0;for(const g of pieces){g.computeBoundingBox();box.union(g.boundingBox);count+=g.index.count;}
    const sphere=box.getBoundingSphere(new T.Sphere());terrainChunks.push({start:chunkOffset,count,box:[...box.min.toArray(),...box.max.toArray()],sphere:[...sphere.center.toArray(),sphere.radius]});chunkOffset+=count;
  }
  const islets=mergeGeometries(secondary);light.geometry(islets);terrainNames.secondary=pack.pack('terrain/secondary',islets);islets.dispose();secondary.forEach(g=>g.dispose());
  const waterfall=pack.pack('waterfall',makeCitadelWater(low,surface)),roads={};
  for(const key of Object.keys(w.PRIMARY_ISLANDS).concat('lanternCove')){
    const entries=paths[low?'low':'full'].filter(p=>p.island===key);
    const pieces=entries.map(p=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p.position,3));g.setAttribute('normal',new T.Float32BufferAttribute(p.normal,3));g.setIndex(p.index);return {geometry:g,matrix:new T.Matrix4(),tint:new T.Color('white')};});
    if(pieces.length){const g=merge(pieces);g.deleteAttribute('color');g.deleteAttribute('uv');light.geometry(g);roads[key]=pack.pack('road/'+key,g);g.dispose();}pieces.forEach(p=>p.geometry.dispose());
  }
  const scenery=serialize(makeSettlements(surface)),forest=serialize(makeVegetation(low,surface));
  const forestGroups={};
  for(const batch of forest)for(const p of batch.pieces){
    const key=Object.keys(w.PRIMARY_ISLANDS).reduce((best,key)=>Math.hypot(p[12]-w.ISLANDS[key].x,p[14]-w.ISLANDS[key].z)<Math.hypot(p[12]-w.ISLANDS[best].x,p[14]-w.ISLANDS[best].z)?key:best,'hub');
    const group=forestGroups[key]??(forestGroups[key]=[]);let target=group.find(b=>b.shape===batch.shape&&b.surface===batch.surface);if(!target){target={shape:batch.shape,surface:batch.surface,pieces:[]};group.push(target);}target.pieces.push(p);
  }
  const units={};for(const batches of [scenery,...Object.values(forestGroups),architecture.models.coastal,architecture.models.transport,architecture.models.decor,architecture.models.boat])for(const batch of batches){
    if(units[batch.shape])continue;
    const unit=(lowDetail)=>{const g=geometryForShape(batch.shape,lowDetail).clone();if(!['inscription','scholarRelief','astralRelief','heraldry'].includes(batch.shape))g.deleteAttribute('uv');const id=pack.pack((lowDetail?'unit-low/':'unit/')+batch.shape,g);g.dispose();return id;};
    const full=unit(false);units[batch.shape]={full,low:['rock','broadleaf','conifer'].includes(batch.shape)?unit(true):full};
  }
  const land={},landmarkZones={};for(const [kind,batches]of Object.entries(architecture.models)){
    if(!w.LANDMARK_SITE_KEYS.includes(kind))continue;
    const groups=new Map();for(const batch of batches){const mineral=batch.shape==='rock'||batch.shape==='obelisk',key=batch.surface+':'+mineral;let group=groups.get(key);if(!group){group={surface:batch.surface,mineral,pieces:[]};groups.set(key,group);}for(const values of batch.pieces)group.pieces.push({geometry:geometryForShape(batch.shape),matrix:new T.Matrix4().fromArray(values),tint:new T.Color().fromArray(values,16),wind:batch.surface==='cloth'});}
    const bounds=new T.Box3();
    land[kind]=Array.from(groups.entries()).map(([key,group])=>{const g=merge(group.pieces);if(group.surface!=='carving')g.deleteAttribute('uv');light.geometry(g,new T.Matrix4().makeTranslation(...w.sitePosition(kind)).scale(new T.Vector3().setScalar(LANDMARK_SCALE)));const id=pack.pack('landmark/'+kind+'/'+key,g);bounds.union(g.boundingBox);g.dispose();return {surface:group.surface,mineral:group.mineral,geometry:id};});
    const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),site=w.sitePosition(kind),radius=landmarkZoneRadius(size.x*LANDMARK_SCALE,size.z*LANDMARK_SCALE),x=site[0]+center.x*LANDMARK_SCALE,z=site[2]+center.z*LANDMARK_SCALE;
    landmarkZones[kind]={x,y:site[1],z,radius,perimeter:Array.from({length:64},(_,j)=>{const a=j/64*Math.PI*2,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;return [px,Math.max(WATER_LEVEL+.02,surface(px,pz)+.025),pz];})};
  }
  const compileWorld=(id,batches,baked=true)=>{
    const groups=new Map();for(const batch of batches){const mineral=batch.shape==='rock'||batch.shape==='obelisk',key=batch.surface+':'+mineral;let group=groups.get(key);if(!group){group={surface:batch.surface,mineral,pieces:[]};groups.set(key,group);}for(const values of batch.pieces)group.pieces.push({geometry:geometryForShape(batch.shape),matrix:new T.Matrix4().fromArray(values),tint:new T.Color().fromArray(values,16),wind:batch.surface==='cloth',phase:batch.phase});}
    return Array.from(groups.entries()).map(([key,group])=>{const g=merge(group.pieces);if(group.surface!=='carving')g.deleteAttribute('uv');if(baked)light.geometry(g);const geometry=pack.pack(id+'/'+key,g);g.dispose();return {surface:group.surface,mineral:group.mineral,geometry};});
  };
  const dressings=compileWorld('dressings',[...architecture.models.transport,...architecture.models.decor,...architecture.models.coastal]);
  const boats=[];for(const [boatIndex,boat] of HARBOR_BOATS.entries())for(const batch of architecture.models.boat){const transform=new T.Matrix4().makeTranslation(boat.x,WATER_LEVEL-.05,boat.z).multiply(new T.Matrix4().makeRotationY(boat.turn));boats.push({...batch,phase:boatIndex*1.7,pieces:batch.pieces.map(p=>[...transform.clone().multiply(new T.Matrix4().fromArray(p)).toArray(),...p.slice(16)])});}
  const harbor=compileWorld('harbor',boats,false);
  const glows={};for(const [kind,channels]of Object.entries(glow.models)){glows[kind]={};for(const [channel,data]of Object.entries(channels)){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(data.position,3));g.setAttribute('normal',new T.Float32BufferAttribute(data.normal,3));g.setIndex(data.index);glows[kind][channel]=pack.pack('glow/'+kind+'/'+channel,g);g.dispose();
  }}
  pack.write(low?'balanced':'high',{terrain:terrainNames,terrainChunks,occlusionBoxes:terrainOccluders(terrain),waterfall,roads,scenery,forest:forestGroups,units,landmarks:land,landmarkZones,dressings,harbor,boatShadows:HARBOR_BOATS,glows,coastal:architecture.models.coastal,transport:architecture.models.transport});terrain.dispose();
}
