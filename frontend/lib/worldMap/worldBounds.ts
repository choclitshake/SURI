import * as THREE from "three";
import { ArchitectureBuilder, type Shape } from "./architecture";

// Match the primitive extents in Architecture.tsx, including non-unit rings/arches.
function shapeBox(shape:Shape) {
  if(shape==="ring")return new THREE.Box3(new THREE.Vector3(-1.05,-0.05,-1.05),new THREE.Vector3(1.05,0.05,1.05));
  if(shape==="arch")return new THREE.Box3(new THREE.Vector3(-0.5,0,0),new THREE.Vector3(0.5,1.05,0));
  if(shape==="hull")return new THREE.Box3(new THREE.Vector3(-0.8,-0.3,-0.8),new THREE.Vector3(0.8,0.4,0.8));
  return new THREE.Box3(new THREE.Vector3(-0.5,-0.5,-0.5),new THREE.Vector3(0.5,0.5,0.5));
}
export function architectureBounds(builder:ArchitectureBuilder,transform=new THREE.Matrix4()) {
  const box=new THREE.Box3();
  for(const batch of builder.batches.values())for(const piece of batch.pieces){
    box.union(shapeBox(batch.shape).applyMatrix4(transform.clone().multiply(piece.matrix)));
  }
  return box;
}
// Preserve the pre-redesign projection envelope exactly. The responsive camera
// consumes these bounds, so deriving them from new scenery would silently change
// its position, zoom and mobile pan limits. Terrain is authored inside this fit.
const overviewEnvelope = new THREE.Box2(
  new THREE.Vector2(-61.27058338861446, -34.47901018620054),
  new THREE.Vector2(69.59187298283034, 28.24409964504922),
);
export function playableProjectionBounds() { return overviewEnvelope; }
