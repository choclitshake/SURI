# Northern archipelago and camera stability

2026-11-02. The final scene contains **no dragon**, following the user's
refinement. Its component, model authoring, animation, shadow and packed geometry
were removed. The northern tower remains decorative and has no routing target.

## Environment

- Thirteen additional northern islands/islets: wooded skerries, weathered rock,
  reefs, a quarry ruin, coastal outcrops and the signal-tower island. There are
  still exactly five primary islands and five routing landmarks.
- An ancient stone signal tower with buttresses, corbels, broken parapets,
  purple banners, ledge foundations, keeper's shelter and ruined cloister.
  Placement was checked in the existing projection, away from routing labels.
- Arcane mountains use overlapping broad ridges, rounded crests, gullies,
  shoulders and talus instead of radial cones. A broad inhabited saddle keeps
  the observatory approach and bridge landing accessible.
- Static sunlight, shadows, AO and coastal masks were rebuilt with the existing
  fixed afternoon lighting. Terrain uses both existing geometry tiers; scenery
  joins existing merged/instanced batches and uses existing materials/textures.
- Expanded northern boat corridors now check actual seabed clearance offline.
  The full vessel timetable remains deterministic, without runtime navigation.

## Camera

Pointer capability previously selected a different responsive fit, so switching
between touch and a mouse could change zoom. Input mode is now independent of
framing. Missing/replaced headers and inactive or zero-sized canvases cannot
apply a transient fit. The overview also restores its authored zoom/orientation
against stray external writes; explicit route transitions retain their behavior.

Base camera position `[45,121,190]`, target `[0,1,-8]`, orthographic half-height
`40`, world rotation, fixed projection envelope, route IDs and original
landmark anchors remain unchanged. Existing mobile exploration/pan and desktop
parallax remain available.

## Main files

- `lib/worldMap/northernIslands.ts`, `northernArchitecture.ts`, `landscape.ts`,
  `supportingArchitecture.ts`: geography and static modular architecture.
- `components/WorldMap/MapCamera.tsx`, `KingdomWorld.tsx`,
  `lib/worldMap/responsiveCamera.ts`: camera ownership, pointer separation and
  measured-header guards.
- `scripts/bake-architecture.cjs`, `bake-environment.cjs`,
  `bake-world-scene.cjs`, `bake-ambient-world.cjs`: baked assets/dependency data.
- `scripts/test-northern-world.cjs`, `test-camera-stability.cjs`: geography,
  framing and real React/Fiber lifecycle regression coverage.
- Generated `public/world-map/{scene,architecture,traversal,environment,ambient}`
  data and `lib/worldMap/generated/traversal.json` were refreshed.

## Validation

Production build and TypeScript passed. Targeted ESLint and diff checks passed.
Camera tests mount the actual controller in Fiber and exercise pointer changes,
DPR, active and hidden zero-size updates, desktop/tablet orientation, route
approach/return, repeated React renders and an injected external zoom reset.
Northern tests reject merging new islands into primary landmasses and verify
that no dragon geometry remains in either scene packet.

Terrain, traversal, architecture, texture-bake and resource-lifetime checks
passed. All five original route mappings and camera anchors pass regression
checks. All five entrances and crossings are connected; deck interference is
0.000 m. Ambient QA passed 2,068 water and 3,252 walking samples plus the full
repeating twenty-minute vessel timetable. Actual browser checks included
History Logs click/return and Calculator keyboard activation/return.

## Measured render cost

1440 x 900, balanced tier, DPR 1, Intel UHD Graphics 0x8A56 / ANGLE D3D11,
Next.js development server. Opt-in continuous profiling; the final sample ran
for over 70 seconds. Raw data is saved beside this note.

| Metric | Before | Final (no dragon) |
|---|---:|---:|
| Draw calls | 108 | 108 |
| Rendered triangles | 339,602 | 373,435 |
| Geometry/instance buffers | 8.70 MiB | 9.36 MiB |
| Estimated texture memory | 22.67 MiB | 22.67 MiB |
| Shader programs | 38 | 38 |
| Median frame interval | 16.6 ms | 16.5 ms |
| GPU median | 14.21 ms | 14.52 ms |
| GPU p95 | 15.62 ms | 15.48 ms |

These are development observations on one integrated GPU, with normal scheduler
and background-load variation. They do not certify older-tablet FPS. Physical
tablet testing remains outstanding. No new texture assets, dependencies,
real-time shadow passes, raycasts or per-frame terrain generation were added.
