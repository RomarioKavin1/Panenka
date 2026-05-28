import { describe, it, expect } from "vitest";
import { eventPointBreakdown, traitModifier } from "../synergy";
import { baseEventPoints } from "../scoring";
import type { MatchEvents } from "@/lib/types";

// Helper: build a full MatchEvents with sensible defaults (played 90 min, played60=true)
const ev = (p: Partial<MatchEvents>): MatchEvents => ({
  goals: 0,
  assists: 0,
  cleanSheet: false,
  tackles: 0,
  keyPasses: 0,
  saves: 0,
  penaltiesSaved: 0,
  manOfTheMatch: false,
  played60: true,
  yellowCards: 0,
  redCards: 0,
  ownGoals: 0,
  penaltiesMissed: 0,
  goalsConceded: 0,
  minutes: 90,
  ...p,
});

// ─────────────────────────────────────────────────────────────────────────────
// 1) Breakdown matches the engine's category points (real SCORE_* values)
// ─────────────────────────────────────────────────────────────────────────────
describe("eventPointBreakdown", () => {
  it("FWD 1 goal → goals=5 (SCORE_GOAL[FWD]=5)", () => {
    const bd = eventPointBreakdown("FWD", ev({ goals: 1 }));
    expect(bd.goals).toBe(5);
  });

  it("MID 2 goals → goals=12 (SCORE_GOAL[MID]=6)", () => {
    const bd = eventPointBreakdown("MID", ev({ goals: 2 }));
    expect(bd.goals).toBe(12);
  });

  it("DEF 1 goal → goals=8 (SCORE_GOAL[DEF]=8)", () => {
    const bd = eventPointBreakdown("DEF", ev({ goals: 1 }));
    expect(bd.goals).toBe(8);
  });

  it("GK 1 goal → goals=10 (SCORE_GOAL[GK]=10)", () => {
    const bd = eventPointBreakdown("GK", ev({ goals: 1 }));
    expect(bd.goals).toBe(10);
  });

  it("1 assist → assists=3 (SCORE_ASSIST=3)", () => {
    const bd = eventPointBreakdown("FWD", ev({ assists: 1 }));
    expect(bd.assists).toBe(3);
  });

  it("DEF clean sheet → cleanSheet=4 (SCORE_CLEAN_SHEET[DEF]=4)", () => {
    const bd = eventPointBreakdown("DEF", ev({ cleanSheet: true }));
    expect(bd.cleanSheet).toBe(4);
  });

  it("GK clean sheet → cleanSheet=4 (SCORE_CLEAN_SHEET[GK]=4)", () => {
    const bd = eventPointBreakdown("GK", ev({ cleanSheet: true }));
    expect(bd.cleanSheet).toBe(4);
  });

  it("MID clean sheet → cleanSheet=1 (SCORE_CLEAN_SHEET[MID]=1)", () => {
    const bd = eventPointBreakdown("MID", ev({ cleanSheet: true }));
    expect(bd.cleanSheet).toBe(1);
  });

  it("FWD clean sheet → cleanSheet=0 (SCORE_CLEAN_SHEET[FWD]=0)", () => {
    const bd = eventPointBreakdown("FWD", ev({ cleanSheet: true }));
    expect(bd.cleanSheet).toBe(0);
  });

  it("DEF 4 tackles → tackles=2 (4*0.5, cap 4)", () => {
    // 4 * 0.5 = 2, which is under cap of 4
    const bd = eventPointBreakdown("DEF", ev({ tackles: 4 }));
    expect(bd.tackles).toBe(2);
  });

  it("DEF 10 tackles → tackles=4 (capped at SCORE_TACKLE_CAP=4)", () => {
    const bd = eventPointBreakdown("DEF", ev({ tackles: 10 }));
    expect(bd.tackles).toBe(4);
  });

  it("GK tackles → tackles=0 (GK excluded from tackles)", () => {
    const bd = eventPointBreakdown("GK", ev({ tackles: 5 }));
    expect(bd.tackles).toBe(0);
  });

  it("MID 5 keyPasses → keyPasses=1.5 (5*0.3=1.5, under cap 3)", () => {
    const bd = eventPointBreakdown("MID", ev({ keyPasses: 5 }));
    expect(bd.keyPasses).toBeCloseTo(1.5);
  });

  it("MID 15 keyPasses → keyPasses=3 (capped at SCORE_KEY_PASS_CAP=3)", () => {
    const bd = eventPointBreakdown("MID", ev({ keyPasses: 15 }));
    expect(bd.keyPasses).toBe(3);
  });

  it("GK keyPasses → keyPasses=0 (GK excluded from keyPasses)", () => {
    const bd = eventPointBreakdown("GK", ev({ keyPasses: 5 }));
    expect(bd.keyPasses).toBe(0);
  });

  it("GK 6 saves → saves=3 (6*0.5=3, under cap 5)", () => {
    const bd = eventPointBreakdown("GK", ev({ saves: 6 }));
    expect(bd.saves).toBe(3);
  });

  it("GK 12 saves → saves=5 (capped at SCORE_SAVE_CAP=5)", () => {
    const bd = eventPointBreakdown("GK", ev({ saves: 12 }));
    expect(bd.saves).toBe(5);
  });

  it("FWD saves → saves=0 (non-GK excluded from saves)", () => {
    const bd = eventPointBreakdown("FWD", ev({ saves: 5 }));
    expect(bd.saves).toBe(0);
  });

  it("GK 1 penalty saved → penaltiesSaved=5 (SCORE_PEN_SAVED=5)", () => {
    const bd = eventPointBreakdown("GK", ev({ penaltiesSaved: 1 }));
    expect(bd.penaltiesSaved).toBe(5);
  });

  it("FWD penaltiesSaved → penaltiesSaved=0 (non-GK excluded)", () => {
    const bd = eventPointBreakdown("FWD", ev({ penaltiesSaved: 1 }));
    expect(bd.penaltiesSaved).toBe(0);
  });

  it("MOTM folds into base (base includes +3)", () => {
    // played60=true gives +1, MOTM gives +3, base=4 total for a played-only FWD
    const bd = eventPointBreakdown("FWD", ev({ manOfTheMatch: true }));
    expect(bd.base).toBe(4); // 1 (played60) + 3 (MOTM)
  });

  it("yellow card folds into base (base -1)", () => {
    // played60=true → +1, yellow → -1, net base = 0
    const bd = eventPointBreakdown("FWD", ev({ yellowCards: 1 }));
    expect(bd.base).toBe(0);
  });

  it("red card folds into base (base -3+1=-2)", () => {
    const bd = eventPointBreakdown("FWD", ev({ redCards: 1 }));
    expect(bd.base).toBe(-2); // played60 +1, red -3
  });

  it("own goal folds into base (base -2+1=-1)", () => {
    const bd = eventPointBreakdown("FWD", ev({ ownGoals: 1 }));
    expect(bd.base).toBe(-1); // played60 +1, own goal -2
  });

  it("penaltyMissed folds into base (base -2+1=-1)", () => {
    const bd = eventPointBreakdown("FWD", ev({ penaltiesMissed: 1 }));
    expect(bd.base).toBe(-1);
  });

  it("DEF/GK goalsConceded folds into base (2 conceded → -1)", () => {
    const bd = eventPointBreakdown("DEF", ev({ goalsConceded: 2 }));
    expect(bd.base).toBe(0); // played60 +1, 2 conceded -1
  });

  it("FWD goalsConceded not penalised (base stays +1)", () => {
    const bd = eventPointBreakdown("FWD", ev({ goalsConceded: 2 }));
    expect(bd.base).toBe(1); // played60 +1, no conceded penalty for FWD
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) traitModifier: Poacher on a goalscorer
// ─────────────────────────────────────────────────────────────────────────────
describe("traitModifier: Poacher (goals ×1.25)", () => {
  it("FWD 1 goal, played60: traitModifier > 1", () => {
    // base = goals(5) + played60(1) = 6
    // boosted goals = 5 * 1.25 = 6.25; adjusted = 6.25 + 1(base) = 7.25
    // modifier = 7.25 / 6 ≈ 1.2083...
    const events = ev({ goals: 1 });
    const base = baseEventPoints("FWD", events);
    const mod = traitModifier("FWD", ["Poacher"], events);
    expect(base).toBe(6);
    expect(mod).toBeCloseTo(7.25 / 6, 8);
  });

  it("FWD 2 goals, played60: traitModifier correct", () => {
    // base = 10 + 1 = 11
    // boosted goals = 10*1.25 = 12.5; adjusted = 12.5 + 1 = 13.5
    // modifier = 13.5 / 11 ≈ 1.2272...
    const events = ev({ goals: 2 });
    const mod = traitModifier("FWD", ["Poacher"], events);
    expect(mod).toBeCloseTo(13.5 / 11, 8);
  });

  it("FWD no goals: Poacher gives modifier=1 (no goal contribution to boost)", () => {
    // base=1 (played60), goals=0 so boost=0 delta
    // adjusted = 1; modifier = 1/1 = 1
    const events = ev({ goals: 0 });
    const mod = traitModifier("FWD", ["Poacher"], events);
    expect(mod).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) traitModifier returns 1 when baseEventPoints === 0 (DNP guard)
// ─────────────────────────────────────────────────────────────────────────────
describe("traitModifier: base ≤ 0 guard", () => {
  it("returns 1 when DNP (played60=false, no events)", () => {
    const events = ev({ played60: false });
    expect(baseEventPoints("FWD", events)).toBe(0);
    expect(traitModifier("FWD", ["Poacher"], events)).toBe(1);
  });

  it("returns 1 when basePoints < 0 (e.g. red card only)", () => {
    // played60=false, red card → -3
    const events = ev({ played60: false, redCards: 1 });
    expect(baseEventPoints("FWD", events)).toBe(-3);
    expect(traitModifier("FWD", ["Poacher"], events)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) INVARIANT: sum(eventPointBreakdown values) === baseEventPoints for many inputs
// ─────────────────────────────────────────────────────────────────────────────
describe("INVARIANT: breakdown sum === baseEventPoints", () => {
  const positions = ["GK", "DEF", "MID", "FWD"] as const;

  // Test vectors: {label, position, partial events}
  const vectors: Array<{ label: string; pos: typeof positions[number]; events: MatchEvents }> = [
    { label: "FWD average game", pos: "FWD", events: ev({ goals: 1, assists: 1, keyPasses: 3, played60: true, yellowCards: 0 }) },
    { label: "FWD DNP", pos: "FWD", events: ev({ played60: false, minutes: 10 }) },
    { label: "MID playmaker", pos: "MID", events: ev({ goals: 0, assists: 2, keyPasses: 8, tackles: 3, cleanSheet: true }) },
    { label: "DEF solid", pos: "DEF", events: ev({ cleanSheet: true, tackles: 6, goalsConceded: 0 }) },
    { label: "DEF nightmare", pos: "DEF", events: ev({ cleanSheet: false, goalsConceded: 4, yellowCards: 1, ownGoals: 1 }) },
    { label: "GK clean sheet + saves", pos: "GK", events: ev({ cleanSheet: true, saves: 8, penaltiesSaved: 1 }) },
    { label: "GK busy", pos: "GK", events: ev({ saves: 14, goalsConceded: 3, yellowCards: 1, manOfTheMatch: true }) },
    { label: "FWD MOTM + red", pos: "FWD", events: ev({ goals: 2, manOfTheMatch: true, redCards: 1 }) },
    { label: "MID hat trick + MOTM", pos: "MID", events: ev({ goals: 3, assists: 1, manOfTheMatch: true, penaltiesMissed: 1 }) },
    { label: "DEF GK confusion (DEF plays GK role in data)", pos: "DEF", events: ev({ tackles: 8, keyPasses: 10, cleanSheet: true, goalsConceded: 2 }) },
  ];

  for (const { label, pos, events } of vectors) {
    it(`invariant: ${label}`, () => {
      const bd = eventPointBreakdown(pos, events);
      const expected = baseEventPoints(pos, events);
      const actual = Object.values(bd).reduce((a, b) => a + b, 0);
      expect(actual).toBeCloseTo(expected, 8);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5) Multi-trait composition
// ─────────────────────────────────────────────────────────────────────────────
describe("traitModifier: multi-trait and special categories", () => {
  it("InsideForward (goals×1.15 AND assists×1.15) on FWD 1G+1A", () => {
    // base = 5(goal) + 3(assist) + 1(played60) = 9
    // boosted goals = 5*1.15=5.75, boosted assists = 3*1.15=3.45
    // adjusted = 5.75 + 3.45 + 1(base) = 10.2
    // modifier = 10.2 / 9
    const events = ev({ goals: 1, assists: 1 });
    const mod = traitModifier("FWD", ["InsideForward"], events);
    expect(mod).toBeCloseTo(10.2 / 9, 6);
  });

  it("False9 (attacking×1.15: goals+assists+keyPasses) on FWD 1G+1A+5KP", () => {
    // goals=5, assists=3, keyPasses=min(5*0.3,3)=1.5, played60=1
    // base = 5+3+1.5+1 = 10.5
    // boosted: goals=5*1.15=5.75, assists=3*1.15=3.45, keyPasses=1.5*1.15=1.725
    // adjusted = 5.75+3.45+1.725+1(base) = 11.925
    // modifier = 11.925/10.5
    const events = ev({ goals: 1, assists: 1, keyPasses: 5 });
    const base = baseEventPoints("FWD", events);
    expect(base).toBeCloseTo(10.5, 8);
    const mod = traitModifier("FWD", ["False9"], events);
    expect(mod).toBeCloseTo(11.925 / 10.5, 6);
  });

  it("BoxToBox (all×1.10) on MID with goals+assists+keyPasses+tackles", () => {
    // goals=6, assists=3, keyPasses=min(5*0.3,3)=1.5, tackles=min(4*0.5,4)=2, played60=1
    // base = 6+3+1.5+2+1 = 13.5
    // all boosts every positive category: goals=6*1.1=6.6, assists=3*1.1=3.3, keyPasses=1.5*1.1=1.65, tackles=2*1.1=2.2
    // adjusted = 6.6+3.3+1.65+2.2+1(base) = 14.75
    // modifier = 14.75/13.5
    const events = ev({ goals: 1, assists: 1, keyPasses: 5, tackles: 4 });
    const base = baseEventPoints("MID", events);
    expect(base).toBeCloseTo(13.5, 8);
    const mod = traitModifier("MID", ["BoxToBox"], events);
    expect(mod).toBeCloseTo(14.75 / 13.5, 6);
  });

  it("Poacher + InsideForward on FWD 1G+1A: goals boosted by product of 1.25*1.15", () => {
    // Composition rule: when two traits both touch 'goals', apply BOTH multipliers (sum-of-deltas):
    // goals=5: delta_Poacher=(1.25-1)*5=1.25, delta_InsideForward=(1.15-1)*5=0.75
    // assists=3: delta_InsideForward=(1.15-1)*3=0.45
    // base=1 (played60)
    // adjusted = 5+1.25+0.75 + 3+0.45 + 1 = 11.45; base=9
    // modifier = 11.45/9
    const events = ev({ goals: 1, assists: 1 });
    const base = baseEventPoints("FWD", events);
    expect(base).toBe(9);
    const mod = traitModifier("FWD", ["Poacher", "InsideForward"], events);
    expect(mod).toBeCloseTo(11.45 / 9, 6);
  });

  it("ShotStopper (saves×1.20) on GK 6 saves", () => {
    // saves = min(6*0.5, 5) = 3
    // base = 3 + 1(played60) = 4
    // boosted saves = 3*1.20=3.6; adjusted = 3.6+1 = 4.6
    // modifier = 4.6/4 = 1.15
    const events = ev({ saves: 6 });
    const mod = traitModifier("GK", ["ShotStopper"], events);
    expect(mod).toBeCloseTo(4.6 / 4, 6);
  });

  it("no traits → modifier always 1", () => {
    const events = ev({ goals: 2, assists: 1, cleanSheet: true });
    const mod = traitModifier("FWD", [], events);
    expect(mod).toBe(1);
  });
});
