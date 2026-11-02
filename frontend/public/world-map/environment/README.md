The environment maps are deterministic, offline-generated project assets.

From `frontend`, regenerate after terrain, vegetation, landmark or sun changes:

```sh
node scripts/bake-architecture.cjs
node scripts/bake-environment.cjs
python scripts/bake-environment.py
node scripts/test-architecture.cjs
python scripts/verify-environment.py
```

The authoring scripts use the installed Three.js/TypeScript packages, Python,
NumPy and Pillow. None of the Python libraries ship in the application.

`../architecture/instances.json` holds the five principal models and nine
non-interactive coastal structures. Runtime code restores their static matrices
and colors, sharing modular geometry and materials. Building assembly runs only
in the authoring compiler. Architecture tests check baked-data freshness, doorway
approaches, original landmark height limits, dry footprints and genuine openings.

The atlas contains grass/organic ground, limestone, coastal sand and moist soil.
Separate maps supply albedo, tangent normals, and packed roughness/AO/height.
World-space masks contain baked terrain/object occlusion, afternoon sun
visibility, moisture, signed shoreline distance, water depth and exposure.
The data PNG keeps alpha above one-half to protect its RGB data from browser
decoders. The manifest documents channel decoding and records the source hash.

Both quality tiers retain the island shapes, PBR maps and forest distribution.
Tablet mode reduces terrain tessellation, one material sample, pixel ratio and
water cadence (20 Hz rather than 30 Hz). Animation stops in hidden documents,
inactive canvases and with reduced motion. Only water uniforms change each
frame; the terrain, shadow bake and foliage transforms stay static.

Sky/cloud illumination is authored for an approximate 14:30 afternoon. It is
an art-directed daylight setting rather than a location/date solar simulation.
