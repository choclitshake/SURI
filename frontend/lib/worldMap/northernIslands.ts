import type { Island } from "./landscape";

// Authored in the existing camera envelope; none of these places route.
export const NORTHERN_ISLANDS = {
  wyrmrest: {x:25,z:-24,rx:5,rz:3.7,turn:-.38,seed:61,hill:3.6,biome:"ruins"},
  wyrmLedge: {x:21.5,z:-27.5,rx:1.9,rz:1.1,turn:.3,seed:62,hill:1.5,biome:"stack"},
  wyrmShoal: {x:18,z:-35,rx:1.6,rz:.75,turn:-.2,seed:63,hill:.16,biome:"reef"},
  northwood: {x:-39,z:-38,rx:4.5,rz:2.7,turn:-.6,seed:64,hill:2.7,biome:"highlands"},
  northwoodStack: {x:-44,z:-40,rx:1.5,rz:1.1,turn:.4,seed:65,hill:3,biome:"stack"},
  northwoodShoal: {x:-42,z:-35,rx:1.8,rz:.9,turn:.3,seed:66,hill:.2,biome:"reef"},
  oldQuarry: {x:-31,z:-48,rx:3.3,rz:2.1,turn:.2,seed:67,hill:3.2,biome:"ruins"},
  quarryScree: {x:-35,z:-46,rx:1.3,rz:.8,turn:-.6,seed:68,hill:1.8,biome:"stack"},
  eastReach: {x:32,z:-39,rx:4.2,rz:2.7,turn:-.4,seed:69,hill:3.1,biome:"ruins"},
  eastReachStack: {x:37,z:-41,rx:1.3,rz:1,turn:.4,seed:70,hill:3.4,biome:"stack"},
  eastReachReef: {x:35,z:-36,rx:1.7,rz:.9,turn:-.3,seed:71,hill:.18,biome:"reef"},
  gullhaven: {x:48,z:-29,rx:2.9,rz:2,turn:.6,seed:72,hill:2.3,biome:"sanctuary"},
  gullhavenSkerry: {x:52,z:-31,rx:1.1,rz:.7,turn:.8,seed:73,hill:2.4,biome:"stack"},
} satisfies Record<string,Island>;

export const WYRM_TOWER = {x:25,z:-24,floor:3.75,turn:.45} as const;
