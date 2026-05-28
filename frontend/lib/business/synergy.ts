/**
 * synergy.ts — Trait modifier computation (spec §4.2)
 *
 * Decomposes baseEventPoints into per-category values, applies TRAIT_BOOST
 * multipliers, and returns the adjustedTotal / baseTotal scalar that scoreCard
 * already accepts as `traitModifier`.
 *
 * Multi-trait composition rule: when multiple traits affect the same category,
 * each trait's delta (boost − 1) × categoryPoints is summed additively, then
 * added to the original category points. This is the "sum-of-deltas" rule.
 * Rationale: it avoids multiplicative explosion for stacked same-category
 * traits while remaining deterministic and easy to audit.
 *
 * Negative events (yellowCards, redCards, ownGoals, penaltiesMissed,
 * goalsConceded for DEF/GK) plus MOTM and played60 are folded into `base`.
 * Traits never boost `base` — they only boost the 7 concrete positive
 * event categories.
 */

import {
  SCORE_GOAL,
  SCORE_ASSIST,
  SCORE_CLEAN_SHEET,
  SCORE_TACKLE,
  SCORE_TACKLE_CAP,
  SCORE_KEY_PASS,
  SCORE_KEY_PASS_CAP,
  SCORE_SAVE,
  SCORE_SAVE_CAP,
  SCORE_PEN_SAVED,
  SCORE_MOTM,
  SCORE_PLAYED_60,
  SCORE_YELLOW,
  SCORE_RED,
  SCORE_OWN_GOAL,
  SCORE_PEN_MISSED,
  SCORE_CONCEDED_PER_2,
} from "../constants";
import type { MatchEvents, Position, FormationName } from "../types";
import type { Trait, EventCategory } from "../data/traits";
import { TRAIT_BOOST } from "../data/traits";
import {
  FORMATION_SYNERGIES,
  type SynergyName,
} from "../data/formationSynergy";

/**
 * The set of concrete category keys returned by eventPointBreakdown.
 * Note: "all" and "attacking" are derived TRAIT_BOOST meta-categories, NOT
 * breakdown keys. They are expanded when computing traitModifier.
 */
type BreakdownKey = Exclude<EventCategory, "all" | "attacking"> | "base";

/**
 * Decompose baseEventPoints into per-category contributions.
 *
 * INVARIANT (verified by tests): sum of all values === baseEventPoints(position, e)
 *
 * The 7 concrete positive categories: goals, assists, cleanSheet, tackles,
 * keyPasses, saves, penaltiesSaved.
 * The `base` bucket: MOTM + played60 + all negative events.
 */
export function eventPointBreakdown(
  position: Position,
  e: MatchEvents,
): Record<BreakdownKey, number> {
  // 7 positive event categories (may be 0 for positions that don't score them)
  const goals = e.goals * SCORE_GOAL[position];

  const assists = e.assists * SCORE_ASSIST;

  const cleanSheet = e.cleanSheet ? SCORE_CLEAN_SHEET[position] : 0;

  const tackles =
    position !== "GK"
      ? Math.min(e.tackles * SCORE_TACKLE, SCORE_TACKLE_CAP)
      : 0;

  const keyPasses =
    position !== "GK"
      ? Math.min(e.keyPasses * SCORE_KEY_PASS, SCORE_KEY_PASS_CAP)
      : 0;

  const saves =
    position === "GK"
      ? Math.min(e.saves * SCORE_SAVE, SCORE_SAVE_CAP)
      : 0;

  const penaltiesSaved =
    position === "GK" ? e.penaltiesSaved * SCORE_PEN_SAVED : 0;

  // `base`: MOTM + played60 + all negative events
  let base = 0;
  if (e.manOfTheMatch) base += SCORE_MOTM;
  if (e.played60) base += SCORE_PLAYED_60;
  base += e.yellowCards * SCORE_YELLOW;
  base += e.redCards * SCORE_RED;
  base += e.ownGoals * SCORE_OWN_GOAL;
  base += e.penaltiesMissed * SCORE_PEN_MISSED;
  if (position === "DEF" || position === "GK") {
    base += Math.floor(e.goalsConceded / 2) * SCORE_CONCEDED_PER_2;
  }

  return { goals, assists, cleanSheet, tackles, keyPasses, saves, penaltiesSaved, base };
}

/**
 * Compute the traitModifier scalar for a card.
 *
 * Formula: adjustedTotal / baseTotal
 *   - adjustedTotal: sum of category points after applying trait boosts
 *   - baseTotal: baseEventPoints(position, e) = sum of all breakdown values
 *
 * Guard: returns 1 if baseTotal <= 0 (DNP or pure-negative game).
 *
 * Trait meta-categories:
 *   "attacking" → scales goals, assists, keyPasses
 *   "all"       → scales every positive concrete category (not `base`)
 *
 * Composition: sum-of-deltas (see module docstring).
 */
export function traitModifier(
  scoringPosition: Position,
  traits: Trait[],
  e: MatchEvents,
): number {
  const bd = eventPointBreakdown(scoringPosition, e);
  const baseTotal = Object.values(bd).reduce((a, b) => a + b, 0);

  // Guard: if base is zero or negative, trait boosts are undefined/meaningless
  if (baseTotal <= 0) return 1;

  // No traits → no change
  if (traits.length === 0) return 1;

  // The concrete positive categories (excludes `base`)
  const CONCRETE_POSITIVE_CATS: Array<Exclude<BreakdownKey, "base">> = [
    "goals",
    "assists",
    "cleanSheet",
    "tackles",
    "keyPasses",
    "saves",
    "penaltiesSaved",
  ];

  // "attacking" meta-category expands to these concrete cats
  const ATTACKING_CATS: Array<Exclude<BreakdownKey, "base">> = [
    "goals",
    "assists",
    "keyPasses",
  ];

  // Accumulate delta per concrete category from all traits (sum-of-deltas)
  const delta: Record<Exclude<BreakdownKey, "base">, number> = {
    goals: 0,
    assists: 0,
    cleanSheet: 0,
    tackles: 0,
    keyPasses: 0,
    saves: 0,
    penaltiesSaved: 0,
  };

  for (const trait of traits) {
    const boost = TRAIT_BOOST[trait];

    for (const [cat, mult] of Object.entries(boost) as Array<[EventCategory, number]>) {
      if (cat === "all") {
        // Scale every positive concrete category
        for (const concreteCat of CONCRETE_POSITIVE_CATS) {
          delta[concreteCat] += (mult - 1) * bd[concreteCat];
        }
      } else if (cat === "attacking") {
        // Scale goals + assists + keyPasses
        for (const concreteCat of ATTACKING_CATS) {
          delta[concreteCat] += (mult - 1) * bd[concreteCat];
        }
      } else {
        // Direct concrete category
        const concreteCat = cat as Exclude<BreakdownKey, "base">;
        delta[concreteCat] += (mult - 1) * bd[concreteCat];
      }
    }
  }

  // Adjusted total = baseTotal + sum of all deltas
  const totalDelta = Object.values(delta).reduce((a, b) => a + b, 0);
  const adjustedTotal = baseTotal + totalDelta;

  return adjustedTotal / baseTotal;
}

/**
 * Compute formation-synergy multipliers for each card in a lineup (spec §4.3).
 *
 * @param input.formation - The lineup formation name (e.g. "4-3-3")
 * @param input.cards     - Array of 11 card stubs; `scoringPosition` is the
 *                          position used for mult lookups (may differ from the
 *                          nominal `position` when a card is played out of position)
 *
 * Returns:
 *   - `active`      — names of all triggered synergies
 *   - `multForCard` — function(i) → product of active synergy mults for card i,
 *                     clamped to [0.95, 1.15] per §4.9
 *                     (0.95 floor lets BrickDefense −5% through; 1.15 cap prevents runaway stacking)
 */
export function formationSynergy(input: {
  formation: FormationName;
  cards: { position: Position; scoringPosition: Position; traits: Trait[] }[];
}): { active: SynergyName[]; multForCard: (i: number) => number } {
  const { formation, cards } = input;

  // Build evaluation context once
  const ctx = {
    formation,
    traits: cards.map((c) => c.traits),
    positions: cards.map((c) => c.position),
  };

  // Evaluate which synergies are active
  const activeDefs = FORMATION_SYNERGIES.filter((def) => def.triggers(ctx));
  const active: SynergyName[] = activeDefs.map((def) => def.name);

  const multForCard = (i: number): number => {
    const scoringPos = cards[i].scoringPosition;

    // Product of all active synergy multipliers for this card's scoring position
    const raw = activeDefs.reduce(
      (product, def) => product * def.multForPosition(scoringPos),
      1,
    );

    // Clamp to [0.95, 1.15]: floor = 0.95 (lets BrickDefense −5% through);
    // cap = 1.15 (§4.9 prevents multiplicative stacking above max boost)
    return Math.min(1.15, Math.max(0.95, raw));
  };

  return { active, multForCard };
}
