// One authored 14:00 daylight direction for offline bakes and GPU shading.
// The sun is ~53 degrees above the horizon; this is an art direction, not a
// geolocated solar ephemeris. Camera and world transforms are independent.
export const AFTERNOON_SUN = [-65, 100, 45] as const;
export const LOCAL_SUN = [-77.78174593052023, 100, -14.142135623730947] as const;
export const ENVIRONMENT_BOUNDS = { minX:-70,maxX:70,minZ:-55,maxZ:55 };
export const ENVIRONMENT_ASSET_VERSION = "purple-afternoon-v2";
export const WATER_LEVEL = -0.2;
