# Purple afternoon archipelago refinement

Validated November 1, 2026. This pass extends the existing five-island composition and modular scene pipeline.

## Visual and material changes

- `worldPalette`, `architecturalModules`, `landmarkDesigns`, `supportingArchitecture`, `EnvironmentMaterials`, and `AfternoonEnvironment` restore luminous greens, turquoise water, warm-neutral stone, violet roofs, purple fabric, lanterns and engraved accents.
- `environmentDecor` adds nine reserved garden clusters with fountains, monuments, shrines, planters, benches, pennants and lanterns. Each has a validated dry approach around the occupied landmark foundation. The observatory's steep mountain flank remains undeveloped. A fishing quay has piles, cargo and mooring posts; two GPU-animated boats clear the submerged rock across their full bounding footprints.
- `traversalArchitecture` adds bridge cutwaters, flared footings, arch voussoirs, end pennants, lanterns and road edging. The traversal bake rounds safe route corners and precomputes supported stair profiles. All five main entrances remain connected, with five supported crossings and fifteen core approaches.
- `terrainGeometry`, `EnvironmentMaterials`, `bake-environment.py`, and `oceanShader` replace periodic texture gratings with irregular weathering, rotated/warped terrain UVs and isotropic water normals. Explicit atlas derivatives prevent repeat boundaries from selecting incorrect mip levels. Two inexpensive differently oriented water samples break up repetition; the lower tier retains one normal-map fetch. Shoreline and depth masks remain aligned.
- `LandmarkGlow` uses stronger purple silhouette shells and emissive windows, with distinct idle, hover, keyboard focus, pressed and selected intensities. No circular ground selector or full-screen bloom is used.

## Lighting, batching and integration

`staticLighting` performs an offline height-field horizon bake against static object proxies, using the same fixed afternoon sun as the renderer. Terrain, paving, primary buildings, bridges, decor and outposts carry byte-packed irradiance, AO and visibility. `StaticMaterialFinish` applies these values without a real-time shadow-map pass. These are economical soft-shadow approximations; complex overhangs and openings do not receive full transport simulation.

`bake-world-scene`, `BakedScene`, `TraversalNetwork`, `Landscape`, `Harbor`, and `WorldMotion` merge compatible environmental surfaces and animate cloth/boats through shared GPU uniforms. Two instanced boat contact-shadow quads follow the fixed sun direction. Flags move within a small baked shadow envelope. Reduced motion freezes water, fabric and boat movement. Existing shared geometry/material caches, instanced vegetation, compressed atlases and quality tiers remain in use. Scene transfers are 2.82 MiB high / 2.39 MiB balanced gzip; raw packets remain available for older browsers.

All five routes retain their mappings: History Logs, Topics, Playground, Progress and Calculator. Camera constants, MapCamera, responsive camera calculations and navigation transitions are unchanged. Canvas now explicitly leaves frustum ownership with the existing camera controllers: adaptive DPR previously caused Fiber's automatic resize to overwrite the orthographic projection. A regression test exercises the real Fiber store across four DPR changes and checks that the projection and position remain identical.

## Verification and measurements

Production build, TypeScript, architecture/traversal/terrain tests, scene-packet validation, environment verification, new refinement tests and all thirteen camera viewport checks pass. Targeted ESLint has zero errors and one pre-existing unused-parameter warning in `makeVegetation`. Git whitespace checks pass. Browser checks covered all five destinations, return navigation, keyboard activation/focus, direct building clicks, tablet-size panning, phone-size activation, purple glow and portable texture rendering. No console or shader errors were observed.

Desktop diagnostic sample: [raw measurements](world-map-refinement-desktop-profile.json), Intel UHD, 1440×900, balanced, DPR 1: 93 idle draw calls, 310,754 triangles, 17.1 ms median / 33.3 ms p95 frame interval, 14.67 ms median GPU time, 8.27 MiB geometry/instance buffers and 22.67 MiB estimated textures. Active glow adds two silhouette draws. Static landscape commit count remained at its two development-mode mount commits during interactions.

The [tablet-size portable-texture sample](world-map-refinement-tablet-profile.json) confirms zero native compressed textures and 28.33 MiB estimated texture storage. Its 768×1024 run overlapped compilation and suffered long browser scheduling/GPU-query stalls; its frame percentiles are unsuitable for an FPS conclusion. Memory estimates exclude framebuffers, driver overhead and other hidden allocations. These are development-server measurements on one integrated-GPU laptop. Physical older-tablet 30 FPS and broad desktop 60 FPS targets remain unverified.

Rebake order and diagnostic options are documented in `lib/worldMap/README.md`.
