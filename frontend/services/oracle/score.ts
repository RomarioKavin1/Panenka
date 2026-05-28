/**
 * score.ts — Oracle score runner (Task 4.2)
 *
 * Turns real MatchEvents into per-lineup ScoredCard[] by reusing the lib/business
 * engine. No point math is duplicated here — all computation delegates to:
 *   scoreCard()       (scoring.ts)
 *   traitModifier()   (synergy.ts)
 *   formationSynergy()(synergy.ts)
 *   nationCounts()    (lineup.ts)
 *   positionOf/nationOf/traitsOf() (lib/data/index.ts)
 *
 * Multiplier stacking order (spec §4.9, mirrors scoreCard internals):
 *   raw × tier × trait × oop × stamina × captain × country × formation × chip
 *
 * Vice-captain promotion:
 *   If the captain DNP'd (played60===false AND minutes===0 from ZERO_EVENTS),
 *   the vice-captain slot acts as captain for scoring purposes.
 */

import { FORMATIONS } from "@/lib/constants";
import { ChipId, type Lineup, type MatchEvents, type ScoredCard, type Tier } from "@/lib/types";
import { scoreCard, countrySynergyMult, lineupTotal } from "@/lib/business/scoring";
import { traitModifier, formationSynergy } from "@/lib/business/synergy";
import { nationCounts } from "@/lib/business/lineup";
import { positionOf, nationOf, traitsOf } from "@/lib/data/index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-tokenId metadata the caller must supply. Position/traits/nation are
 *  resolved from lib/data by playerId — the caller only needs to know which
 *  playerId a tokenId represents, and its stamina/tier at lineup time. */
export interface CardContext {
  playerId: `0x${string}`;
  tier: Tier;
  stamina: number;
}

export interface LineupScoreResult {
  wallet: string;
  cards: ScoredCard[];
  total: number;
}

// ---------------------------------------------------------------------------
// Zero events (DNP sentinel)
// ---------------------------------------------------------------------------

const ZERO_EVENTS: MatchEvents = {
  goals: 0, assists: 0, cleanSheet: false, tackles: 0, keyPasses: 0,
  saves: 0, penaltiesSaved: 0, manOfTheMatch: false, played60: false,
  yellowCards: 0, redCards: 0, ownGoals: 0, penaltiesMissed: 0,
  goalsConceded: 0, minutes: 0,
};

function isDNP(events: MatchEvents): boolean {
  return !events.played60 && events.minutes === 0;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Compute the full scored result for a lineup.
 *
 * @param lineup           - Lineup (matchday, wallet, tokenIds[11], formation, captainIdx, viceIdx, chipId)
 * @param eventsByPlayerId - Map from playerId → MatchEvents. A player not present → DNP → ZERO_EVENTS.
 * @param cardCtx          - Map from tokenId → { playerId, tier, stamina }
 */
export function computeLineupScore(
  lineup: Lineup,
  eventsByPlayerId: Map<`0x${string}`, MatchEvents>,
  cardCtx: Map<bigint, CardContext>,
): LineupScoreResult {
  const formation = FORMATIONS[lineup.formation];

  // Resolve per-card metadata from lib/data
  const cards = lineup.tokenIds.map((tokenId, slotIndex) => {
    const ctx = cardCtx.get(tokenId);
    if (!ctx) throw new Error(`CardContext missing for tokenId ${tokenId}`);

    const { playerId, tier, stamina } = ctx;
    const position = positionOf(playerId);
    if (!position) throw new Error(`positionOf unknown for playerId ${playerId}`);

    const nation = nationOf(playerId);
    if (!nation) throw new Error(`nationOf unknown for playerId ${playerId}`);

    const traits = traitsOf(playerId);
    const scoringPosition = formation.slots[slotIndex];
    const events = eventsByPlayerId.get(playerId) ?? ZERO_EVENTS;

    return { tokenId, playerId, tier, stamina, position, nation, traits, scoringPosition, events };
  });

  // Nation counts for country synergy (keyed by nationOf each tokenId)
  const nCounts = nationCounts(
    lineup.tokenIds,
    (tokenId) => {
      const ctx = cardCtx.get(tokenId)!;
      return nationOf(ctx.playerId) ?? "";
    },
  );

  // Formation synergy (uses all 11 cards' scoringPosition + traits)
  const synergy = formationSynergy({
    formation: formation.name,
    cards: cards.map((c) => ({
      position: c.position,
      scoringPosition: c.scoringPosition,
      traits: c.traits,
    })),
  });

  // Determine effective captain index:
  // If the captain DNP'd, the vice promotes to captain.
  const captainEvents = eventsByPlayerId.get(cards[lineup.captainIdx].playerId) ?? ZERO_EVENTS;
  const effectiveCaptainIdx = isDNP(captainEvents) ? lineup.viceIdx : lineup.captainIdx;

  // Score each card
  const scoredCards: ScoredCard[] = cards.map((card, slotIndex) => {
    const sameNationCount = nCounts[card.nation] ?? 1;
    const traitMod = traitModifier(card.scoringPosition, card.traits, card.events);
    const formSynMult = synergy.multForCard(slotIndex);
    const isCaptain = slotIndex === effectiveCaptainIdx;

    const { raw, final, breakdown } = scoreCard({
      position: card.position,
      scoringPosition: card.scoringPosition,
      tier: card.tier,
      events: card.events,
      stamina: card.stamina,
      isCaptain,
      chip: lineup.chipId,
      sameNationCount,
      traitModifier: traitMod,
      formationSynergyMult: formSynMult,
    });

    return {
      tokenId: card.tokenId,
      raw,
      final,
      breakdown,
    };
  });

  const total = scoredCards.reduce((sum, c) => sum + c.final, 0);

  return {
    wallet: lineup.wallet,
    cards: scoredCards,
    total,
  };
}
