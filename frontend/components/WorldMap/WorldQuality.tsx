"use client";
import { createContext,useContext,useEffect,useRef,useState,type ReactNode } from "react";
import { useFrame,useThree } from "@react-three/fiber";
import { QUALITY,frameBudgetAdjustment,initialQuality,type QualityTier } from "@/lib/worldMap/renderQuality";
export function detectWorldQuality():QualityTier{
  if(typeof window==="undefined")return "high";
  const params=new URLSearchParams(window.location.search),forced=params.get("world-quality");
  if(params.has("world-profile")&&(forced==="high"||forced==="balanced"||forced==="economy"))return forced;
  const capability=navigator as Navigator&{deviceMemory?:number;connection?:{saveData?:boolean}};
  return initialQuality({width:window.innerWidth,cores:navigator.hardwareConcurrency,memory:capability.deviceMemory,saveData:capability.connection?.saveData});
}
import { acquireWorldResources } from "./SharedWorldResources";
const MotionContext=createContext(false);
export const useWorldReducedMotion=()=>useContext(MotionContext);
const QualityContext=createContext<QualityTier>("high");
export const useWorldQuality=()=>useContext(QualityContext);
export function WorldQuality({tier,children}:{tier:QualityTier;children:ReactNode}){
  const [reduced,setReduced]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(()=>{const media=window.matchMedia("(prefers-reduced-motion: reduce)"),update=()=>setReduced(media.matches);media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
  useEffect(acquireWorldResources,[]);
  return <QualityContext.Provider value={tier}><MotionContext.Provider value={reduced}><AdaptivePixelRatio tier={tier}/>{children}</MotionContext.Provider></QualityContext.Provider>;
}
function AdaptivePixelRatio({tier}:{tier:QualityTier}){
  const gl=useThree(s=>s.gl),setDpr=useThree(s=>s.setDpr),invalidate=useThree(s=>s.invalidate);
  const sample=useRef({ema:0,elapsed:0,lastChange:0,last:0,warm:0});
  useEffect(()=>{sample.current={ema:0,elapsed:0,lastChange:0,last:0,warm:0};},[tier]);
  useFrame((_,delta)=>{
    const s=sample.current,now=performance.now(),quality=QUALITY[tier];s.elapsed+=delta;
    if(document.hidden||s.elapsed<4){s.last=now;return;}
    const interval=now-s.last;s.last=now;
    if(interval>200||interval<4)return;
    s.ema=s.ema?s.ema*.96+interval*.04:interval;
    if(s.elapsed-s.lastChange<8)return;
    s.lastChange=s.elapsed;
    const maximum=Math.min(window.devicePixelRatio||1,quality.maxDpr),current=gl.getPixelRatio();
    const next=frameBudgetAdjustment(s.ema,quality.waterFps,current,quality.minDpr,maximum);
    if(Math.abs(current-next)>.01){setDpr(next);invalidate();}
  });
  return null;
}
