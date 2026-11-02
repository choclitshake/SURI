# Dashboard world assets

The five routing IDs remain `keep` (History Logs), `topics`, `records`
(Playground), `champions` (Progress), and `calculator`. Camera framing and motion
are owned by the existing framing/MapCamera modules.

After terrain, pathways, or architectural changes, run from `frontend`, in order:

1. `node scripts/bake-traversal.cjs`
2. `node scripts/bake-architecture.cjs`
3. `node scripts/bake-landmark-glow.cjs`
4. `node scripts/bake-environment.cjs`
5. `python scripts/bake-environment.py`
6. `python scripts/bake-gpu-textures.py`
7. `node scripts/bake-world-scene.cjs`
8. `node scripts/bake-ambient-world.cjs`

Commit the generated traversal graph and public world-map assets. Routing,
triangle alignment, roadbed profiles, architectural assembly, silhouette merging,
and shadow generation run offline. The browser restores cached geometry and
instance matrices. Only the existing camera/water animation, projected native
pointer regions, small emissive fade uniforms, and GPU cloth/boat motion update
during rendering. Garden approaches are compiled around occupied foundations.

Verify with `test-world-optimization.cjs`, `test-traversal.cjs`, `test-architecture.cjs`,
`test-walking-paths.cjs`, `test-responsive-camera.cjs`, `test-world-refinement.cjs`, and
`test-ambient-world.cjs` / `verify-environment.py` in `scripts`. Keyboard navigation uses the existing five
label buttons; projected building/circle regions add no duplicate accessibility stops.

Each hover circle has a diameter of 1.5 times its building's longest baked X/Z
dimension. The scene packet stores the shared center, radius and ground-following
outline for native pointer input. The circle and nearby scenery glow through
shared material uniforms; the landmark itself keeps its original materials.

The final scene packet contains GPU-aligned normalized normals/colors, material
masks, per-island terrain bounds, merged landmark surfaces, six paving meshes,
merged bridge/decor/outpost surfaces, byte-packed static sunlight/AO/visibility,
and instanced scenery. Terrain atlas derivatives use unwrapped coordinates to
avoid mip seams; warped texture coordinates and isotropic baked water normals
break up repetitive patterns. Gzip packets use native DecompressionStream when present;
raw packets support older browsers. Native S3TC atlases require both linear and
sRGB support; lossless WebP/PNG is the portable fallback. Depth, normal and
lighting masks remain uncompressed on the GPU to protect coastal alignment.

Quality tiers preserve all five landmarks, the complete graph, and every tree
position. They adjust terrain tessellation, small-object geometry LOD, water
sampling, DPR and antialiasing. Water renders at 30 Hz while input/camera/glow
animations can invalidate at display cadence. Reduced motion freezes the water.
The existing camera controllers own their frusta (`manual: true` on Canvas);
Fiber's DPR resize must not overwrite them. This preserves all original POV,
zoom, framing, pan constraints and route transitions during quality adjustment.
Static lighting uses an offline height-field horizon bake with soft object
proxies, not runtime shadow maps. Moving boat contact shadows are two instanced
quads, following the fixed afternoon sun. The small cloth motion stays inside
its static shadow envelope. Reduced motion also freezes cloth and boats.
Shared buffers/materials/textures remain in a bounded application cache; the last
world renderer releases their GPU allocations. Instance buffers dispose on unmount.

For local profiling use `/dashboard?world-profile=benchmark`; normal-cadence
sampling uses `world-profile=normal`. Optional diagnostic overrides are
`world-quality=high|balanced|economy` and `world-textures=portable`. These are
developer diagnostics and do not add product settings or navigation UI.

Static instances and moving actors compact their visible instances against the
camera frustum. Secondary terrain uses shared-buffer spatial views when regions
leave the frame, and one merged draw in the overview. Conservative solid boxes
baked below the actual terrain also hide completely occluded static instances.
Their orthographic visibility is cached; a different camera direction immediately
restores those instances. Partial silhouettes are retained. For a diagnostic
comparison, add `world-culling=off` to a profiling URL.

Ambient life is a separate 434 KiB binary packet (75 KiB gzip) with cached
merged models, uniform-distance walking/water routes and authored timing.
`AmbientWorld` uses six instanced actor batches, one shared contact-shadow/wake
batch and one fountain-stream batch. Static quays and small paving corrections
are merged by material and carry the same baked daylight as the landscape.
Citizens use GPU limb joints, with CPU root transforms at 15–24 Hz. Boats update
at 15 Hz; offscreen transforms update at 1 Hz. These reuse the ocean's existing
frame cadence, allocate no frame-time vectors and add no event handlers, runtime
pathfinding, raycasts or collision queries. Pauses, return journeys and loop
phases are deterministic. Reduced motion freezes positions, cloth and water.
The vessel timetable repeats every twenty minutes, with staggered eight-to-ten
minute voyages and baked right-of-way phases. Full vessel footprints are checked
offline across that period; no boat-to-boat avoidance runs in the browser.

After changing an ambient model/route or an underlying world bake, rerun step 8
and `test-ambient-world.cjs`. The test checks full vessel clearance, actual
structural triangles, feet against both terrain tiers, complete bridge crossings,
offscreen arrivals and all travel/idle phases. Diagnostic profile URLs also
accept `world-ambient=off` for a same-view baseline, or `world-ambient-time=120`
to inspect a fixed simulation time; both require `world-profile`.


Northern scenery is authored in `northernIslands.ts` and
`northernArchitecture.ts`. The tower joins the existing merged coastal surface
batches; all thirteen additions stay outside the five primary landmasses.
After a northern or mountain edit run the complete bake sequence above, then
`node scripts/test-northern-world.cjs` and
`node scripts/test-camera-stability.cjs` alongside the existing checks.
The real MapCamera lifecycle test covers pointer changes, hidden zero-size
canvases, DPR, orientation, external zoom writes and retained route transitions.
Pointer capability selects input controls independently of responsive framing;
missing headers and hidden canvas measurements never trigger a new fit.
