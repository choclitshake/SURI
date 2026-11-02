# Dashboard archipelago optimization validation

Validated November 1, 2026 (Asia/Taipei). Raw samples: [world-map-performance.json](world-map-performance.json).

## Implementation

- Architecture/BakedScene/BakedArchitecture/Landscape/TraversalNetwork: one cached binary scene packet per tier; merged landmark surfaces; six consolidated paving meshes; per-island terrain and forest culling; static instance matrices. Every original main-landmark triangle, terrain elevation in each existing mesh tier, routing feature and tree position is preserved. Unused UV buffers and duplicate unit geometries are removed.
- bake-world-scene.cjs: offline geometry, normals, masks, terrain alignment and scenery placement. Native four-component normalized short normals and byte colors/masks use GPU-friendly alignment. Gzip payloads are about 1.63 MiB high / 1.32 MiB balanced, with raw-packet fallback when DecompressionStream is unavailable.
- EnvironmentMaterials/EnvironmentTextureLoader: two mipmapped S3TC atlases selected only when linear and sRGB formats are supported. Existing lossless WebP/PNG remains the portable fallback. Native compression reduces estimated texture storage from 28.33 to 22.67 MiB. Normal, depth and lighting masks retain their original precision. Reused shader variants use uniform atlas parameters; rough foliage uses diffuse vertex daylight and baked canopy occlusion.
- WorldQuality/renderQuality/CoastalOcean/oceanShader: high, balanced and economy tiers adjust DPR, terrain tessellation, small-object LOD, water normal samples and antialiasing. No navigation island, building, bridge, path or tree position is disabled. Full terrain uses 16 material fetches; tablet terrain uses 10. Water uses four samples at high quality and three at lower tiers. Its geometry is static; waves remain GPU-only. Idle water cadence is 30 Hz, while camera, input and glow animations can invalidate at display cadence.
- KingdomWorld/LandmarkGlow: stable landmark props and memoized static scene; precomputed projected anchors; DOM projections update only when the camera, viewport or element references change. Purple shells and windows retain smooth hover, focus, press and selected feedback. Three focus changes caused 6 static landscape commits before optimization and 0 afterward. No runtime raycasting or pathfinding.
- SharedWorldResources/SceneWarmup: bounded cached geometry, texture and material objects; last-renderer GPU disposal; explicit instance-buffer disposal; listener/timer cleanup; asynchronous shader warm-up only on supported drivers. FocusedIslandWorld shares the same assets and quality policy.

## Measurements

Desktop viewport: 1440×900. Tablet-size viewport: 768×1024 on the same Intel UHD laptop, not a physical tablet. These are development-server measurements with diagnostic overhead, after shader warm-up. Continuous-throughput mode requests frames independently of the normal water timer. Values are rolling median/p95 samples.

| Case | Draw calls | Triangles | Frame median / p95 ms | CPU submit median ms | GPU median ms | Estimated textures MiB | Geometry/instance buffers MiB |
|---|---:|---:|---:|---:|---:|---:|---:|
| Desktop before | 124 | 280,905 | 17 / 26.1 | 4.2 | 14.99 | 28.33 | 3.47 |
| Desktop final balanced | 95 | 275,529 | 19.2 / 32.1 | 4.5 | 14.69 | 22.67 | 4.33 |
| Tablet viewport before | 80 | 267,833 | 16.7 / 22.2 | 2.8 | 7.63 | 28.33 | 3.47 |
| Tablet viewport final balanced | 72 | 261,641 | 16.7 / 19.9 | 3.4 | 8.35 | 22.67 | 4.33 |
| Tablet viewport final economy | 72 | 191,153 | 16.7 / 20.2 | 2.8 | 5.7 | 22.67 | 4.27 |

Draw calls and texture storage improve; balanced-tier throughput did not improve consistently. Desktop frame time is higher in the final sample; this pass does not establish a general FPS gain or guarantee 30/60 FPS on other hardware. Economy mode provides an actual geometry/shading reduction. Geometry buffers increase because compatible landmark pieces are merged while retaining their full detail. The portable-texture rendering path was exercised with zero native compressed textures.

GPU time uses EXT_disjoint_timer_query_webgl2 and rejects disjoint results. Texture bytes are an estimate from decoded dimensions/mips or compressed block payloads. Geometry bytes count scene-attached buffer attributes and instance arrays. Driver allocations, render targets, framebuffer storage, compositing and exact VRAM use are not exposed by this estimate. Baseline CPU timing used a post-frame hook; final timing is scoped to this renderer to avoid counting another route's canvas. CPU figures are therefore indicative rather than a strict controlled comparison.

## Regression verification

- All five routes opened successfully: History Logs, Topics, Playground, Progress and Calculator; return navigation and username/account dialog remain functional.
- Keyboard arrow focus and Enter activation; purple building glow; mobile-size pan beginning on a landmark suppresses navigation, and a subsequent tap activates the destination.
- Original MapCamera, framing, navigation and camera-response source files remain unchanged. Camera tests pass across 13 viewport sizes.
- Compiled terrain positions match the source geometry exactly in both existing tiers. Landmark triangle totals are unchanged. All five entrances and the fishing outpost remain connected; five crossings have dry abutments and no measured centerline deck penetration.
- Resource lifetime tests cover two concurrent world scopes and Strict Mode release/reacquire. Geometry/material/texture caches are intentionally retained on the CPU and release GPU allocations when the last world renderer unmounts.
- Production build, targeted ESLint, TypeScript, git diff checks, test-world-optimization, test-traversal, test-architecture, test-walking-paths, test-responsive-camera and verify-environment passed.

## Remaining limits

Physical older tablets and additional GPU/browser families were unavailable. Their 30 FPS target remains unverified. High quality may exceed a 16.7 ms GPU budget on this integrated GPU; capable desktop 60 FPS is a target, not a universal claim. Native texture compression here covers S3TC-capable hardware; other devices use the tested portable texture path. Browsers without DecompressionStream receive the larger raw scene packet. Existing WebGL fallback destinations remain available.

Forced high quality also rendered successfully at 1440×900: 307,173 triangles, 25.16 ms median GPU time, and 33.3 ms median frame interval at normal water cadence. This reinforces the integrated-GPU 60 FPS limitation. No console errors were recorded during final validation.
