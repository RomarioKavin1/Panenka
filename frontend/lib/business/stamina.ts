import { STAMINA } from "../constants";

/**
 * Mirror GameRegistry._applyStamina: lazy regen for idle matchdays, optional Wildcard reset,
 * then the lineup cost (skipped by Free Hit). Returns the new stamina after committing on `matchday`.
 */
export function applyStamina(opts: {
  current: number;
  lastUsedMatchday: number;
  matchday: number;
  initialized: boolean;
  wildcard?: boolean;
  freeHit?: boolean;
}): number {
  let s = opts.initialized ? opts.current : STAMINA.max;
  if (opts.initialized && opts.matchday > opts.lastUsedMatchday + 1) {
    const idle = opts.matchday - opts.lastUsedMatchday - 1;
    s = Math.min(STAMINA.max, s + idle * STAMINA.regen);
  }
  if (opts.wildcard) s = STAMINA.max;
  if (!opts.freeHit) s = Math.max(0, s - STAMINA.cost);
  return s;
}

/** Stamina scoring modifier at commit time (spec §4.7). */
export function staminaModifier(stamina: number): number {
  if (stamina > STAMINA.freshThreshold) return STAMINA.freshBonus;
  if (stamina < STAMINA.fatiguedThreshold) return STAMINA.fatiguedPenalty;
  return 1;
}
