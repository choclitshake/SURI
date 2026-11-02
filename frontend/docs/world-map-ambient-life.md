# Ambient archipelago life

Implemented and validated November 2, 2026 (Asia/Taipei).

## Environment and behavior

- 36 small citizens populate the road network, all five crossings, landmark approaches, garden paths and two working quays. They walk on uniformly resampled baked routes, pause at endpoints, turn and return. A closed patrol circles the Playground's paved training courtyard and pauses between laps. A few attendants remain in gathering areas. Opposite walking lanes separate paired travelers.
- 15 new vessels augment the two existing moored fishing boats: rowboats, fishing boats, transports, merchant sailboats and two larger harbor vessels. Thirteen new vessels travel; two larger vessels remain anchored beside the harbors. Moving journeys last 480–600 seconds per leg/loop, with staggered offsets and berth pauses. Three routes enter visible coastal waters from outside the desktop framing and subsequently return outward. A baked twenty-minute timetable separates full vessel footprints; an independent quarter-second replay checks the entire repeating schedule. Boats turn slowly during berth holds. No runtime collision avoidance is needed.
- The Lantern Cove quay extension and Starfall trading pier have driven piles, cargo, small storage canopies, pennants, mooring posts and sagging ropes. Foot traffic stays in the clear dock aisles. Fountain ribbons shimmer, vessel sails flex, rowboat oars move gently and hulls bob subtly.
- Boat paths are compiled around a conservative disk enclosing the complete vessel. Shoals, islands, bridge structures, quays and anchored boats are excluded. Pedestrian routes use the actual paving/stair heights and both terrain tiers. Small buried garden paving sections were corrected to support walking figures. No runtime pathfinding, terrain queries, raycasting, physical wave collisions or crowd simulation is introduced.

## Files and rendering

- `lib/worldMap/ambient.ts`: deterministic, allocation-free route playback and smooth travel/idle/turn states.
- `lib/worldMap/ambientModels.ts`: reusable medieval figures, five vessel models and modular harbor dressing, authored offline.
- `scripts/bake-ambient-world.cjs`: offline route planning, geometry merging, material batching, static sun/AO baking and binary output.
- `components/WorldMap/AmbientAssets.ts`: cached typed-buffer loading with gzip/raw fallbacks and shared resource ownership.
- `components/WorldMap/AmbientWorld.tsx`: six instanced actor batches, one shared contact-shadow/wake batch and one instanced fountain batch. Citizens use inexpensive GPU limb joints; small actors use diffuse materials under the fixed afternoon lighting. Static harbor surfaces retain the existing baked material workflow.
- `components/WorldMap/Landscape.tsx`: mounts ambient life inside the existing world transform, outside focused-island scenes. The existing landscape remains memoized.
- `public/world-map/ambient`: 434 KiB of raw geometry, 75 KiB gzip, and approximately 159 KiB of route/manifest JSON. No new textures or dependencies.

Root transforms update at 15–24 Hz; offscreen actors update at 1 Hz. The existing ocean cadence supplies frames, so there is no second timer or animation loop. Preallocated poses, vectors, matrices and instance buffers avoid frame-time allocations. Reduced motion freezes the ambient clock and root transforms. Instance resources dispose on unmount; cached source buffers use the existing last-renderer GPU cleanup policy.

All five route mappings, landmark hit regions, keyboard controls, purple glow and camera source/configuration remain unchanged. Ambient meshes have disabled raycasting and add no pointer handlers or accessibility stops.

Browser regression checks opened all five destinations from the populated world,
including direct building-click activation and keyboard activation, and exercised
the existing return transitions. No new console or shader errors were observed.

## Validation and performance

`test-ambient-world.cjs` passes: 51 deterministic actors, 2,044 water samples, 3,270 walking samples, full vessel shoreline/bridge/quay clearance, actual structural triangle clearance, foot placement against both terrain tiers, complete pedestrian crossings, travel durations, collision-free repeated vessel scheduling and three offscreen arrivals. Existing traversal, garden/lighting, DPR-projection and thirteen responsive-camera checks pass. Production build, TypeScript, targeted ESLint and whitespace checks pass.

Same laptop/viewport/tier comparison: Intel UHD Graphics, 1440×900, balanced, DPR 1.

| Resource | Ambient off | Ambient on |
|---|---:|---:|
| Draw calls | 93 | 108 |
| Submitted triangles | 310,754 | 339,602 |
| Geometry/instance buffers | 8.27 MiB | 8.70 MiB |
| Estimated texture storage | 22.67 MiB | 22.67 MiB |
| Shader programs | 34 | 38 |
| Static landscape commits | 2 | 2 |

Raw samples: [baseline](world-map-ambient-baseline.json), [ambient enabled](world-map-ambient-profile.json). The enabled session was background-throttled (43 frames over 46.7 seconds), so it produced no usable frame-interval percentiles. GPU-query medians were 15.31 ms before and 20.03 ms with ambient life, but differing scheduling/power conditions prevent a controlled FPS conclusion. CPU submit medians are likewise not a reliable before/after comparison. Memory values exclude framebuffer and driver overhead. No physical older-tablet FPS claim is made.

Rebake after underlying terrain/architecture changes using the order in `lib/worldMap/README.md`. Ambient geometry is a separate additive packet, so this pass does not regenerate or simplify the primary environment.
