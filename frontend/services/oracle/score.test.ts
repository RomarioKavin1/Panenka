/**
 * score.test.ts — TDD tests for computeLineupScore (Task 4.2)
 *
 * All expected values are hand-computed (see __fixtures__/sample-matchday.json
 * and the inline comments below).
 *
 * Stacking order (spec §4.9):
 *   raw × tier × trait × oop × stamina × captain × country × formation × chip
 *
 * Fixture: France 4-3-3 XI (formationIndex=0), matchday=1
 *   Active synergy: WidePlay (Theo=Wingback + Dembele=Winger ≥2)
 *     → GK×1.0, DEF/MID/FWD×1.05
 *   Country: all 11 FRA → sameNationCount=11 → countrySynergyMult=1.2
 *   Chip: ChipId.None=255 → captainMult=2.0 (not triple)
 *   Captain: slot10 Mbappe; Vice: slot7 Griezmann
 *   KEY SCENARIO: Mbappe DNP (minutes=0) → vice Griezmann gets ×2 captain mult
 */

import { describe, it, expect } from "vitest";
import { computeLineupScore } from "./score";
import { ChipId, Tier, type Lineup, type MatchEvents } from "@/lib/types";
import { PLAYERS } from "@/lib/data/players";

// ---------------------------------------------------------------------------
// Player ID helpers — resolve from catalog, same keccak as on-chain
// ---------------------------------------------------------------------------

function pid(key: string): `0x${string}` {
  const p = PLAYERS.find((pl) => pl.key === key);
  if (!p) throw new Error(`Player not found: ${key}`);
  return p.playerId;
}

// ---------------------------------------------------------------------------
// Zero events (DNP)
// ---------------------------------------------------------------------------

const ZERO_EVENTS: MatchEvents = {
  goals: 0, assists: 0, cleanSheet: false, tackles: 0, keyPasses: 0,
  saves: 0, penaltiesSaved: 0, manOfTheMatch: false, played60: false,
  yellowCards: 0, redCards: 0, ownGoals: 0, penaltiesMissed: 0,
  goalsConceded: 0, minutes: 0,
};

// ---------------------------------------------------------------------------
// France XI player IDs (in slot order for 4-3-3)
// slot: 0=GK 1-4=DEF 5-7=MID 8-10=FWD
// ---------------------------------------------------------------------------

const MAIGNAN_PID   = pid("FRA-1-Maignan");    // slot0 GK
const PAVARD_PID    = pid("FRA-2-Pavard");      // slot1 DEF
const KOUNDE_PID    = pid("FRA-5-Kounde");      // slot2 DEF
const UPAMA_PID     = pid("FRA-4-Upamecano");   // slot3 DEF
const THEO_PID      = pid("FRA-22-Theo");       // slot4 DEF
const TCHOU_PID     = pid("FRA-8-Tchouameni");  // slot5 MID
const RABIOT_PID    = pid("FRA-14-Rabiot");     // slot6 MID
const GRIEZ_PID     = pid("FRA-7-Griezmann");   // slot7 MID  (VICE → CAPTAIN when cap DNP)
const DEMBELE_PID   = pid("FRA-11-Dembele");    // slot8 FWD
const GIROUD_PID    = pid("FRA-9-Giroud");      // slot9 FWD
const MBAPPE_PID    = pid("FRA-10-Mbappe");     // slot10 FWD (CAPTAIN)

// Token IDs (sequential bigints matching slot order)
const TOKEN_IDS = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n, 11n];

// cardCtx: per-tokenId metadata. All FRA, positions/traits from lib/data.
// Tiers: Kounde=Rare, Giroud=Rare, Mbappe=Unique, rest=Common
// Staminas: Maignan=80 (fresh>70), Griezmann=80 (fresh), rest=50 (normal)
const CARD_CTX = new Map([
  [1n,  { playerId: MAIGNAN_PID,  tier: Tier.Common, stamina: 80 }],
  [2n,  { playerId: PAVARD_PID,   tier: Tier.Common, stamina: 50 }],
  [3n,  { playerId: KOUNDE_PID,   tier: Tier.Rare,   stamina: 50 }],
  [4n,  { playerId: UPAMA_PID,    tier: Tier.Common, stamina: 50 }],
  [5n,  { playerId: THEO_PID,     tier: Tier.Common, stamina: 50 }],
  [6n,  { playerId: TCHOU_PID,    tier: Tier.Common, stamina: 50 }],
  [7n,  { playerId: RABIOT_PID,   tier: Tier.Common, stamina: 50 }],
  [8n,  { playerId: GRIEZ_PID,    tier: Tier.Common, stamina: 80 }],
  [9n,  { playerId: DEMBELE_PID,  tier: Tier.Common, stamina: 50 }],
  [10n, { playerId: GIROUD_PID,   tier: Tier.Rare,   stamina: 50 }],
  [11n, { playerId: MBAPPE_PID,   tier: Tier.Unique, stamina: 50 }],
]);

// Lineup: matchday=1, wallet=0x1111..., formation=0 (4-3-3), cap=10(Mbappe), vice=7(Griezmann)
const LINEUP: Lineup = {
  matchday: 1,
  wallet: "0x1111111111111111111111111111111111111111",
  tokenIds: TOKEN_IDS,
  formation: 0,
  captainIdx: 10,
  viceIdx: 7,
  chipId: ChipId.None,
};

// Events map (by playerId). Mbappe absent → DNP.
function buildMainEvents(): Map<`0x${string}`, MatchEvents> {
  return new Map<`0x${string}`, MatchEvents>([
    // slot0 Maignan GK: 4 saves, cleanSheet, played60, 90min, stamina=80 (fresh)
    // raw = saves=min(4×0.5,5)=2 + cleanSheet(GK)=4 + played60=1 = 7.0
    // trait: ShotStopper saves×1.20 → delta=2×0.2=0.4; SweeperKeeper kp×1.10 → kp=0→delta=0
    //   trait = (7+0.4)/7 = 1.05714
    // stam=1.05 (fresh), country=1.2, formation(GK,WidePlay)=1.0
    // final = 7.0×1.0×1.05714×1.0×1.05×1.0×1.2×1.0 = 9.324
    [MAIGNAN_PID, {
      goals: 0, assists: 0, cleanSheet: true, tackles: 0, keyPasses: 0,
      saves: 4, penaltiesSaved: 0, manOfTheMatch: false, played60: true,
      yellowCards: 0, redCards: 0, ownGoals: 0, penaltiesMissed: 0,
      goalsConceded: 0, minutes: 90,
    }],

    // slot1 Pavard DEF: 1 tackle, cleanSheet, played60
    // raw = cleanSheet=4 + tackle=min(0.5,4)=0.5 + played60=1 = 5.5
    // trait: Wall cs×1.15 → delta=4×0.15=0.6; Aggressor tackles×1.10 → delta=0.5×0.10=0.05
    //   trait = (5.5+0.65)/5.5 = 1.11818
    // stam=1.0, country=1.2, formation(DEF,WidePlay)=1.05
    // final = 5.5×1.0×1.11818×1.0×1.0×1.0×1.2×1.05 = 7.749
    [PAVARD_PID, {
      goals: 0, assists: 0, cleanSheet: true, tackles: 1, keyPasses: 0,
      saves: 0, penaltiesSaved: 0, manOfTheMatch: false, played60: true,
      yellowCards: 0, redCards: 0, ownGoals: 0, penaltiesMissed: 0,
      goalsConceded: 0, minutes: 90,
    }],

    // slot2 Kounde DEF Rare: 1 keyPass, cleanSheet, played60
    // raw = cleanSheet=4 + keyPass=min(0.3,3)=0.3 + played60=1 = 5.3
    // trait: BallPlaying kp×1.25 → delta=0.3×0.25=0.075; Wall cs×1.15 → delta=4×0.15=0.6
    //   trait = (5.3+0.675)/5.3 = 1.12736
    // tier=1.05, stam=1.0, country=1.2, formation(DEF)=1.05
    // final = 5.3×1.05×1.12736×1.0×1.0×1.0×1.2×1.05 = 7.905
    [KOUNDE_PID, {
      goals: 0, assists: 0, cleanSheet: true, tackles: 0, keyPasses: 1,
      saves: 0, penaltiesSaved: 0, manOfTheMatch: false, played60: true,
      yellowCards: 0, redCards: 0, ownGoals: 0, penaltiesMissed: 0,
      goalsConceded: 0, minutes: 90,
    }],

    // slot3 Upamecano DEF: cleanSheet, played60
    // raw = cleanSheet=4 + played60=1 = 5.0
    // trait: Wall cs×1.15 → delta=4×0.15=0.6; Aggressor tackles×1.10 → tackles=0→delta=0
    //   trait = (5+0.6)/5 = 1.12
    // stam=1.0, country=1.2, formation(DEF)=1.05
    // final = 5.0×1.0×1.12×1.0×1.0×1.0×1.2×1.05 = 7.056
    [UPAMA_PID, {
      goals: 0, assists: 0, cleanSheet: true, tackles: 0, keyPasses: 0,
      saves: 0, penaltiesSaved: 0, manOfTheMatch: false, played60: true,
      yellowCards: 0, redCards: 0, ownGoals: 0, penaltiesMissed: 0,
      goalsConceded: 0, minutes: 90,
    }],

    // slot4 Theo DEF: 1 assist, played60, goalsConceded=1
    // raw = assists=3 + played60=1 + floor(1/2)×(-1)=0 = 4.0
    // trait: Wingback assists×1.20 → delta=3×0.20=0.6; BallPlaying kp×1.25 → kp=0→delta=0
    //   trait = (4+0.6)/4 = 1.15
    // stam=1.0, country=1.2, formation(DEF)=1.05
    // final = 4.0×1.0×1.15×1.0×1.0×1.0×1.2×1.05 = 5.796
    [THEO_PID, {
      goals: 0, assists: 1, cleanSheet: false, tackles: 0, keyPasses: 0,
      saves: 0, penaltiesSaved: 0, manOfTheMatch: false, played60: true,
      yellowCards: 0, redCards: 0, ownGoals: 0, penaltiesMissed: 0,
      goalsConceded: 1, minutes: 90,
    }],

    // slot5 Tchouameni MID: 2 tackles, played60
    // raw = tackles=min(2×0.5,4)=1.0 + played60=1 = 2.0
    // trait: Anchor cs×1.15 → cs=0→delta=0; BallWinner tackles×1.20 → delta=1.0×0.20=0.2
    //   trait = (2+0.2)/2 = 1.10
    // stam=1.0, country=1.2, formation(MID)=1.05
    // final = 2.0×1.0×1.10×1.0×1.0×1.0×1.2×1.05 = 2.772
    [TCHOU_PID, {
      goals: 0, assists: 0, cleanSheet: false, tackles: 2, keyPasses: 0,
      saves: 0, penaltiesSaved: 0, manOfTheMatch: false, played60: true,
      yellowCards: 0, redCards: 0, ownGoals: 0, penaltiesMissed: 0,
      goalsConceded: 0, minutes: 90,
    }],

    // slot6 Rabiot MID: 1 goal, 1 assist, played60
    // raw = goal×6=6 + assist×3=3 + played60=1 = 10.0
    // trait: BoxToBox all×1.10 → deltas: goals=6×0.1=0.6, assists=3×0.1=0.3
    //        Playmaker assists×1.25 → delta=3×0.25=0.75
    //   totalDelta=0.6+0.3+0.75=1.65 → trait=(10+1.65)/10=1.165
    // stam=1.0, country=1.2, formation(MID)=1.05
    // final = 10.0×1.0×1.165×1.0×1.0×1.0×1.2×1.05 = 14.679
    [RABIOT_PID, {
      goals: 1, assists: 1, cleanSheet: false, tackles: 0, keyPasses: 0,
      saves: 0, penaltiesSaved: 0, manOfTheMatch: false, played60: true,
      yellowCards: 0, redCards: 0, ownGoals: 0, penaltiesMissed: 0,
      goalsConceded: 0, minutes: 90,
    }],

    // slot7 Griezmann MID (VICE → CAPTAIN because Mbappe DNP): 2 assists, MOTM, played60, stamina=80
    // raw = assists=2×3=6 + MOTM=3 + played60=1 = 10.0
    // trait: Creator kp×1.30 → kp=0→delta=0; BoxToBox all×1.10 → assists=6×0.1=0.6
    //   trait = (10+0.6)/10 = 1.06
    // stam=1.05 (fresh), cap=2.0 (vice→captain, ChipId.None), country=1.2, formation(MID)=1.05
    // final = 10.0×1.0×1.06×1.0×1.05×2.0×1.2×1.05 = 28.0476
    [GRIEZ_PID, {
      goals: 0, assists: 2, cleanSheet: false, tackles: 0, keyPasses: 0,
      saves: 0, penaltiesSaved: 0, manOfTheMatch: true, played60: true,
      yellowCards: 0, redCards: 0, ownGoals: 0, penaltiesMissed: 0,
      goalsConceded: 0, minutes: 90,
    }],

    // slot8 Dembele FWD: 1 goal, played60
    // raw = goal×5=5 + played60=1 = 6.0
    // trait: Winger assists×1.20 → assists=0→delta=0; InsideForward goals×1.15+assists×1.15
    //   goals delta=5×0.15=0.75; assists=0→delta=0
    //   trait = (6+0.75)/6 = 1.125
    // stam=1.0, country=1.2, formation(FWD)=1.05
    // final = 6.0×1.0×1.125×1.0×1.0×1.0×1.2×1.05 = 8.505
    [DEMBELE_PID, {
      goals: 1, assists: 0, cleanSheet: false, tackles: 0, keyPasses: 0,
      saves: 0, penaltiesSaved: 0, manOfTheMatch: false, played60: true,
      yellowCards: 0, redCards: 0, ownGoals: 0, penaltiesMissed: 0,
      goalsConceded: 0, minutes: 90,
    }],

    // slot9 Giroud FWD Rare: 2 goals, played60
    // raw = goals=2×5=10 + played60=1 = 11.0
    // trait: TargetMan goals×1.20 → delta=10×0.20=2.0; Poacher goals×1.25 → delta=10×0.25=2.5
    //   totalDelta=4.5 → trait=(11+4.5)/11=1.40909
    // tier=1.05, stam=1.0, country=1.2, formation(FWD)=1.05
    // final = 11.0×1.05×1.40909×1.0×1.0×1.0×1.2×1.05 = 20.5065
    [GIROUD_PID, {
      goals: 2, assists: 0, cleanSheet: false, tackles: 0, keyPasses: 0,
      saves: 0, penaltiesSaved: 0, manOfTheMatch: false, played60: true,
      yellowCards: 0, redCards: 0, ownGoals: 0, penaltiesMissed: 0,
      goalsConceded: 0, minutes: 90,
    }],
    // Mbappe (MBAPPE_PID) intentionally ABSENT → DNP → all-zero events → 0 pts
  ]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeLineupScore", () => {
  it("returns 11 ScoredCards with correct wallet and total for France XI", () => {
    const result = computeLineupScore(LINEUP, buildMainEvents(), CARD_CTX);
    expect(result.wallet).toBe(LINEUP.wallet);
    expect(result.cards).toHaveLength(11);
    expect(result.total).toBeCloseTo(112.34, 1);
  });

  it("scores Maignan (GK, fresh stamina, clean sheet + 4 saves) correctly", () => {
    // raw=7.0, trait=1.05714, tier=1.0, stam=1.05, country=1.2, formation(GK,WidePlay)=1.0
    // final = 7.0 × 1.0 × 1.05714 × 1.0 × 1.05 × 1.0 × 1.2 × 1.0 = 9.324
    const result = computeLineupScore(LINEUP, buildMainEvents(), CARD_CTX);
    const maignan = result.cards[0];
    expect(maignan.raw).toBeCloseTo(7.0, 5);
    expect(maignan.final).toBeCloseTo(9.324, 2);
  });

  it("scores Kounde (DEF, Rare tier) with BallPlaying+Wall traits correctly", () => {
    // raw=5.3, trait=1.12736, tier=1.05, stam=1.0, country=1.2, formation(DEF,WidePlay)=1.05
    // final = 5.3 × 1.05 × 1.12736 × 1.2 × 1.05 = 7.905
    const result = computeLineupScore(LINEUP, buildMainEvents(), CARD_CTX);
    const kounde = result.cards[2];
    expect(kounde.raw).toBeCloseTo(5.3, 5);
    expect(kounde.final).toBeCloseTo(7.905, 2);
  });

  it("scores Giroud (FWD, Rare tier, 2 goals, TargetMan+Poacher stacked traits) correctly", () => {
    // raw=11.0, trait=(11+4.5)/11=1.40909, tier=1.05, stam=1.0, country=1.2, formation(FWD)=1.05
    // final = 11.0 × 1.05 × 1.40909 × 1.2 × 1.05 = 20.5065
    const result = computeLineupScore(LINEUP, buildMainEvents(), CARD_CTX);
    const giroud = result.cards[9];
    expect(giroud.raw).toBeCloseTo(11.0, 5);
    expect(giroud.final).toBeCloseTo(20.5065, 2);
  });

  it("promotes vice to captain when captain DNP (Mbappe absent → Griezmann gets ×2)", () => {
    // Mbappe absent from events map → DNP
    // Griezmann (vice, slot7) gets captainMult=2.0
    // raw=10.0, trait=1.06, stam=1.05 (fresh), cap=2.0, country=1.2, formation(MID)=1.05
    // final = 10.0 × 1.0 × 1.06 × 1.05 × 2.0 × 1.2 × 1.05 = 28.0476
    const result = computeLineupScore(LINEUP, buildMainEvents(), CARD_CTX);
    const griezmann = result.cards[7];
    expect(griezmann.final).toBeCloseTo(28.0476, 2);
  });

  it("scores captain at 0 when captain DNP (Mbappe: absent from events, Unique tier)", () => {
    // Mbappe is absent → ZERO_EVENTS → raw=0 → final=0 (any multiplier × 0 = 0)
    const result = computeLineupScore(LINEUP, buildMainEvents(), CARD_CTX);
    const mbappe = result.cards[10];
    expect(mbappe.raw).toBe(0);
    expect(mbappe.final).toBe(0);
  });

  it("any player absent from the events map scores exactly 0 (DNP → zero events)", () => {
    // Remove Giroud from events map → he DNPs
    const events = buildMainEvents();
    events.delete(GIROUD_PID);
    const result = computeLineupScore(LINEUP, events, CARD_CTX);
    const giroud = result.cards[9];
    expect(giroud.raw).toBe(0);
    expect(giroud.final).toBe(0);
  });

  it("captain DNP: vice gets captain mult (not original captain)", () => {
    // Explicit test: captain (slot10) has 0 minutes → vice (slot7) promoted
    const events = buildMainEvents();
    const result = computeLineupScore(LINEUP, events, CARD_CTX);
    // Griezmann (vice, now captain) final should be roughly double a non-captain
    // with same events and stam=1.05. Non-captain Griezmann would be ~14.0238.
    // With cap=2.0 → 28.0476
    const griezmann = result.cards[7];
    expect(griezmann.breakdown["cap"]).toBe(2);

    // Mbappe (original captain) should have cap=1 (or breakdown irrelevant at raw=0)
    const mbappe = result.cards[10];
    expect(mbappe.final).toBe(0);
  });

  it("returns per-card breakdown with all stacking factors", () => {
    const result = computeLineupScore(LINEUP, buildMainEvents(), CARD_CTX);
    for (const card of result.cards) {
      expect(card.breakdown).toHaveProperty("tier");
      expect(card.breakdown).toHaveProperty("trait");
      expect(card.breakdown).toHaveProperty("oop");
      expect(card.breakdown).toHaveProperty("stam");
      expect(card.breakdown).toHaveProperty("cap");
      expect(card.breakdown).toHaveProperty("country");
      expect(card.breakdown).toHaveProperty("formation");
    }
  });

  it("total equals sum of per-card final scores", () => {
    const result = computeLineupScore(LINEUP, buildMainEvents(), CARD_CTX);
    const summed = result.cards.reduce((acc, c) => acc + c.final, 0);
    expect(result.total).toBeCloseTo(summed, 10);
  });

  it("tokenId on each ScoredCard matches the lineup slot", () => {
    const result = computeLineupScore(LINEUP, buildMainEvents(), CARD_CTX);
    result.cards.forEach((card, i) => {
      expect(card.tokenId).toBe(TOKEN_IDS[i]);
    });
  });
});
