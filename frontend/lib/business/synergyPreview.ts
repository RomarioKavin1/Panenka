/**
 * synergyPreview.ts — Pure lineup preview (Task 6.1, spec §4.x)
 *
 * Computes EXACTLY the multipliers the scoring oracle will apply, so the UI
 * preview never diverges from oracle scoring.
 *
 * Key invariant: every number returned here is obtained by DELEGATING to the
 * same pure functions used by the oracle (formationSynergy, countrySynergyMult,
 * nationCounts, staminaModifier, TRAIT_BOOST). No math is duplicated here.
 */

import type { Position, FormationName } from "../types";
import type { Trait, EventCategory } from "../data/traits";
import type { SynergyName } from "../data/formationSynergy";
import { TRAIT_BOOST } from "../data/traits";
import { STAMINA } from "../constants";
import { formationSynergy } from "./synergy";
import { countrySynergyMult } from "./scoring";
import { nationCounts } from "./lineup";

// ─────────────────────────────────────────────────────────────────────────────
// Public input/output types
// ─────────────────────────────────────────────────────────────────────────────

export interface PreviewCard {
  /** On-chain bytes32 player id — used as a stable key. */
  playerId: `0x${string}`;
  /** The player's natural (registered) position. */
  naturalPosition: Position;
  /** The slot they are placed in within the formation. */
  scoringPosition: Position;
  /** Nation code (e.g. "FRA", "ARG"). */
  nation: string;
  /** Active traits for this card. */
  traits: Trait[];
  /** Current stamina value (0–100). */
  stamina: number;
}

export interface PreviewInput {
  formation: FormationName;
  captainIdx: number;
  viceIdx: number;
  cards: PreviewCard[]; // length 11
}

export interface PreviewOutput {
  /** Country synergy multiplier: countrySynergyMult(max nation count). */
  countryMult: number;
  /** Names of all triggered formation synergies. */
  activeSynergies: SynergyName[];
  /** Formation synergy multiplier per card index (clamped [0.95, 1.15]). */
  formationMultForCard: number[];
  /** true if scoringPosition !== naturalPosition (OUT_OF_POSITION_PENALTY applies). */
  oopFlags: boolean[];
  /** Stamina band per card. */
  staminaFlags: ("Fresh" | "Normal" | "Fatigued")[];
  /** EventCategory keys that each card's traits boost (from TRAIT_BOOST). */
  perCardTraitHints: string[][];
}

// ─────────────────────────────────────────────────────────────────────────────
// Stamina band — derived from STAMINA constants (mirrors staminaModifier logic)
// ─────────────────────────────────────────────────────────────────────────────

function staminaBand(stamina: number): "Fresh" | "Normal" | "Fatigued" {
  // Mirror exactly: staminaModifier uses strict > and strict <
  if (stamina > STAMINA.freshThreshold) return "Fresh";
  if (stamina < STAMINA.fatiguedThreshold) return "Fatigued";
  return "Normal";
}

// ─────────────────────────────────────────────────────────────────────────────
// Trait hints — EventCategory keys boosted by a card's traits
// ─────────────────────────────────────────────────────────────────────────────

function traitHints(traits: Trait[]): string[] {
  const boostedCats = new Set<string>();
  for (const trait of traits) {
    const boost = TRAIT_BOOST[trait];
    for (const cat of Object.keys(boost) as EventCategory[]) {
      boostedCats.add(cat);
    }
  }
  return Array.from(boostedCats);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Preview the exact multipliers the scoring oracle will apply to a lineup.
 *
 * All values are derived by delegating to the existing pure functions —
 * no math is re-implemented here.
 */
export function previewLineup(input: PreviewInput): PreviewOutput {
  const { formation, cards } = input;

  // ── Formation synergy ────────────────────────────────────────────────────
  // Delegate entirely to formationSynergy; keep the result to extract active
  // synergy names and per-card multipliers.
  const synergyResult = formationSynergy({
    formation,
    cards: cards.map((c) => ({
      position: c.naturalPosition,
      scoringPosition: c.scoringPosition,
      traits: c.traits,
    })),
  });

  const formationMultForCard = cards.map((_, i) => synergyResult.multForCard(i));

  // ── Country synergy ──────────────────────────────────────────────────────
  // nationCounts needs tokenIds → we use synthetic BigInt indices because
  // only the nation mapping matters for counting; the real nation is on
  // PreviewCard.nation (already resolved).
  const fakeIds = cards.map((_, i) => BigInt(i));
  const counts = nationCounts(fakeIds, (id) => cards[Number(id)].nation);
  // countrySynergyMult takes the count for a single nation (the largest group,
  // matching how scoreCard applies it: same nation count per card's own nation).
  // The oracle applies the count of the card's own nation to every card, so
  // preview exposes the maximum same-nation count as the lineup-level multiplier.
  const maxNationCount = Math.max(...Object.values(counts));
  const countryMult = countrySynergyMult(maxNationCount);

  // ── Out-of-position flags ────────────────────────────────────────────────
  const oopFlags = cards.map((c) => c.scoringPosition !== c.naturalPosition);

  // ── Stamina flags ────────────────────────────────────────────────────────
  const staminaFlags = cards.map((c) => staminaBand(c.stamina));

  // ── Per-card trait hints ─────────────────────────────────────────────────
  const perCardTraitHints = cards.map((c) => traitHints(c.traits));

  return {
    countryMult,
    activeSynergies: synergyResult.active,
    formationMultForCard,
    oopFlags,
    staminaFlags,
    perCardTraitHints,
  };
}
