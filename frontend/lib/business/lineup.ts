import { LINEUP_SIZE, FORMATIONS } from "../constants";
import { Tier } from "../types";
import type { Address } from "viem";

export interface LineupDraft {
  tokenIds: bigint[];
  formationIndex: number;
  captainIdx: number;
  viceIdx: number;
}

/**
 * Client-side mirror of GameRegistry.commitLineup pre-conditions (so the UI can block bad
 * commits before they revert). `controllerOf` returns the address allowed to play each card:
 * the active ERC-4907 renter if any, else the owner.
 */
export function validateLineup(
  draft: LineupDraft,
  wallet: Address,
  controllerOf: (tokenId: bigint) => Address
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (draft.tokenIds.length !== LINEUP_SIZE) errors.push(`lineup must have ${LINEUP_SIZE} cards`);
  if (!FORMATIONS[draft.formationIndex]) errors.push("invalid formation");
  if (draft.captainIdx < 0 || draft.captainIdx >= LINEUP_SIZE) errors.push("captain index out of range");
  if (draft.viceIdx < 0 || draft.viceIdx >= LINEUP_SIZE) errors.push("vice index out of range");
  if (draft.captainIdx === draft.viceIdx) errors.push("captain and vice must differ");

  const seen = new Set<string>();
  for (const id of draft.tokenIds) {
    const key = id.toString();
    if (seen.has(key)) errors.push(`duplicate card ${key} (one card = one lineup per matchday)`);
    seen.add(key);
    if (controllerOf(id).toLowerCase() !== wallet.toLowerCase()) {
      errors.push(`wallet does not control card ${key} (must own it or be the active renter)`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Tier-gate eligibility (PRD §5.2): every card must be >= the contest's minTier. */
export function isEligibleForContest(cardTiers: Tier[], minTier: Tier): boolean {
  return cardTiers.every((t) => t >= minTier);
}

/** Count cards per nation given a playerId -> nation code resolver, for country synergy. */
export function nationCounts(
  tokenIds: bigint[],
  nationOf: (tokenId: bigint) => string
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of tokenIds) {
    const n = nationOf(id);
    counts[n] = (counts[n] ?? 0) + 1;
  }
  return counts;
}
