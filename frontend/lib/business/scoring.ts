import {
  SCORE_GOAL, SCORE_ASSIST, SCORE_CLEAN_SHEET, SCORE_TACKLE, SCORE_TACKLE_CAP,
  SCORE_KEY_PASS, SCORE_KEY_PASS_CAP, SCORE_SAVE, SCORE_SAVE_CAP, SCORE_PEN_SAVED,
  SCORE_MOTM, SCORE_PLAYED_60, SCORE_YELLOW, SCORE_RED, SCORE_OWN_GOAL,
  SCORE_PEN_MISSED, SCORE_CONCEDED_PER_2, TIER_BONUS, CAPTAIN_MULT, COUNTRY_SYNERGY,
  OUT_OF_POSITION_PENALTY,
} from "../constants";
import { ChipId, Tier, type MatchEvents, type Position } from "../types";
import { staminaModifier } from "./stamina";

/** Raw event points for a card given its scoring position (spec §4.8). Pure base, no multipliers. */
export function baseEventPoints(position: Position, e: MatchEvents): number {
  let p = 0;
  p += e.goals * SCORE_GOAL[position];
  p += e.assists * SCORE_ASSIST;
  if (e.cleanSheet) p += SCORE_CLEAN_SHEET[position];
  if (position !== "GK") p += Math.min(e.tackles * SCORE_TACKLE, SCORE_TACKLE_CAP);
  if (position !== "GK") p += Math.min(e.keyPasses * SCORE_KEY_PASS, SCORE_KEY_PASS_CAP);
  if (position === "GK") p += Math.min(e.saves * SCORE_SAVE, SCORE_SAVE_CAP);
  if (position === "GK") p += e.penaltiesSaved * SCORE_PEN_SAVED;
  if (e.manOfTheMatch) p += SCORE_MOTM;
  if (e.played60) p += SCORE_PLAYED_60;
  p += e.yellowCards * SCORE_YELLOW;
  p += e.redCards * SCORE_RED;
  p += e.ownGoals * SCORE_OWN_GOAL;
  p += e.penaltiesMissed * SCORE_PEN_MISSED;
  if (position === "DEF" || position === "GK") {
    p += Math.floor(e.goalsConceded / 2) * SCORE_CONCEDED_PER_2;
  }
  return p;
}

/** Country synergy multiplier from the count of same-nation cards in the lineup (spec §4.5). */
export function countrySynergyMult(sameNationCount: number): number {
  for (const tier of COUNTRY_SYNERGY) if (sameNationCount >= tier.threshold) return tier.mult;
  return 1;
}

export function captainMult(role: "none" | "captain", chip: ChipId): number {
  if (role !== "captain") return CAPTAIN_MULT.none;
  return chip === ChipId.TripleCaptain ? CAPTAIN_MULT.tripleCaptain : CAPTAIN_MULT.captain;
}

export interface CardScoreInput {
  position: Position;
  scoringPosition: Position; // the slot it was played in (for out-of-position)
  tier: Tier;
  events: MatchEvents;
  stamina: number;
  isCaptain: boolean;
  chip: ChipId;
  sameNationCount: number;
  traitModifier?: number; // event-specific trait multiplier (default 1)
  formationSynergyMult?: number; // 1.0..1.15 (default 1)
}

/**
 * Multiplier stacking order from spec §4.9:
 * raw × tier × trait × out-of-position × stamina × captain × country × formation × chip.
 * Chip-specific effects (Doubler/Wildcard/FreeHit) are reflected via the stamina/captain inputs
 * the caller passes; Triple Captain is handled inside captainMult.
 */
export function scoreCard(input: CardScoreInput): { raw: number; final: number; breakdown: Record<string, number> } {
  const raw = baseEventPoints(input.scoringPosition, input.events);
  const tier = TIER_BONUS[input.tier];
  const trait = input.traitModifier ?? 1;
  const oop = input.position === input.scoringPosition ? 1 : OUT_OF_POSITION_PENALTY;
  const stam = staminaModifier(input.stamina);
  const cap = captainMult(input.isCaptain ? "captain" : "none", input.chip);
  const country = countrySynergyMult(input.sameNationCount);
  const formation = input.formationSynergyMult ?? 1;
  const final = raw * tier * trait * oop * stam * cap * country * formation;
  return {
    raw,
    final,
    breakdown: { tier, trait, oop, stam, cap, country, formation },
  };
}

export function lineupTotal(cards: CardScoreInput[]): number {
  return cards.reduce((sum, c) => sum + scoreCard(c).final, 0);
}
