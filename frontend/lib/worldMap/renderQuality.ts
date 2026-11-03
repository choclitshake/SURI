export type QualityTier="high"|"balanced"|"economy";
export const QUALITY={
  high:{asset:"high",maxDpr:1.5,minDpr:1,waterFps:30,waterSegments:[72,64],simpleWater:false},
  balanced:{asset:"balanced",maxDpr:1.15,minDpr:.9,waterFps:30,waterSegments:[48,40],simpleWater:true},
  economy:{asset:"balanced",maxDpr:1,minDpr:.85,waterFps:30,waterSegments:[32,28],simpleWater:true},
} as const;
export function initialQuality(hints:{width:number;cores?:number;memory?:number;saveData?:boolean}):QualityTier{
  if(hints.saveData||(hints.memory??8)<=2||(hints.cores??8)<=2)return "economy";
  if(hints.width<=1024||(hints.memory??8)<=4||(hints.cores??8)<=4)return "balanced";
  return "high";
}
export function frameBudgetAdjustment(ema:number,fps:number,current:number,min:number,max:number){
  if(ema>1000/fps*1.4)return Math.max(min,+(current-.1).toFixed(2));
  if(ema<1000/fps*1.08)return Math.min(max,+(current+.05).toFixed(2));
  return current;
}
