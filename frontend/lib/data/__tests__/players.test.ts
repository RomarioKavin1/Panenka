/**
 * players.test.ts — Unit tests for the player catalog and related helpers.
 *
 * Covers:
 *   - playerId() is deterministic and matches keccak256(toHex(key))
 *   - Every player's traits are valid for their position per TRAITS_BY_POSITION
 *   - tierStats() is monotonic non-decreasing across Common→Rare→SuperRare→Unique
 *   - PLAYER_BY_ID has no playerId collisions (size === PLAYERS.length)
 *   - nationOf / positionOf / traitsOf resolve correctly for a known player
 *   - nationOf / positionOf / traitsOf return undefined/[] for an unknown id
 */

import { describe, it, expect } from "vitest";
import { keccak256, toHex } from "viem";
import { Tier } from "@/lib/types";
import { TRAITS_BY_POSITION } from "@/lib/data/traits";
import {
  PLAYERS,
  PLAYER_BY_ID,
  playerId,
  tierStats,
} from "@/lib/data/players";
import { nationOf, positionOf, traitsOf } from "@/lib/data/index";

// ─────────────────────────────────────────────────────────────────────────────
// 1) playerId is deterministic
// ─────────────────────────────────────────────────────────────────────────────
describe("playerId()", () => {
  it("is deterministic: same key → same hash every call", () => {
    const key = "FRA-10-Mbappe";
    expect(playerId(key)).toBe(playerId(key));
  });

  it("matches keccak256(toHex(key)) computed independently", () => {
    const key = "FRA-10-Mbappe";
    const expected = keccak256(toHex(key));
    expect(playerId(key)).toBe(expected);
  });

  it("different keys produce different hashes", () => {
    expect(playerId("FRA-10-Mbappe")).not.toBe(playerId("ARG-10-Messi"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) Every player's traits are valid for their position
// ─────────────────────────────────────────────────────────────────────────────
describe("trait validity", () => {
  it("every player's primaryTrait is in TRAITS_BY_POSITION[position]", () => {
    for (const player of PLAYERS) {
      const valid = TRAITS_BY_POSITION[player.position];
      expect(valid).toBeDefined();
      expect(valid).toContain(player.primaryTrait);
    }
  });

  it("every player's secondaryTrait is in TRAITS_BY_POSITION[position]", () => {
    for (const player of PLAYERS) {
      const valid = TRAITS_BY_POSITION[player.position];
      expect(valid).toContain(player.secondaryTrait);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) tierStats() is monotonic non-decreasing per stat across all tiers
// ─────────────────────────────────────────────────────────────────────────────
describe("tierStats()", () => {
  const tiers = [Tier.Common, Tier.Rare, Tier.SuperRare, Tier.Unique] as const;
  const statFields = ["pace", "shooting", "passing", "defense", "physical"] as const;

  it("is monotonic non-decreasing for Mbappe's base stats", () => {
    const mbappe = PLAYERS.find((p) => p.key === "FRA-10-Mbappe")!;
    expect(mbappe).toBeDefined();

    const scaled = tiers.map((t) => tierStats(mbappe.base, t));

    for (const field of statFields) {
      for (let i = 1; i < scaled.length; i++) {
        expect(scaled[i][field]).toBeGreaterThanOrEqual(scaled[i - 1][field]);
      }
    }
  });

  it("Common tier returns base stats unchanged (multiplier = 1.0)", () => {
    const alisson = PLAYERS.find((p) => p.key === "BRA-1-Alisson")!;
    const result = tierStats(alisson.base, Tier.Common);
    expect(result).toEqual(alisson.base);
  });

  it("Unique tier produces strictly higher stats than Common for a high-base player", () => {
    const messi = PLAYERS.find((p) => p.key === "ARG-10-Messi")!;
    const common = tierStats(messi.base, Tier.Common);
    const unique = tierStats(messi.base, Tier.Unique);
    for (const field of statFields) {
      expect(unique[field]).toBeGreaterThan(common[field]);
    }
  });

  it("is monotonic for all players across all tiers", () => {
    for (const player of PLAYERS) {
      const scaled = tiers.map((t) => tierStats(player.base, t));
      for (const field of statFields) {
        for (let i = 1; i < scaled.length; i++) {
          expect(scaled[i][field]).toBeGreaterThanOrEqual(scaled[i - 1][field]);
        }
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) PLAYER_BY_ID has no collisions
// ─────────────────────────────────────────────────────────────────────────────
describe("PLAYER_BY_ID", () => {
  it("size equals PLAYERS.length (no playerId collisions)", () => {
    expect(PLAYER_BY_ID.size).toBe(PLAYERS.length);
  });

  it("resolves a known player by id", () => {
    const mbappe = PLAYERS.find((p) => p.key === "FRA-10-Mbappe")!;
    const resolved = PLAYER_BY_ID.get(mbappe.playerId);
    expect(resolved).toBeDefined();
    expect(resolved!.name).toBe("Kylian Mbappé");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5) nationOf / positionOf / traitsOf helpers
// ─────────────────────────────────────────────────────────────────────────────
describe("nationOf / positionOf / traitsOf", () => {
  const messi = PLAYERS.find((p) => p.key === "ARG-10-Messi")!;

  it("nationOf resolves to the correct nation for a known player", () => {
    expect(nationOf(messi.playerId)).toBe("ARG");
  });

  it("positionOf resolves to the correct position for a known player", () => {
    expect(positionOf(messi.playerId)).toBe("FWD");
  });

  it("traitsOf returns [primaryTrait, secondaryTrait] for a known player", () => {
    const traits = traitsOf(messi.playerId);
    expect(traits).toHaveLength(2);
    expect(traits[0]).toBe(messi.primaryTrait);
    expect(traits[1]).toBe(messi.secondaryTrait);
  });

  const unknownId = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

  it("nationOf returns undefined for an unknown playerId", () => {
    expect(nationOf(unknownId)).toBeUndefined();
  });

  it("positionOf returns undefined for an unknown playerId", () => {
    expect(positionOf(unknownId)).toBeUndefined();
  });

  it("traitsOf returns [] for an unknown playerId", () => {
    expect(traitsOf(unknownId)).toEqual([]);
  });
});
