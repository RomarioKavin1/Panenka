/**
 * index.ts — Barrel re-export for lib/data.
 *
 * Also exposes helper lookups keyed by on-chain playerId:
 *   nationOf(playerId)   → Nation | undefined
 *   positionOf(playerId) → Position | undefined
 *   traitsOf(playerId)   → Trait[] ([primary, secondary] or [])
 */

export * from "./nations";
export * from "./traits";
export * from "./formationSynergy";
export * from "./players";
export * from "./fixtures";

import { PLAYER_BY_ID } from "./players";
import type { Nation } from "./nations";
import type { Position } from "@/lib/types";
import type { Trait } from "./traits";

export function nationOf(pid: `0x${string}`): Nation | undefined {
  return PLAYER_BY_ID.get(pid)?.nation;
}

export function positionOf(pid: `0x${string}`): Position | undefined {
  return PLAYER_BY_ID.get(pid)?.position;
}

export function traitsOf(pid: `0x${string}`): Trait[] {
  const p = PLAYER_BY_ID.get(pid);
  if (!p) return [];
  return [p.primaryTrait, p.secondaryTrait];
}
