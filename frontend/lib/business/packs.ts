import { PACK_TIER_CUM } from "../constants";
import { Tier } from "../types";

/** Decode a 0..9999 roll into a tier using a pack's cumulative thresholds (mirror PackSale.reveal). */
export function tierFromRoll(packType: number, roll: number): Tier {
  const cum = PACK_TIER_CUM[packType];
  if (!cum) throw new Error(`unknown packType ${packType}`);
  if (roll >= cum[2]) return Tier.Unique;
  if (roll >= cum[1]) return Tier.SuperRare;
  if (roll >= cum[0]) return Tier.Rare;
  return Tier.Common;
}

/** Per-tier probability of a single pull for a pack type (for UI odds display). */
export function pullProbabilities(packType: number): Record<Tier, number> {
  const cum = PACK_TIER_CUM[packType];
  if (!cum) throw new Error(`unknown packType ${packType}`);
  return {
    [Tier.Common]: cum[0] / 10000,
    [Tier.Rare]: (cum[1] - cum[0]) / 10000,
    [Tier.SuperRare]: (cum[2] - cum[1]) / 10000,
    [Tier.Unique]: (cum[3] - cum[2]) / 10000,
  };
}
