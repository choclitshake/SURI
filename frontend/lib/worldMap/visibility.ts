import * as THREE from "three";
import { CAMERA_POSITION, CAMERA_TARGET, WORLD_ROTATION } from "./framing";

export type OcclusionBox = [number, number, number, number, number, number];
const camera = new THREE.PerspectiveCamera();
camera.position.set(...CAMERA_POSITION);
camera.lookAt(...CAMERA_TARGET);
camera.updateMatrixWorld();
const view = camera.matrixWorldInverse.clone().multiply(new THREE.Matrix4().makeRotationY(WORLD_ROTATION));
export const OCCLUSION_DIRECTION = new THREE.Vector3(...CAMERA_TARGET)
  .sub(new THREE.Vector3(...CAMERA_POSITION)).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), -WORLD_ROTATION);

function projectBox(box: THREE.Box3) {
  const points: THREE.Vector2[] = [], vertices: THREE.Vector3[] = [];
  let near = Infinity, far = -Infinity;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    vertices.push(new THREE.Vector3(x, y, z));
    const p = vertices[vertices.length - 1].clone().applyMatrix4(view);
    points.push(new THREE.Vector2(p.x, p.y));
    near = Math.min(near, -p.z); far = Math.max(far, -p.z);
  }
  return { points, vertices, bounds: new THREE.Box2().setFromPoints(points), near, far };
}
const cross = (a: THREE.Vector2, b: THREE.Vector2, p: THREE.Vector2) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
function convexHull(points: THREE.Vector2[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (list: THREE.Vector2[]) => {
    const result: THREE.Vector2[] = [];
    for (const p of list) {
      while (result.length > 1 && cross(result[result.length - 2], result[result.length - 1], p) <= 0) result.pop();
      result.push(p);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** Conservative occlusion by boxes baked wholly inside solid terrain. Only a
 * completely covered bounding box behind an entire blocker can be removed.
 * This fixed orthographic view is invariant under camera pan and zoom. */
export class TerrainOcclusion {
  private blockers;
  private ray = new THREE.Ray(new THREE.Vector3(), OCCLUSION_DIRECTION.clone().negate());
  private hit = new THREE.Vector3();
  constructor(boxes: OcclusionBox[]) {
    this.blockers = boxes.map(values => {
      const box = new THREE.Box3(new THREE.Vector3().fromArray(values), new THREE.Vector3().fromArray(values, 3));
      const projected = projectBox(box);
      return { ...projected, box, hull: convexHull(projected.points) };
    });
  }
  hides(box: THREE.Box3) {
    const target = projectBox(box);
    return this.blockers.some(blocker => {
      if (target.far <= blocker.near || !blocker.bounds.containsBox(target.bounds)) return false;
      if (!target.points.every(p => blocker.hull.every((a, i, hull) => {
        const b = hull[(i + 1) % hull.length];
        return cross(a, b, p) > .015 * a.distanceTo(b);
      }))) return false;
      // The orthographic shadow volume of a solid box is convex. If all eight
      // corners lie strictly inside it, the entire target box is hidden.
      return target.vertices.every(p => {
        this.ray.origin.copy(p).addScaledVector(OCCLUSION_DIRECTION, -.08);
        return this.ray.intersectBox(blocker.box, this.hit) !== null;
      });
    });
  }
}
