# SURI frontend

This document explains frontend behavior, dashboard rendering, and world asset
authoring. Setup, startup, and deployment instructions are in the
[repository README](../README.md).

## Guided tutorials

First visits show a skippable guide for the dashboard, topic library and overview,
calculator, progress, playground, lessons, diagnostic, practice, quiz, and results.
Battle guides start in the main battle, rather than on diagnostic, practice, or
quiz introductions. Every step has Continue and Back controls. Highlighted
controls are optional, and missing or disabled elements never block the guide.
Quiz timers pause while a guide is active.

Use **Tutorial** in the page header to replay a guide. Session pages have a
floating Tutorial button. Login and registration have no tutorials. Completion,
skipping, and the skip-all preference are stored locally per student in the
browser. Existing students also receive each guide once.

Guide content and readiness selectors live in [lib/tutorials.ts](lib/tutorials.ts).
Add `data-tutorial` hooks for controls and `data-tutorial-scope` for pages with
several views, such as quiz phases. The shared
[TutorialProvider](components/tutorial/TutorialProvider.tsx) highlights visible
targets without intercepting page interactions. Phone and tablet guides use
touch-friendly sheets with persistent navigation, scrollable text, and positioning
that accounts for the visible viewport and math keyboard.

## Dashboard navigation and interaction

The five landmark IDs map to these destinations in
[navigation.ts](lib/worldMap/navigation.ts):

| Landmark ID | Destination | Route |
| --- | --- | --- |
| `keep` | History Logs | `/history-logs` |
| `topics` | Topics | `/topics` |
| `records` | Playground | `/playground` |
| `champions` | Progress | `/progress` |
| `calculator` | Calculator | `/calculator` |

Keyboard navigation uses the five label buttons. Projected building and circle
regions provide native pointer input without adding duplicate accessibility stops.
Each hover circle has a diameter of 1.5 times its building's longest baked X/Z
dimension. The scene packet stores its center, radius, and ground-following
outline. Hovering the circle or building activates the same landmark. Shared
material uniforms make the circle and nearby scenery glow while the landmark
keeps its original materials.

Camera framing and motion belong to [framing.ts](lib/worldMap/framing.ts) and
[MapCamera](components/WorldMap/MapCamera.tsx), with responsive behavior in
[responsiveCamera.ts](lib/worldMap/responsiveCamera.ts). Pointer capability selects
input controls independently of responsive framing. Missing headers and hidden
canvas measurements never trigger a new fit.

## World asset generation

World geometry, paths, textures, and lighting are compiled offline. The browser
restores cached geometry and instance matrices instead of assembling buildings,
finding routes, or baking shadows during rendering. Triangle alignment, roadbed
profiles, silhouette merging, and garden approaches around occupied foundations
are also resolved by the authoring tools.

Run the following commands **from `frontend/`, in order**, after terrain,
pathway, architecture, vegetation, or sun changes:

| Step | Command | Output or purpose |
| --- | --- | --- |
| 1 | `node scripts/bake-traversal.cjs` | Traversal graph and pathways |
| 2 | `node scripts/bake-architecture.cjs` | Compiled architecture instances |
| 3 | `node scripts/bake-environment.cjs` | Environment bake inputs |
| 4 | `python scripts/bake-environment.py` | Environment textures and lighting maps |
| 5 | `python scripts/bake-gpu-textures.py` | Native compressed texture variants |
| 6 | `node scripts/bake-world-scene.cjs` | High and balanced scene packets |
| 7 | `node scripts/bake-ambient-world.cjs` | Ambient models, routes, and timing |

The scripts use the installed Three.js/TypeScript packages, Python, NumPy, and
Pillow. The Python libraries are authoring dependencies and do not ship in the
application. Commit the generated traversal graph and public world-map assets.

[architecture/instances.json](public/world-map/architecture/instances.json)
stores compiled landmark and coastal-structure matrices and colors. Models share
modular geometry and materials. The final scene packets contain GPU-aligned
normalized normals/colors, material masks, per-island terrain bounds, merged
landmark surfaces, six paving meshes, merged bridge/decor/outpost surfaces,
byte-packed static sunlight/AO/visibility, and instanced scenery.

Northern scenery is authored in [northernIslands.ts](lib/worldMap/northernIslands.ts)
and [northernArchitecture.ts](lib/worldMap/northernArchitecture.ts). The northern
tower joins the merged coastal surface batches, outside the five primary
landmasses. Run the complete sequence after northern scenery or mountain edits.
After changing only an ambient model or route, rerun step 7; also run it after
changes to the underlying world bake.

## Environment materials and lighting

The assets in [public/world-map/environment](public/world-map/environment/) are
deterministic, offline-generated maps. The terrain atlas covers grass/organic
ground, limestone, coastal sand, and moist soil. Separate maps supply albedo,
tangent normals, and packed roughness/AO/height.

World-space masks contain baked terrain/object occlusion, afternoon sun
visibility, moisture, signed shoreline distance, water depth, and exposure.
The data PNG keeps alpha above one-half to protect its RGB data from browser
decoders. The [environment manifest](public/world-map/environment/manifest.json)
documents channel decoding and records the source hash.

Terrain atlas derivatives use unwrapped coordinates to avoid mip seams. Warped
texture coordinates and isotropic baked water normals break up repetitive
patterns. Native S3TC atlases require both linear and sRGB support; lossless
WebP/PNG provides the portable fallback. Depth, normal, and lighting masks remain
uncompressed on the GPU to protect coastal alignment.

Static lighting uses an offline height-field horizon bake with soft object
proxies instead of runtime shadow maps. Sky and cloud illumination represent an
approximate 14:30 afternoon, authored as an art direction rather than a
location/date solar simulation. Moving boat contact shadows use two instanced
quads following the fixed afternoon sun. Small cloth motion stays within its
static shadow envelope.

## Rendering, quality, and visibility

[renderQuality.ts](lib/worldMap/renderQuality.ts) defines high, balanced, and
economy profiles using high or balanced scene assets. Quality adjustment preserves
all five landmarks, island shapes, the complete traversal graph, PBR maps, and
forest positions. It adjusts terrain tessellation, small-object geometry LOD,
water sampling, device pixel ratio, and antialiasing. Initial selection accounts
for viewport size and hardware hints; runtime adjustment manages pixel ratio.

Water requests renders at 30 Hz in all current profiles. Input, camera, and glow
animations can invalidate at display cadence. The water timer pauses in hidden
documents and inactive canvases. Reduced motion freezes water, cloth, and ambient
positions. Terrain geometry, foliage placement, and baked lighting remain static.

Camera controllers own their frusta (`manual: true` on Canvas). Fiber's DPR
resize must not overwrite them, preserving POV, zoom, framing, pan constraints,
and route transitions during quality adjustment.

Static instances and moving actors compact their visible instances against the
camera frustum. Secondary terrain uses shared-buffer spatial views when regions
leave the frame and one merged draw in the overview. Conservative solid boxes
baked below the actual terrain hide completely occluded static instances. Their
orthographic visibility is cached; a different camera direction immediately
restores those instances. Partial silhouettes are retained.

Gzip scene packets use native `DecompressionStream` when available; raw packets
support older browsers. Shared buffers, materials, and textures stay in a bounded
application cache. The last world renderer releases their GPU allocations, and
instance buffers dispose on unmount.

## Ambient citizens, boats, and animation

Ambient life uses a separate binary packet containing cached merged models,
uniform-distance walking/water routes, and authored timing.
[AmbientWorld](components/WorldMap/AmbientWorld.tsx) uses six instanced actor
batches, one shared contact-shadow/wake batch, and one fountain-stream batch.
Static quays and small paving corrections are merged by material and carry the
same baked daylight as the landscape.

Citizens use GPU limb joints, with CPU root transforms at 15–24 Hz. Boats update
at 15 Hz, while offscreen transforms update at 1 Hz. These updates reuse the
ocean's frame cadence without allocating frame-time vectors or adding event
handlers, runtime pathfinding, raycasts, or collision queries. Pauses, return
journeys, and loop phases are deterministic.

The vessel timetable repeats every twenty minutes, with staggered eight-to-ten
minute voyages and baked right-of-way phases. Full vessel footprints are checked
offline across that period; boat-to-boat avoidance does not run in the browser.
