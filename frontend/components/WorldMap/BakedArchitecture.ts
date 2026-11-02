"use client";
import { useBakedScene } from "./BakedScene";
/** All static instance matrices share the scene's single cached asset packet. */
export function useBakedArchitecture(kind:"coastal"|"transport"){
  return useBakedScene()[kind];
}
