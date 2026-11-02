/* eslint-disable @typescript-eslint/no-require-imports */
// Mount the real MapCamera in Fiber's reconciler. A renderer stub keeps this
// lifecycle/resize regression test independent of browser/GPU scheduling.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict'),ts=require('typescript'),T=require('three'),React=require('react');
const originalResolve=Module._resolveFilename;
Module._resolveFilename=function(name,...rest){return originalResolve.call(this,name.startsWith('@/')?path.join(__dirname,'..',name.slice(2)):name,...rest);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,jsx:4,esModuleInterop:true}}).outputText,f);
global.IS_REACT_ACT_ENVIRONMENT=true;
class Target extends EventTarget{closest(){return null;}hasPointerCapture(){return false;}}
const canvas=new Target(),media=new Map(),windowTarget=new Target();
global.window=Object.assign(windowTarget,{devicePixelRatio:1,matchMedia(query){if(!media.has(query))media.set(query,Object.assign(new Target(),{matches:false}));return media.get(query);}});
const {createRoot,_roots}=require('@react-three/fiber'),{MapCamera}=require('../components/WorldMap/MapCamera.tsx');
const {responsiveCamera}=require('../lib/worldMap/responsiveCamera.ts'),{playableProjectionBounds}=require('../lib/worldMap/worldBounds.ts');
const renderer={render(){},setPixelRatio(){},setSize(){},domElement:canvas,shadowMap:{enabled:false},xr:{isPresenting:false,enabled:false,addEventListener(){},removeEventListener(){},setAnimationLoop(){}},getPixelRatio(){return 1;}};
(async()=>{
  const root=createRoot(canvas),camera=new T.OrthographicCamera(-64,64,40,-40,.5,650);camera.manual=true;
  await root.configure({gl:renderer,camera,frameloop:'never',size:{width:1440,height:900,top:0,left:0},events:()=>({enabled:false,priority:0})});
  const store=_roots.get(canvas).store,props={command:null,active:true,headerInset:88};
  const render=async extra=>{Object.assign(props,extra);await React.act(async()=>root.render(React.createElement(MapCamera,{...props})));};
  let time=0;const frame=()=>{time+=1/30;store.getState().advance(time,true);};
  const snapshot=()=>JSON.stringify({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),zoom:camera.zoom,projection:camera.projectionMatrix.toArray()});
  await render({});frame();const original=snapshot();
  for(const coarse of [true,false,true,false]){
    await React.act(async()=>{const m=media.get('(pointer: coarse)');m.matches=coarse;m.dispatchEvent(new Event('change'));});frame();assert.equal(snapshot(),original,'pointer changes must not reframe the real controller');
  }
  for(const dpr of [.9,1.15,1]){await React.act(async()=>store.getState().setDpr(dpr));frame();assert.equal(snapshot(),original,'Fiber drawing-buffer resizes preserve camera');}
  await React.act(async()=>store.getState().setSize(0,0));frame();assert.equal(snapshot(),original,'transient zero size while active cannot mutate zoom');
  await React.act(async()=>store.getState().setSize(1440,900));frame();assert.equal(snapshot(),original,'valid size restores the same shot after active resize');
  await render({active:false});
  await React.act(async()=>store.getState().setSize(0,0));await render({headerInset:0});frame();assert.equal(snapshot(),original,'hidden zero-sized retained canvas cannot mutate the shot');
  await React.act(async()=>store.getState().setSize(1440,900));await render({active:true,headerInset:88});frame();assert.equal(snapshot(),original,'reactivation restores the identical overview');
  for(const [width,height]of [[768,1024],[1024,768],[1440,900]]){
    await React.act(async()=>store.getState().setSize(width,height));frame();const expected=responsiveCamera(width,height,playableProjectionBounds(),false,88);
    assert.equal(camera.zoom,expected.zoom);assert(camera.position.distanceTo(expected.position)<1e-10);assert(camera.quaternion.angleTo(expected.quaternion)<1e-7);
  }
  assert.equal(snapshot(),original,'desktop/tablet orientation round trip is deterministic');
  camera.zoom=.2;camera.updateProjectionMatrix();frame();assert.equal(snapshot(),original,'overview rejects an external zoom reset');
  let complete=0;await render({command:{id:1,kind:'island',site:'topics',instant:true,onComplete(){complete++;}}});frame();assert.equal(complete,1);assert(camera.zoom>1.375,'explicit route approach still zooms in');
  const focused=snapshot();await render({active:false});await React.act(async()=>store.getState().setSize(0,0));frame();assert.equal(snapshot(),focused,'hidden route transition is retained');
  await React.act(async()=>store.getState().setSize(1440,900));await render({active:true,preserveCameraOnActivate:true});frame();assert.equal(snapshot(),focused,'retained focus is preserved until explicit overview command');
  await render({command:{id:2,kind:'overview',instant:true,onComplete(){complete++;}}});frame();frame();assert.equal(complete,2);assert.equal(snapshot(),original,'explicit return restores the original framing');
  for(let i=0;i<20;i++){await render({command:{...props.command}});frame();assert.equal(snapshot(),original,'ordinary re-renders cannot replay a completed command');}
  await React.act(async()=>root.unmount());
  console.log('PASS: real MapCamera pointer changes, DPR changes, hidden/zero resize, tablet rotation, external zoom writes, retained route transitions and repeated React updates.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._resolveFilename=originalResolve;});
