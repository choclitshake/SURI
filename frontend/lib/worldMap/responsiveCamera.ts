import * as THREE from "three";
import { CAMERA_ORTHO_SIZE, CAMERA_POSITION, CAMERA_TARGET, LANDMARK_BOUNDS, LANDMARK_LABEL_LIFT, LANDMARK_SCALE, projectWorldPoint, worldFrame } from "./framing";
import { sitePosition } from "./landscape";

export const CAMERA_RESPONSE = {
  mobileBreakpoint: 900,
  mobileCoverage: 0.9,
  desktopZoom: 1.1,
  desktopZoomMultiplier: 1.25,
  desktopHeaderGapPixels: 20,
  desktopCameraDownFraction: 0.3,
  desktopVerticalMarginScale: 0.7,
  damping: 9,
  dragThreshold: 6,
  parallaxPixels: 12,
  idleMilliseconds: 1600,
} as const;

/** Bounds use the same projected terrain, architecture and label envelope as the world. */
export function responsiveCamera(width: number, height: number, projected: THREE.Box2, coarse: boolean, headerInset = 0) {
  const usableHeight = Math.max(1, height - headerInset);
  // Pointer capability selects controls, never the authored shot. Hybrid
  // tablets can switch primary pointers when a mouse is attached.
  const mobile = width <= CAMERA_RESPONSE.mobileBreakpoint;
  const frame = worldFrame(width, height, projected);
  const extent = projected.getSize(new THREE.Vector2()).multiplyScalar(frame.scale);
  // Include the label height and parallax travel in the header clearance.
  const desktopTop = headerInset + CAMERA_RESPONSE.desktopHeaderGapPixels + 48 + CAMERA_RESPONSE.parallaxPixels;
  const desktopBottom = 20 + CAMERA_RESPONSE.parallaxPixels;
  const verticalParallax = CAMERA_RESPONSE.parallaxPixels * CAMERA_RESPONSE.desktopVerticalMarginScale;
  const verticalTop = headerInset + 48 + CAMERA_RESPONSE.desktopHeaderGapPixels * CAMERA_RESPONSE.desktopVerticalMarginScale + verticalParallax;
  const zoom = mobile
    ? CAMERA_RESPONSE.mobileCoverage * 2 * CAMERA_ORTHO_SIZE * usableHeight / Math.max(height, 1) / extent.y
    : Math.min(CAMERA_RESPONSE.desktopZoom, 2 * CAMERA_ORTHO_SIZE * Math.max(1, height - desktopTop - desktopBottom) / (Math.max(height, 1) * extent.y)) * CAMERA_RESPONSE.desktopZoomMultiplier;
  const unitsPerPixel = 2 * CAMERA_ORTHO_SIZE / (Math.max(height, 1) * zoom);
  const view = new THREE.Vector2(width, height).multiplyScalar(unitsPerPixel);
  const baseline = new THREE.PerspectiveCamera();
  baseline.position.set(...CAMERA_POSITION);
  baseline.lookAt(...CAMERA_TARGET);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(baseline.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(baseline.quaternion);
  const position = baseline.position.clone();
  if (mobile) {
    // Render behind the transparent header, but center exploration in the usable area below it.
    const center = projected.getCenter(new THREE.Vector2()).multiplyScalar(frame.scale);
    const translation = new THREE.Vector3(...frame.position).sub(new THREE.Vector3(...CAMERA_TARGET));
    position.addScaledVector(right, center.x + translation.dot(right));
    position.addScaledVector(up, center.y + translation.dot(up) + headerInset * unitsPerPixel / 2);
  } else {
    // Center horizontally on the keep and lower the camera to raise the map.
    const worldTranslation = new THREE.Vector3(...frame.position).sub(new THREE.Vector3(...CAMERA_TARGET));
    const keep = new THREE.Vector3(...sitePosition("keep"));
    keep.y += LANDMARK_BOUNDS.keep[1] * LANDMARK_SCALE / 2;
    const center = projectWorldPoint(keep).multiplyScalar(frame.scale);
    position.addScaledVector(right, center.x + worldTranslation.dot(right));
    position.addScaledVector(up, center.y + worldTranslation.dot(up) - height * CAMERA_RESPONSE.desktopCameraDownFraction * unitsPerPixel);
    // Retain enough edge clearance for labels and the maximum parallax offset.
    const labels = new THREE.Box2();
    for (const site of ["keep", "topics", "records", "champions", "calculator"] as const) {
      const point = new THREE.Vector3(...sitePosition(site));
      point.y += (LANDMARK_BOUNDS[site][1] + LANDMARK_LABEL_LIFT) * LANDMARK_SCALE;
      labels.expandByPoint(projectWorldPoint(point).multiplyScalar(frame.scale));
    }
    labels.translate(new THREE.Vector2(worldTranslation.dot(right), worldTranslation.dot(up)));
    const offset = position.clone().sub(baseline.position);
    const x = offset.dot(right), y = offset.dot(up);
    position.addScaledVector(right, THREE.MathUtils.clamp(x, labels.max.x - view.x / 2 + 96 * unitsPerPixel, labels.min.x + view.x / 2 - 96 * unitsPerPixel) - x);
    position.addScaledVector(up, THREE.MathUtils.clamp(y, labels.max.y - view.y / 2 + verticalTop * unitsPerPixel, labels.min.y + view.y / 2 - (48 + verticalParallax) * unitsPerPixel) - y);
  }
  const limits = mobile
    ? new THREE.Vector2(
      Math.max(0, (extent.x - view.x) / 2 + Math.min(view.x * 0.25, 90 * unitsPerPixel)),
      Math.max(0, (extent.y - usableHeight * unitsPerPixel) / 2) + Math.max(usableHeight * unitsPerPixel * 0.06, 48 * unitsPerPixel),
    )
    : new THREE.Vector2(CAMERA_RESPONSE.parallaxPixels * unitsPerPixel, verticalParallax * unitsPerPixel);
  return { mobile, touch:mobile||coarse, zoom, position, quaternion: baseline.quaternion, right, up, limits, unitsPerPixel };
}

/** Pan translates only in the screen plane. Reject stray external zoom writes. */
export function applyOverviewPose(camera:THREE.OrthographicCamera|THREE.PerspectiveCamera,response:ReturnType<typeof responsiveCamera>,offset:THREE.Vector2){
  camera.position.copy(response.position).addScaledVector(response.right,offset.x).addScaledVector(response.up,offset.y);
  camera.quaternion.copy(response.quaternion);
  if(camera.zoom!==response.zoom){camera.zoom=response.zoom;camera.updateProjectionMatrix();}
  camera.updateMatrixWorld();
}
