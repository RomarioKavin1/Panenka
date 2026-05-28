/**
 * TDD tests for previewLineup (Task 6.1)
 *
 * Each test asserts parity: preview output == direct function output.
 * Written BEFORE implementation.
 */

import { describe, it, expect } from "vitest";
import { previewLineup } from "../synergyPreview";
import type { PreviewCard, PreviewInput } from "../synergyPreview";
import { formationSynergy } from "../synergy";
import { countrySynergyMult } from "../scoring";
import { nationCounts } from "../lineup";
import { STAMINA } from "@/lib/constants";
import type { Trait } from "@/lib/data/traits";
import type { Position } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a PreviewCard with defaults */
function makeCard(overrides: Partial<PreviewCard> & { nation: string }): PreviewCard {
  return {
    playerId: "0x0000000000000000000000000000000000000000000000000000000000000001",
    naturalPosition: "MID",
    scoringPosition: "MID",
    traits: [],
    stamina: 50, // "Normal" range
    ...overrides,
  };
}

/**
 * Build 11 cards for a 4-3-3 shape:
 * 1 GK, 4 DEF, 3 MID, 3 FWD — all same nation by default, stamina 50 ("Normal")
 */
function lineup433(overrides: Partial<PreviewCard>[] = []): PreviewCard[] {
  const slots: Array<{ pos: Position }> = [
    { pos: "GK" },
    { pos: "DEF" }, { pos: "DEF" }, { pos: "DEF" }, { pos: "DEF" },
    { pos: "MID" }, { pos: "MID" }, { pos: "MID" },
    { pos: "FWD" }, { pos: "FWD" }, { pos: "FWD" },
  ];
  return slots.map((s, i) =>
    makeCard({
      naturalPosition: s.pos,
      scoringPosition: s.pos,
      nation: "FRA",
      ...(overrides[i] ?? {}),
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Formation synergy parity — TikiTaka
// ─────────────────────────────────────────────────────────────────────────────
describe("previewLineup — TikiTaka formation synergy parity", () => {
  it("activeSynergies includes TikiTaka and formationMultForCard matches formationSynergy directly", () => {
    const traitOverrides: Partial<PreviewCard>[] = Array.from({ length: 11 }, (_, i) => {
      if (i === 5) return { traits: ["Playmaker"] as Trait[] };
      if (i === 6) return { traits: ["Creator"] as Trait[] };
      if (i === 7) return { traits: ["Playmaker"] as Trait[] };
      return {};
    });
    const cards = lineup433(traitOverrides);
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 8, viceIdx: 9, cards };

    const result = previewLineup(input);

    // Parity: call formationSynergy directly with the same cards
    const directSynergy = formationSynergy({
      formation: "4-3-3",
      cards: cards.map((c) => ({
        position: c.naturalPosition,
        scoringPosition: c.scoringPosition,
        traits: c.traits,
      })),
    });

    // activeSynergies must include TikiTaka
    expect(result.activeSynergies).toContain("TikiTaka");

    // activeSynergies must match exactly what formationSynergy returns
    expect(result.activeSynergies).toEqual(directSynergy.active);

    // formationMultForCard[i] must equal directSynergy.multForCard(i) for ALL cards
    for (let i = 0; i < cards.length; i++) {
      expect(result.formationMultForCard[i]).toBeCloseTo(directSynergy.multForCard(i));
    }
  });

  it("no synergy lineup: activeSynergies is empty and all formationMultForCard are 1.0", () => {
    const cards = lineup433(); // no traits → no synergies
    const input: PreviewInput = { formation: "4-4-2", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    const directSynergy = formationSynergy({
      formation: "4-4-2",
      cards: cards.map((c) => ({
        position: c.naturalPosition,
        scoringPosition: c.scoringPosition,
        traits: c.traits,
      })),
    });

    expect(result.activeSynergies).toEqual(directSynergy.active);
    expect(result.activeSynergies).toHaveLength(0);
    for (let i = 0; i < cards.length; i++) {
      expect(result.formationMultForCard[i]).toBe(1.0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) Country synergy parity
// ─────────────────────────────────────────────────────────────────────────────
describe("previewLineup — country synergy parity", () => {
  it("7 same-nation cards → countryMult === countrySynergyMult(nationCounts(...))", () => {
    // 7 FRA, 4 ARG — threshold 7 triggers 1.2
    const cards = lineup433().map((c, i) => ({
      ...c,
      nation: i < 7 ? "FRA" : "ARG",
    }));
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    // Compute directly
    const fakePids = cards.map((_, i) => BigInt(i));
    const counts = nationCounts(fakePids, (id) => cards[Number(id)].nation);
    const maxCount = Math.max(...Object.values(counts));
    const directMult = countrySynergyMult(maxCount);

    expect(result.countryMult).toBeCloseTo(directMult);
    expect(result.countryMult).toBeCloseTo(1.2); // 7 FRA → 1.2
  });

  it("5 same-nation cards → countryMult === 1.12", () => {
    const cards = lineup433().map((c, i) => ({
      ...c,
      nation: i < 5 ? "ENG" : "ARG",
    }));
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    const fakePids = cards.map((_, i) => BigInt(i));
    const counts = nationCounts(fakePids, (id) => cards[Number(id)].nation);
    const maxCount = Math.max(...Object.values(counts));
    const directMult = countrySynergyMult(maxCount);

    expect(result.countryMult).toBeCloseTo(directMult);
    expect(result.countryMult).toBeCloseTo(1.12);
  });

  it("3 same-nation cards → countryMult === 1.05", () => {
    const cards = lineup433().map((c, i) => ({
      ...c,
      nation: i < 3 ? "BRA" : `NAT_${i}`,
    }));
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    const fakePids = cards.map((_, i) => BigInt(i));
    const counts = nationCounts(fakePids, (id) => cards[Number(id)].nation);
    const maxCount = Math.max(...Object.values(counts));
    const directMult = countrySynergyMult(maxCount);

    expect(result.countryMult).toBeCloseTo(directMult);
    expect(result.countryMult).toBeCloseTo(1.05);
  });

  it("all different nations → countryMult === 1 (no synergy)", () => {
    const cards = lineup433().map((c, i) => ({ ...c, nation: `NAT_${i}` }));
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    expect(result.countryMult).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) Out-of-position flags
// ─────────────────────────────────────────────────────────────────────────────
describe("previewLineup — oopFlags", () => {
  it("card placed out of position → oopFlags[i] is true", () => {
    const cards = lineup433();
    // Move card 1 (DEF) to play as MID (out of position)
    cards[1] = { ...cards[1], naturalPosition: "DEF", scoringPosition: "MID" };

    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 2, cards };
    const result = previewLineup(input);

    expect(result.oopFlags[1]).toBe(true);
  });

  it("card placed in natural position → oopFlags[i] is false", () => {
    const cards = lineup433();
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    for (let i = 0; i < cards.length; i++) {
      expect(result.oopFlags[i]).toBe(false);
    }
  });

  it("mixed OOP: first card in-position, second out-of-position", () => {
    const cards = lineup433();
    // card 0 stays GK→GK (in-position)
    // card 5 (MID) is moved to FWD slot
    cards[5] = { ...cards[5], naturalPosition: "MID", scoringPosition: "FWD" };

    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    expect(result.oopFlags[0]).toBe(false);
    expect(result.oopFlags[5]).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) Stamina flags — must match real STAMINA thresholds from constants
// ─────────────────────────────────────────────────────────────────────────────
describe("previewLineup — staminaFlags", () => {
  it("stamina > freshThreshold → staminaFlags[i] === 'Fresh'", () => {
    // freshThreshold = 70, so 71 should be "Fresh"
    const freshStamina = STAMINA.freshThreshold + 1; // 71
    const cards = lineup433([{ stamina: freshStamina, nation: "FRA" }]);
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    expect(result.staminaFlags[0]).toBe("Fresh");
  });

  it("stamina < fatiguedThreshold → staminaFlags[i] === 'Fatigued'", () => {
    // fatiguedThreshold = 30, so 29 should be "Fatigued"
    const fatiguedStamina = STAMINA.fatiguedThreshold - 1; // 29
    const cards = lineup433([{ stamina: fatiguedStamina, nation: "FRA" }]);
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    expect(result.staminaFlags[0]).toBe("Fatigued");
  });

  it("stamina in normal range → staminaFlags[i] === 'Normal'", () => {
    // Normal range: [30, 70] (i.e. >= fatiguedThreshold AND <= freshThreshold)
    const normalStamina = 50;
    const cards = lineup433([{ stamina: normalStamina, nation: "FRA" }]);
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    expect(result.staminaFlags[0]).toBe("Normal");
  });

  it("boundary: stamina === freshThreshold → NOT fresh (strictly greater-than)", () => {
    const cards = lineup433([{ stamina: STAMINA.freshThreshold, nation: "FRA" }]);
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    // staminaModifier: if (stamina > STAMINA.freshThreshold) → so exactly equal is NOT fresh
    expect(result.staminaFlags[0]).toBe("Normal");
  });

  it("boundary: stamina === fatiguedThreshold → NOT fatigued (strictly less-than)", () => {
    const cards = lineup433([{ stamina: STAMINA.fatiguedThreshold, nation: "FRA" }]);
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    // staminaModifier: if (stamina < STAMINA.fatiguedThreshold) → so exactly equal is NOT fatigued
    expect(result.staminaFlags[0]).toBe("Normal");
  });

  it("multiple cards with mixed stamina levels", () => {
    const cards = lineup433();
    cards[0] = { ...cards[0], stamina: STAMINA.freshThreshold + 1 };  // Fresh
    cards[1] = { ...cards[1], stamina: STAMINA.fatiguedThreshold - 1 }; // Fatigued
    cards[2] = { ...cards[2], stamina: 50 }; // Normal

    const input: PreviewInput = { formation: "4-3-3", captainIdx: 3, viceIdx: 4, cards };
    const result = previewLineup(input);

    expect(result.staminaFlags[0]).toBe("Fresh");
    expect(result.staminaFlags[1]).toBe("Fatigued");
    expect(result.staminaFlags[2]).toBe("Normal");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5) perCardTraitHints — Poacher boosts "goals"
// ─────────────────────────────────────────────────────────────────────────────
describe("previewLineup — perCardTraitHints", () => {
  it("Poacher card → perCardTraitHints includes 'goals'", () => {
    const cards = lineup433([{}, {}, {}, {}, {}, {}, {}, {}, { traits: ["Poacher"] as Trait[] }]);
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    expect(result.perCardTraitHints[8]).toContain("goals");
  });

  it("card with no traits → perCardTraitHints is empty array", () => {
    const cards = lineup433();
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    for (let i = 0; i < cards.length; i++) {
      expect(result.perCardTraitHints[i]).toEqual([]);
    }
  });

  it("ShotStopper → perCardTraitHints includes 'saves'", () => {
    const cards = lineup433([{ traits: ["ShotStopper"] as Trait[], naturalPosition: "GK", scoringPosition: "GK" }]);
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    expect(result.perCardTraitHints[0]).toContain("saves");
  });

  it("BoxToBox → perCardTraitHints includes 'all' (meta-category)", () => {
    // BoxToBox boosts "all" — the hint should reflect the meta-category key
    const cards = lineup433([{}, {}, {}, {}, {}, { traits: ["BoxToBox"] as Trait[] }]);
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    expect(result.perCardTraitHints[5]).toContain("all");
  });

  it("InsideForward → perCardTraitHints includes both 'goals' and 'assists'", () => {
    const cards = lineup433([{}, {}, {}, {}, {}, {}, {}, {}, { traits: ["InsideForward"] as Trait[] }]);
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    expect(result.perCardTraitHints[8]).toContain("goals");
    expect(result.perCardTraitHints[8]).toContain("assists");
  });

  it("WallCard → perCardTraitHints includes 'cleanSheet'", () => {
    const cards = lineup433([{}, { traits: ["Wall"] as Trait[], naturalPosition: "DEF", scoringPosition: "DEF" }]);
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 2, cards };
    const result = previewLineup(input);

    expect(result.perCardTraitHints[1]).toContain("cleanSheet");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6) Output shape: exactly 11 entries per array
// ─────────────────────────────────────────────────────────────────────────────
describe("previewLineup — output shape", () => {
  it("all per-card arrays have length 11", () => {
    const cards = lineup433();
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    expect(result.formationMultForCard).toHaveLength(11);
    expect(result.oopFlags).toHaveLength(11);
    expect(result.staminaFlags).toHaveLength(11);
    expect(result.perCardTraitHints).toHaveLength(11);
  });

  it("countryMult is a positive number", () => {
    const cards = lineup433();
    const input: PreviewInput = { formation: "4-3-3", captainIdx: 0, viceIdx: 1, cards };
    const result = previewLineup(input);

    expect(typeof result.countryMult).toBe("number");
    expect(result.countryMult).toBeGreaterThan(0);
  });
});
