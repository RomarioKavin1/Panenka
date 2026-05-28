/**
 * TDD tests for formationSynergy (spec §4.3)
 *
 * Written BEFORE implementation.
 * Each of the 5 synergies gets:
 *   - one lineup that triggers it
 *   - one lineup that does NOT trigger it
 *   - asserts on `active` membership and `multForCard` per representative slot
 * Additional cases:
 *   - no-synergy lineup → every multForCard === 1.0
 *   - two synergies stacking with clamp engagement
 */

import { describe, it, expect } from "vitest";
import { formationSynergy } from "../synergy";
import type { FormationName, Position } from "@/lib/types";
import type { Trait } from "@/lib/data/traits";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a card stub */
const card = (
  position: Position,
  scoringPosition: Position,
  traits: Trait[],
) => ({ position, scoringPosition, traits });

/**
 * Build an 11-card lineup with a given formation.
 * Positions follow a typical 4-3-3: 1 GK, 4 DEF, 3 MID, 3 FWD.
 * Caller can override by providing an explicit array.
 */
const lineup433 = (traitOverrides: (Trait[])[] = []) => {
  // Default traits for each slot: empty
  const defaults: Array<{ pos: Position }> = [
    { pos: "GK" },
    { pos: "DEF" }, { pos: "DEF" }, { pos: "DEF" }, { pos: "DEF" },
    { pos: "MID" }, { pos: "MID" }, { pos: "MID" },
    { pos: "FWD" }, { pos: "FWD" }, { pos: "FWD" },
  ];
  return defaults.map((d, i) =>
    card(d.pos, d.pos, traitOverrides[i] ?? []),
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 0) No-synergy baseline
// ─────────────────────────────────────────────────────────────────────────────
describe("no-synergy lineup", () => {
  it("every multForCard === 1.0 (no formation-based synergies active)", () => {
    const cards = lineup433(); // no traits, 4-3-3
    const result = formationSynergy({ formation: "4-4-2", cards });
    expect(result.active).toHaveLength(0);
    for (let i = 0; i < cards.length; i++) {
      expect(result.multForCard(i)).toBe(1.0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1) WidePlay
//    formation ∈ {"4-3-3","3-4-3"} AND ≥2 cards have Winger or Wingback trait
//    → DEF/MID/FWD get 1.05, GK 1.0
// ─────────────────────────────────────────────────────────────────────────────
describe("WidePlay synergy", () => {
  it("TRIGGERS: 4-3-3 + 2 Winger cards", () => {
    const traits: (Trait[])[] = [
      [],                    // GK (idx 0)
      [], [], [], [],        // DEF (idx 1-4)
      [], [], [],            // MID (idx 5-7)
      ["Winger"], ["Winger"], [], // FWD (idx 8-10): two Wingers
    ];
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-3-3", cards });

    expect(result.active).toContain("WidePlay");

    // GK → 1.0
    expect(result.multForCard(0)).toBeCloseTo(1.0);
    // DEF → 1.05
    expect(result.multForCard(1)).toBeCloseTo(1.05);
    // MID → 1.05
    expect(result.multForCard(5)).toBeCloseTo(1.05);
    // FWD → 1.05
    expect(result.multForCard(8)).toBeCloseTo(1.05);
  });

  it("TRIGGERS: 3-4-3 + 2 Wingback cards", () => {
    // 3-4-3: 1 GK, 3 DEF, 4 MID, 3 FWD
    const cards3_4_3 = [
      card("GK",  "GK",  []),
      card("DEF", "DEF", []),
      card("DEF", "DEF", ["Wingback"]),
      card("DEF", "DEF", ["Wingback"]),
      card("MID", "MID", []),
      card("MID", "MID", []),
      card("MID", "MID", []),
      card("MID", "MID", []),
      card("FWD", "FWD", []),
      card("FWD", "FWD", []),
      card("FWD", "FWD", []),
    ];
    const result = formationSynergy({ formation: "3-4-3", cards: cards3_4_3 });
    expect(result.active).toContain("WidePlay");
    expect(result.multForCard(0)).toBeCloseTo(1.0);  // GK
    expect(result.multForCard(1)).toBeCloseTo(1.05); // DEF
    expect(result.multForCard(4)).toBeCloseTo(1.05); // MID
    expect(result.multForCard(8)).toBeCloseTo(1.05); // FWD
  });

  it("does NOT trigger: 4-4-2 + 2 Wingers (wrong formation)", () => {
    const traits: (Trait[])[] = Array.from({ length: 11 }, (_, i) =>
      i >= 8 ? ["Winger"] : [],
    );
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-4-2", cards });
    expect(result.active).not.toContain("WidePlay");
    expect(result.multForCard(1)).toBe(1.0); // DEF
  });

  it("does NOT trigger: 4-3-3 + only 1 Winger (insufficient trait count)", () => {
    const traits: (Trait[])[] = Array.from({ length: 11 }, (_, i) =>
      i === 8 ? ["Winger"] : [], // only one Winger
    );
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-3-3", cards });
    expect(result.active).not.toContain("WidePlay");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) IronWall
//    formation ∈ {"5-3-2"} AND ≥3 Wall traits
//    → DEF/GK get 1.10, others 1.0
// ─────────────────────────────────────────────────────────────────────────────
describe("IronWall synergy", () => {
  it("TRIGGERS: 5-3-2 + 3 Wall cards", () => {
    // 5-3-2: 1 GK, 5 DEF, 3 MID, 2 FWD
    const cards5_3_2 = [
      card("GK",  "GK",  []),
      card("DEF", "DEF", ["Wall"]),
      card("DEF", "DEF", ["Wall"]),
      card("DEF", "DEF", ["Wall"]),
      card("DEF", "DEF", []),
      card("DEF", "DEF", []),
      card("MID", "MID", []),
      card("MID", "MID", []),
      card("MID", "MID", []),
      card("FWD", "FWD", []),
      card("FWD", "FWD", []),
    ];
    const result = formationSynergy({ formation: "5-3-2", cards: cards5_3_2 });
    expect(result.active).toContain("IronWall");

    // GK → 1.10
    expect(result.multForCard(0)).toBeCloseTo(1.10);
    // DEF → 1.10
    expect(result.multForCard(1)).toBeCloseTo(1.10);
    // MID → 1.0
    expect(result.multForCard(6)).toBeCloseTo(1.0);
    // FWD → 1.0
    expect(result.multForCard(9)).toBeCloseTo(1.0);
  });

  it("does NOT trigger: 4-3-3 + 3 Wall traits (wrong formation)", () => {
    const traits: (Trait[])[] = [
      [],
      ["Wall"], ["Wall"], ["Wall"], [],
      [], [], [],
      [], [], [],
    ];
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-3-3", cards });
    expect(result.active).not.toContain("IronWall");
  });

  it("does NOT trigger: 5-3-2 + only 2 Wall traits (insufficient count)", () => {
    const cards5_3_2 = [
      card("GK",  "GK",  []),
      card("DEF", "DEF", ["Wall"]),
      card("DEF", "DEF", ["Wall"]),
      card("DEF", "DEF", []),
      card("DEF", "DEF", []),
      card("DEF", "DEF", []),
      card("MID", "MID", []),
      card("MID", "MID", []),
      card("MID", "MID", []),
      card("FWD", "FWD", []),
      card("FWD", "FWD", []),
    ];
    const result = formationSynergy({ formation: "5-3-2", cards: cards5_3_2 });
    expect(result.active).not.toContain("IronWall");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) TikiTaka
//    formation ∈ {"4-3-3","3-5-2"} AND ≥3 cards with Playmaker or Creator
//    → MID gets 1.08, others 1.0
// ─────────────────────────────────────────────────────────────────────────────
describe("TikiTaka synergy", () => {
  it("TRIGGERS: 4-3-3 + 3 Playmaker/Creator cards", () => {
    const traits: (Trait[])[] = [
      [],
      [], [], [], [],
      ["Playmaker"], ["Creator"], ["Playmaker"], // 3 eligible MID
      [], [], [],
    ];
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-3-3", cards });
    expect(result.active).toContain("TikiTaka");

    // GK → 1.0
    expect(result.multForCard(0)).toBeCloseTo(1.0);
    // DEF → 1.0
    expect(result.multForCard(1)).toBeCloseTo(1.0);
    // MID → 1.08
    expect(result.multForCard(5)).toBeCloseTo(1.08);
    // FWD → 1.0
    expect(result.multForCard(8)).toBeCloseTo(1.0);
  });

  it("TRIGGERS: 3-5-2 + 3 Creator cards", () => {
    // 3-5-2: 1 GK, 3 DEF, 5 MID, 2 FWD
    const cards3_5_2 = [
      card("GK",  "GK",  []),
      card("DEF", "DEF", []),
      card("DEF", "DEF", []),
      card("DEF", "DEF", []),
      card("MID", "MID", ["Creator"]),
      card("MID", "MID", ["Creator"]),
      card("MID", "MID", ["Creator"]),
      card("MID", "MID", []),
      card("MID", "MID", []),
      card("FWD", "FWD", []),
      card("FWD", "FWD", []),
    ];
    const result = formationSynergy({ formation: "3-5-2", cards: cards3_5_2 });
    expect(result.active).toContain("TikiTaka");
    expect(result.multForCard(4)).toBeCloseTo(1.08); // MID
    expect(result.multForCard(9)).toBeCloseTo(1.0);  // FWD
  });

  it("does NOT trigger: 4-4-2 + 3 Playmakers (wrong formation)", () => {
    const traits: (Trait[])[] = Array.from({ length: 11 }, (_, i) =>
      i >= 5 && i <= 7 ? ["Playmaker"] : [],
    );
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-4-2", cards });
    expect(result.active).not.toContain("TikiTaka");
  });

  it("does NOT trigger: 4-3-3 + only 2 Playmakers (insufficient count)", () => {
    const traits: (Trait[])[] = [
      [],
      [], [], [], [],
      ["Playmaker"], ["Creator"], [], // only 2
      [], [], [],
    ];
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-3-3", cards });
    expect(result.active).not.toContain("TikiTaka");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) CounterAttack
//    ≥2 Poacher AND ≥2 BallWinner (any formation)
//    → FWD gets 1.12, others 1.0
// ─────────────────────────────────────────────────────────────────────────────
describe("CounterAttack synergy", () => {
  it("TRIGGERS: 2 Poacher + 2 BallWinner on any formation", () => {
    const traits: (Trait[])[] = [
      [],
      [], [], [], [],
      ["BallWinner"], ["BallWinner"], [],    // 2 BallWinner in MID
      ["Poacher"], ["Poacher"], [],           // 2 Poacher in FWD
    ];
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-4-2", cards });
    expect(result.active).toContain("CounterAttack");

    // GK → 1.0
    expect(result.multForCard(0)).toBeCloseTo(1.0);
    // DEF → 1.0
    expect(result.multForCard(1)).toBeCloseTo(1.0);
    // MID → 1.0
    expect(result.multForCard(5)).toBeCloseTo(1.0);
    // FWD → 1.12
    expect(result.multForCard(8)).toBeCloseTo(1.12);
    expect(result.multForCard(9)).toBeCloseTo(1.12);
    // FWD without Poacher but still FWD → still 1.12 (position-based)
    expect(result.multForCard(10)).toBeCloseTo(1.12);
  });

  it("does NOT trigger: only 1 Poacher + 2 BallWinner", () => {
    const traits: (Trait[])[] = [
      [],
      [], [], [], [],
      ["BallWinner"], ["BallWinner"], [],
      ["Poacher"], [], [],  // only 1 Poacher
    ];
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-3-3", cards });
    expect(result.active).not.toContain("CounterAttack");
  });

  it("does NOT trigger: 2 Poacher + only 1 BallWinner", () => {
    const traits: (Trait[])[] = [
      [],
      [], [], [], [],
      ["BallWinner"], [], [],  // only 1 BallWinner
      ["Poacher"], ["Poacher"], [],
    ];
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-3-3", cards });
    expect(result.active).not.toContain("CounterAttack");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5) BrickDefense
//    ≥5 cards with Wall or SweeperKeeper
//    → DEF/GK 1.15, FWD/MID 0.95
// ─────────────────────────────────────────────────────────────────────────────
describe("BrickDefense synergy", () => {
  it("TRIGGERS: 5 cards with Wall/SweeperKeeper", () => {
    const traits: (Trait[])[] = [
      ["SweeperKeeper"],         // GK idx 0 → counts (1)
      ["Wall"], ["Wall"], ["Wall"], ["Wall"], // DEF idx 1-4 → counts 4 more (total 5)
      [], [], [],
      [], [], [],
    ];
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-3-3", cards });
    expect(result.active).toContain("BrickDefense");

    // GK → 1.15
    expect(result.multForCard(0)).toBeCloseTo(1.15);
    // DEF → 1.15
    expect(result.multForCard(1)).toBeCloseTo(1.15);
    // MID → 0.95
    expect(result.multForCard(5)).toBeCloseTo(0.95);
    // FWD → 0.95
    expect(result.multForCard(8)).toBeCloseTo(0.95);
  });

  it("does NOT trigger: only 4 cards with Wall/SweeperKeeper", () => {
    const traits: (Trait[])[] = [
      ["SweeperKeeper"],         // GK → 1
      ["Wall"], ["Wall"], ["Wall"], [], // DEF → 3, total 4
      [], [], [],
      [], [], [],
    ];
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-3-3", cards });
    expect(result.active).not.toContain("BrickDefense");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6) Stacking & clamp
//    IronWall (GK/DEF 1.10) + BrickDefense (GK/DEF 1.15, MID/FWD 0.95)
//    → raw product for GK/DEF = 1.10 × 1.15 = 1.265, clamped to 1.15
//    → raw product for MID/FWD = 0.95, within [0.95, 1.15] → stays 0.95
// ─────────────────────────────────────────────────────────────────────────────
describe("stacking + clamp", () => {
  it("IronWall + BrickDefense: GK/DEF clamped to 1.15, MID/FWD = 0.95", () => {
    // 5-3-2 with ≥3 Wall + ≥5 Wall/SweeperKeeper
    const cards5_3_2 = [
      card("GK",  "GK",  ["SweeperKeeper"]), // GK: counts for BrickDefense (1)
      card("DEF", "DEF", ["Wall"]),           // DEF: Wall → IronWall trigger + BrickDef (2)
      card("DEF", "DEF", ["Wall"]),           // (3)
      card("DEF", "DEF", ["Wall"]),           // (4) → IronWall triggers (3 Walls)
      card("DEF", "DEF", ["Wall"]),           // (5) → BrickDefense triggers (5 Wall/SK)
      card("DEF", "DEF", []),
      card("MID", "MID", []),
      card("MID", "MID", []),
      card("MID", "MID", []),
      card("FWD", "FWD", []),
      card("FWD", "FWD", []),
    ];
    const result = formationSynergy({ formation: "5-3-2", cards: cards5_3_2 });

    expect(result.active).toContain("IronWall");
    expect(result.active).toContain("BrickDefense");

    // GK: IronWall(1.10) × BrickDefense(1.15) = 1.265 → clamped to 1.15
    expect(result.multForCard(0)).toBeCloseTo(1.15);
    // DEF: same → 1.15 (clamped)
    expect(result.multForCard(1)).toBeCloseTo(1.15);
    // DEF without Wall (idx 5): IronWall(1.10) × BrickDefense(1.15) = 1.265 → clamped 1.15
    expect(result.multForCard(5)).toBeCloseTo(1.15);
    // MID: IronWall(1.0) × BrickDefense(0.95) = 0.95 → within clamp → 0.95
    expect(result.multForCard(6)).toBeCloseTo(0.95);
    // FWD: IronWall(1.0) × BrickDefense(0.95) = 0.95 → within clamp → 0.95
    expect(result.multForCard(9)).toBeCloseTo(0.95);
  });

  it("WidePlay + TikiTaka: MID gets 1.05 × 1.08 = 1.134 (within cap)", () => {
    // 4-3-3 with ≥2 Winger/Wingback + ≥3 Playmaker/Creator
    const traits: (Trait[])[] = [
      [],
      [], [], [], [],
      ["Playmaker", "Wingback"], ["Creator", "Winger"], ["Playmaker"], // MID: 3 PK/Creator, 2 Winger/Wingback
      [], [], [],
    ];
    const cards = lineup433(traits);
    const result = formationSynergy({ formation: "4-3-3", cards });

    expect(result.active).toContain("WidePlay");
    expect(result.active).toContain("TikiTaka");

    // MID: WidePlay(1.05) × TikiTaka(1.08) = 1.134, within [0.95, 1.15]
    expect(result.multForCard(5)).toBeCloseTo(1.05 * 1.08);
    // GK: WidePlay(1.0) × TikiTaka(1.0) = 1.0
    expect(result.multForCard(0)).toBeCloseTo(1.0);
    // DEF: WidePlay(1.05) × TikiTaka(1.0) = 1.05
    expect(result.multForCard(1)).toBeCloseTo(1.05);
    // FWD: WidePlay(1.05) × TikiTaka(1.0) = 1.05
    expect(result.multForCard(8)).toBeCloseTo(1.05);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7) scoringPosition is used (not position) for the mult lookup
// ─────────────────────────────────────────────────────────────────────────────
describe("scoringPosition takes precedence over position", () => {
  it("DEF playing as FWD (scoringPosition=FWD): IronWall gives 1.0 (not 1.10)", () => {
    // A DEF card whose scoringPosition is FWD should NOT get the IronWall DEF boost
    const cards5_3_2 = [
      card("GK",  "GK",  []),
      card("DEF", "FWD", ["Wall"]), // scoringPosition = FWD
      card("DEF", "DEF", ["Wall"]),
      card("DEF", "DEF", ["Wall"]),
      card("DEF", "DEF", []),
      card("DEF", "DEF", []),
      card("MID", "MID", []),
      card("MID", "MID", []),
      card("MID", "MID", []),
      card("FWD", "FWD", []),
      card("FWD", "FWD", []),
    ];
    const result = formationSynergy({ formation: "5-3-2", cards: cards5_3_2 });
    expect(result.active).toContain("IronWall");
    // scoringPosition is FWD → IronWall gives FWD 1.0
    expect(result.multForCard(1)).toBeCloseTo(1.0);
    // scoringPosition is DEF → IronWall gives DEF 1.10
    expect(result.multForCard(2)).toBeCloseTo(1.10);
  });
});
