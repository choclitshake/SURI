import type { ArchitectureBuilder } from "./architecture";
import { SITES, type RoutingSite } from "./landscape";
import { drawPrincipalLandmark } from "./landmarkDesigns";
export type OuterKind = "topics" | "records" | "champions" | "calculator";
export function outerFacing(kind:OuterKind){const [x,z]=SITES[kind];return Math.atan2(-x,-z);}
// Retain the established authoring entry point; live meshes load offline data.
export function drawOuterLandmark(builder:ArchitectureBuilder,kind:RoutingSite){drawPrincipalLandmark(builder,kind);}