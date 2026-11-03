"use client";
import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { OCCLUSION_DIRECTION, TerrainOcclusion } from "@/lib/worldMap/visibility";
import { useBakedScene } from "./BakedScene";

class Visibility {
  readonly frustum = new THREE.Frustum();
  revision = 0;
  occlusion = false;
  private clip = new THREE.Matrix4();
  private previous = new THREE.Matrix4();
  private inverse = new THREE.Matrix4();
  private direction = new THREE.Vector3();
  constructor(readonly terrain: TerrainOcclusion) {}
  update(camera: THREE.Camera, root: THREE.Group) {
    root.updateWorldMatrix(true, false);
    this.clip.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(root.matrixWorld);
    if (this.revision && this.clip.equals(this.previous)) return;
    this.previous.copy(this.clip);
    this.frustum.setFromProjectionMatrix(this.clip);
    this.inverse.copy(root.matrixWorld).invert();
    camera.getWorldDirection(this.direction).transformDirection(this.inverse);
    this.occlusion = (camera as THREE.OrthographicCamera).isOrthographicCamera && this.direction.dot(OCCLUSION_DIRECTION) > 1 - 1e-10;
    this.revision++;
  }
}
const Context = createContext<Visibility | null>(null);
export const useWorldVisibility = () => useContext(Context);

/** Refresh after MapCamera (-1), before instance updates (0). Camera movement
 * never waits for a GPU query, and changing the view direction restores objects. */
export function WorldVisibility({ children }: { children: ReactNode }) {
  const assets = useBakedScene(), root = useRef<THREE.Group>(null);
  const visibility = useMemo(() => new Visibility(new TerrainOcclusion(assets.occlusionBoxes ?? [])), [assets]);
  useFrame(({ camera }) => {
    if (root.current) visibility.update(camera, root.current);
  }, -.5);
  return <Context.Provider value={visibility}><group ref={root}>{children}</group></Context.Provider>;
}
