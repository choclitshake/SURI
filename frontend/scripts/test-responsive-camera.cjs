// Run with: node scripts/test-responsive-camera.cjs
// Load the existing TypeScript geometry without adding a test dependency.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hook loads TypeScript geometry in Node. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
const THREE = require("three");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const { CAMERA_RESPONSE, responsiveCamera } = require("../lib/worldMap/responsiveCamera.ts");
const { playableProjectionBounds } = require("../lib/worldMap/worldBounds.ts");
const { worldFrame, CAMERA_ORTHO_SIZE, CAMERA_POSITION, CAMERA_TARGET, LANDMARK_BOUNDS, LANDMARK_LABEL_LIFT, LANDMARK_SCALE, projectWorldPoint } = require("../lib/worldMap/framing.ts");
const { sitePosition } = require("../lib/worldMap/landscape.ts");
const { ISLAND_ROUTES, islandCameraPose, FOCUSED_CAMERA_OFFSET, FOCUSED_HALF_HEIGHT, FOCUSED_ZOOM } = require("../lib/worldMap/navigation.ts");
const bounds = playableProjectionBounds();
for (const [width, fullHeight] of [[360,800], [375,812], [390,844], [430,932], [495,466], [844,390], [900,500], [768,1024], [1350,652], [1024,600], [1366,768], [1920,1080], [3440,1440]]) {
  const height = fullHeight;
  const headerInset = width <= 540 ? 70 : 88;
  const usableHeight = height - headerInset;
  const result = responsiveCamera(width, height, bounds, false, headerInset);
  const frame = worldFrame(width, height, bounds);
  // A changed overview angle must not move the zoom destination away from
  // the selected island, or jump in scale when a focused scene takes over.
  for (const site of Object.values(ISLAND_ROUTES)) {
    const focal = new THREE.Vector3(...sitePosition(site))
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), frame.rotation);
    focal.y += 3.2;
    const point = focal.clone().multiplyScalar(frame.scale).add(new THREE.Vector3(...frame.position));
    const pose = islandCameraPose(point, { close: true, worldScale: frame.scale });
    const camera = new THREE.OrthographicCamera(-CAMERA_ORTHO_SIZE * width / height, CAMERA_ORTHO_SIZE * width / height, CAMERA_ORTHO_SIZE, -CAMERA_ORTHO_SIZE, 0.5, 650);
    camera.position.copy(pose.position); camera.quaternion.copy(pose.quaternion); camera.zoom = pose.zoom;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const centered = point.clone().project(camera);
    assert.ok(Math.abs(centered.x) < 1e-8 && Math.abs(centered.y) < 1e-8, `${site}: approach centers selected island`);
    assert.ok(centered.z > -1 && centered.z < 1, `${site}: destination remains within clipping planes`);
    assert.ok(pose.quaternion.angleTo(result.quaternion) < 1e-7, `${site}: approach preserves dashboard angle`);
    const focused = new THREE.OrthographicCamera(-FOCUSED_HALF_HEIGHT * width / height, FOCUSED_HALF_HEIGHT * width / height, FOCUSED_HALF_HEIGHT, -FOCUSED_HALF_HEIGHT, 0.5, 420);
    focused.position.copy(focal).add(FOCUSED_CAMERA_OFFSET); focused.lookAt(focal); focused.zoom = FOCUSED_ZOOM;
    focused.updateProjectionMatrix(); focused.updateMatrixWorld();
    const landmark = focal.clone().add(new THREE.Vector3(2, 5, -3));
    const dashboardPoint = landmark.clone().multiplyScalar(frame.scale).add(new THREE.Vector3(...frame.position)).project(camera);
    const focusedPoint = landmark.project(focused);
    assert.ok(Math.abs(dashboardPoint.x - focusedPoint.x) < 1e-8 && Math.abs(dashboardPoint.y - focusedPoint.y) < 1e-8, `${site}: close-up framing matches handoff`);
  }
  const extent = bounds.getSize(new THREE.Vector2()).multiplyScalar(frame.scale);
  assert.ok(Number.isFinite(result.zoom) && result.zoom > 0);
  assert.ok(result.limits.x >= 0 && result.limits.y >= 0);
  if (result.mobile) {
    assert.ok(Math.abs(extent.y / (usableHeight * result.unitsPerPixel) - 0.9) < 1e-8, "every mobile orientation uses fullscreen vertical coverage");
    // Every landmark's label can be brought fully on screen with a legal pan.
    const translation = new THREE.Vector3(...frame.position).sub(new THREE.Vector3(...CAMERA_TARGET));
    const cameraOffset = result.position.clone().sub(new THREE.Vector3(...CAMERA_POSITION));
    const centerY = bounds.getCenter(new THREE.Vector2()).y * frame.scale + translation.dot(result.up) - cameraOffset.dot(result.up);
    assert.ok(Math.abs(centerY / result.unitsPerPixel + headerInset / 2) < 1e-8, "initial scene center lies below the header");
    for (const site of ["keep", "topics", "records", "champions", "calculator"]) {
      const p = new THREE.Vector3(...sitePosition(site));
      p.y += (LANDMARK_BOUNDS[site][1] + LANDMARK_LABEL_LIFT) * LANDMARK_SCALE;
      const projected = projectWorldPoint(p).multiplyScalar(frame.scale);
      projected.x += translation.dot(result.right) - cameraOffset.dot(result.right);
      projected.y += translation.dot(result.up) - cameraOffset.dot(result.up);
      const x = THREE.MathUtils.clamp(projected.x, -result.limits.x, result.limits.x);
      const y = THREE.MathUtils.clamp(projected.y + headerInset * result.unitsPerPixel / 2, -result.limits.y, result.limits.y);
      assert.ok(Math.abs(projected.x - x) / result.unitsPerPixel + 84 < width / 2, `${site} horizontal label access`);
      assert.ok((projected.y - y) / result.unitsPerPixel + 48 < height / 2 - headerInset, `${site} vertical label access below navigation`);
      assert.ok((projected.y - y) / result.unitsPerPixel - 48 > -height / 2, `${site} vertical label access above bottom edge`);
    }
  }
  if (!result.mobile) {
    const fittedZoom = Math.min(CAMERA_RESPONSE.desktopZoom, 2 * CAMERA_ORTHO_SIZE * (height - headerInset - CAMERA_RESPONSE.desktopHeaderGapPixels - 60 - 32) / (height * extent.y));
    assert.ok(Math.abs(result.zoom / fittedZoom - 1.25) < 1e-8, "desktop map is 25% larger than the previous fitted view");
    assert.ok(result.limits.x / result.unitsPerPixel <= 12 + 1e-8);
    assert.ok(Math.abs(result.limits.y / result.unitsPerPixel - 8.4) < 1e-8, "desktop vertical camera travel is reduced by 30%");
    const translation = new THREE.Vector3(...frame.position).sub(new THREE.Vector3(...CAMERA_TARGET));
    const cameraOffset = result.position.clone().sub(new THREE.Vector3(...CAMERA_POSITION));
    const keep = new THREE.Vector3(...sitePosition("keep"));
    keep.y += LANDMARK_BOUNDS.keep[1] * LANDMARK_SCALE / 2;
    const keepCenter = projectWorldPoint(keep).multiplyScalar(frame.scale);
    keepCenter.x += translation.dot(result.right) - cameraOffset.dot(result.right);
    keepCenter.y += translation.dot(result.up) - cameraOffset.dot(result.up);
    assert.ok(Math.abs(keepCenter.x) < 1e-8, "desktop keep remains horizontally centered");
    assert.ok(keepCenter.y > 0 && keepCenter.y / result.unitsPerPixel <= height * CAMERA_RESPONSE.desktopCameraDownFraction + 1e-8, "lowering the camera raises the map up to 30%, bounded by header clearance");
    for (const site of ["keep", "topics", "records", "champions", "calculator"]) {
      const p = new THREE.Vector3(...sitePosition(site));
      p.y += (LANDMARK_BOUNDS[site][1] + LANDMARK_LABEL_LIFT) * LANDMARK_SCALE;
      const point = projectWorldPoint(p).multiplyScalar(frame.scale);
      point.x += translation.dot(result.right) - cameraOffset.dot(result.right);
      point.y += translation.dot(result.up) - cameraOffset.dot(result.up);
      assert.ok(Math.abs(point.x) / result.unitsPerPixel + 84 + 12 <= width / 2 + 1e-8, `${site} desktop horizontal access`);
      assert.ok(point.y / result.unitsPerPixel + 48 + 8.4 <= height / 2 - headerInset - CAMERA_RESPONSE.desktopHeaderGapPixels * 0.7 + 1e-8, `${site} desktop label clears the header with the 30% smaller margin`);
      assert.ok(point.y / result.unitsPerPixel - 48 - 8.4 >= -height / 2 - 1e-8, `${site} desktop access above bottom edge`);
    }
  }
  console.log(`${width}x${fullHeight}: ${result.mobile ? "mobile" : "desktop"}, zoom=${result.zoom.toFixed(3)}, coverage=${(extent.y / (2 * CAMERA_ORTHO_SIZE / result.zoom)).toFixed(3)}`);
}
// Frame-rate independent damping converges identically at 30, 60 and 144 Hz.
for (const hz of [30, 60, 144]) {
  let position = 0;
  for (let frame = 0; frame < hz; frame++) position += (1 - position) * (1 - Math.exp(-9 / hz));
  assert.ok(Math.abs(position - (1 - Math.exp(-9))) < 1e-10);
}
assert.equal(responsiveCamera(1366, 680, bounds, true).touch, true, "coarse pointer uses touch controls");
console.log("Camera geometry and damping checks passed.");
