/**
 * formationSynergy.ts — Formation synergy definitions (spec §4.3)
 *
 * Each SynergyDef describes:
 *   - `name`            — unique identifier
 *   - `triggers`        — pure predicate: given formation + per-card trait arrays
 *                         + card positions, returns true when the synergy fires
 *   - `multForPosition` — the multiplier applied to a card whose scoringPosition
 *                         matches; defaults to 1 for positions not listed
 *
 * `traits: Trait[][]` is indexed in the same order as `positions` (per-card).
 * A card "counts" toward a trait condition if ANY of its traits satisfies it.
 */

import type { FormationName, Position } from "@/lib/types";
import type { Trait } from "./traits";

export type SynergyName =
  | "WidePlay"
  | "IronWall"
  | "TikiTaka"
  | "CounterAttack"
  | "BrickDefense";

export interface SynergyDef {
  name: SynergyName;
  triggers: (ctx: {
    formation: FormationName;
    traits: Trait[][];
    positions: Position[];
  }) => boolean;
  /** Returns the formation-synergy multiplier for a given scoringPosition. */
  multForPosition: (pos: Position) => number;
}

/** Count how many cards have at least one trait from `set`. */
function countCardsWithAnyTrait(traits: Trait[][], set: Trait[]): number {
  return traits.filter((cardTraits) =>
    cardTraits.some((t) => (set as string[]).includes(t)),
  ).length;
}

export const FORMATION_SYNERGIES: SynergyDef[] = [
  /**
   * WidePlay — wide-formation + width carriers
   *   formation ∈ {"4-3-3","3-4-3"} AND ≥2 cards with Winger or Wingback
   *   DEF/MID/FWD: ×1.05 | GK: ×1.0
   */
  {
    name: "WidePlay",
    triggers({ formation, traits }) {
      const wideFormations: FormationName[] = ["4-3-3", "3-4-3"];
      if (!wideFormations.includes(formation)) return false;
      return countCardsWithAnyTrait(traits, ["Winger", "Wingback"]) >= 2;
    },
    multForPosition(pos) {
      return pos === "GK" ? 1.0 : 1.05;
    },
  },

  /**
   * IronWall — defensive fortress
   *   formation ∈ {"5-3-2"} AND ≥3 cards with Wall trait
   *   DEF/GK: ×1.10 | MID/FWD: ×1.0
   */
  {
    name: "IronWall",
    triggers({ formation, traits }) {
      if (formation !== "5-3-2") return false;
      return countCardsWithAnyTrait(traits, ["Wall"]) >= 3;
    },
    multForPosition(pos) {
      return pos === "DEF" || pos === "GK" ? 1.10 : 1.0;
    },
  },

  /**
   * TikiTaka — possession midfield
   *   formation ∈ {"4-3-3","3-5-2"} AND ≥3 cards with Playmaker or Creator
   *   MID: ×1.08 | others: ×1.0
   */
  {
    name: "TikiTaka",
    triggers({ formation, traits }) {
      const tikiformations: FormationName[] = ["4-3-3", "3-5-2"];
      if (!tikiformations.includes(formation)) return false;
      return countCardsWithAnyTrait(traits, ["Playmaker", "Creator"]) >= 3;
    },
    multForPosition(pos) {
      return pos === "MID" ? 1.08 : 1.0;
    },
  },

  /**
   * CounterAttack — poachers + ball-winners on the break
   *   ≥2 cards with Poacher AND ≥2 cards with BallWinner (any formation)
   *   FWD: ×1.12 | others: ×1.0
   */
  {
    name: "CounterAttack",
    triggers({ traits }) {
      const poacherCount = countCardsWithAnyTrait(traits, ["Poacher"]);
      const ballWinnerCount = countCardsWithAnyTrait(traits, ["BallWinner"]);
      return poacherCount >= 2 && ballWinnerCount >= 2;
    },
    multForPosition(pos) {
      return pos === "FWD" ? 1.12 : 1.0;
    },
  },

  /**
   * BrickDefense — mass defensive depth
   *   ≥5 cards with Wall or SweeperKeeper (any formation)
   *   DEF/GK: ×1.15 | FWD/MID: ×0.95 (attacker penalty)
   */
  {
    name: "BrickDefense",
    triggers({ traits }) {
      return countCardsWithAnyTrait(traits, ["Wall", "SweeperKeeper"]) >= 5;
    },
    multForPosition(pos) {
      if (pos === "DEF" || pos === "GK") return 1.15;
      return 0.95; // FWD and MID get a −5% penalty
    },
  },
];
