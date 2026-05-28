/**
 * TDD tests for prize curve + ranked payout builder (spec §5.2)
 *
 * Written BEFORE implementation.
 *
 * Weight table (×100):
 *   rank 1  = 1500
 *   rank 2  =  800
 *   rank 3  =  500
 *   ranks  4–10  = 250  (7 ranks)
 *   ranks 11–50  =  50  (40 ranks)
 *   ranks 51–250 =  15  (200 ranks)
 *
 * All amounts are USDC in 6-decimal integer units as bigint.
 * Σ payouts === netPool (no dust lost — dust goes to rank 1).
 */

import { describe, it, expect } from "vitest";
import { prizeCurve, buildContestPayout } from "../contest";
import type { Address } from "viem";

// ─────────────────────────────────────────────────────────────────────────────
// 1) prizeCurve — basic spec cases
// ─────────────────────────────────────────────────────────────────────────────

describe("prizeCurve", () => {
  it("single entrant takes the whole net pool", () => {
    expect(prizeCurve(9_200000n, 1)).toEqual([9_200000n]);
  });

  it("sums exactly to net pool with no dust lost (1000 entrants → top 250 paid)", () => {
    const out = prizeCurve(9_200000n, 1000);
    expect(out.reduce((a, b) => a + b, 0n)).toBe(9_200000n);
    expect(out.length).toBe(250); // only top 250 paid
    expect(out[0] > out[1] && out[1] > out[2]).toBe(true);
  });

  it("3 entrants: weights 15/8/5 normalized to the net pool — sum exact", () => {
    const out = prizeCurve(28n, 3); // tiny pool → dust goes to rank 1
    expect(out.reduce((a, b) => a + b, 0n)).toBe(28n);
    expect(out.length).toBe(3);
  });

  it("11 entrants: pays exactly 11 ranks, sum === netPool", () => {
    const pool = 100_000000n;
    const out = prizeCurve(pool, 11);
    expect(out.length).toBe(11);
    expect(out.reduce((a, b) => a + b, 0n)).toBe(pool);
  });

  it("51 entrants: pays exactly 51 ranks, sum === netPool", () => {
    const pool = 55_000000n;
    const out = prizeCurve(pool, 51);
    expect(out.length).toBe(51);
    expect(out.reduce((a, b) => a + b, 0n)).toBe(pool);
  });

  it("exactly 250 entrants: pays all 250, sum === netPool", () => {
    const pool = 250_000000n;
    const out = prizeCurve(pool, 250);
    expect(out.length).toBe(250);
    expect(out.reduce((a, b) => a + b, 0n)).toBe(pool);
  });

  it("amounts are monotonically non-increasing across all 250 ranks (1000-entrant case)", () => {
    const out = prizeCurve(9_200000n, 1000);
    for (let i = 1; i < out.length; i++) {
      expect(out[i] <= out[i - 1]).toBe(true);
    }
  });

  it("2 entrants: only 2 entries paid, sum === netPool", () => {
    const pool = 10_000000n;
    const out = prizeCurve(pool, 2);
    expect(out.length).toBe(2);
    expect(out.reduce((a, b) => a + b, 0n)).toBe(pool);
    // rank1 weight=1500, rank2=800; total W=2300
    // rank1 = floor(10_000000 * 1500 / 2300) = floor(6_521739.13…) = 6_521739
    // rank2 = floor(10_000000 *  800 / 2300) = floor(3_478260.87…) = 3_478260
    // dust = 10_000000 - 6_521739 - 3_478260 = 1 → added to rank1 → 6_521740
    expect(out[0]).toBe(6_521740n);
    expect(out[1]).toBe(3_478260n);
  });

  it("zero netPool: all payouts are 0n", () => {
    const out = prizeCurve(0n, 5);
    expect(out).toEqual([0n, 0n, 0n, 0n, 0n]);
    expect(out.reduce((a, b) => a + b, 0n)).toBe(0n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) buildContestPayout — sort, tie-break, ranks
// ─────────────────────────────────────────────────────────────────────────────

const ADDR_A = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as Address;
const ADDR_B = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as Address;
const ADDR_C = "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC" as Address;
const ADDR_D = "0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD" as Address;

describe("buildContestPayout", () => {
  it("ranks by descending total — basic 3-way", () => {
    const scored = [
      { wallet: ADDR_C, total: 30 },
      { wallet: ADDR_A, total: 50 },
      { wallet: ADDR_B, total: 40 },
    ];
    const { ranked } = buildContestPayout(scored, 100_000000n);
    expect(ranked[0].wallet).toBe(ADDR_A);
    expect(ranked[1].wallet).toBe(ADDR_B);
    expect(ranked[2].wallet).toBe(ADDR_C);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].rank).toBe(3);
  });

  it("tie-break: earlier enteredBlock wins (same total)", () => {
    const scored = [
      { wallet: ADDR_A, total: 100, enteredBlock: 500 },
      { wallet: ADDR_B, total: 100, enteredBlock: 200 }, // earlier → rank 1
    ];
    const { ranked } = buildContestPayout(scored, 100_000000n);
    expect(ranked[0].wallet).toBe(ADDR_B); // block 200 < block 500
    expect(ranked[1].wallet).toBe(ADDR_A);
  });

  it("tie-break: missing enteredBlock treated as +∞ (ranks last among equal scores)", () => {
    const scored = [
      { wallet: ADDR_A, total: 100 },             // no block → +∞
      { wallet: ADDR_B, total: 100, enteredBlock: 999 }, // block 999
    ];
    const { ranked } = buildContestPayout(scored, 100_000000n);
    expect(ranked[0].wallet).toBe(ADDR_B); // finite block beats +∞
    expect(ranked[1].wallet).toBe(ADDR_A);
  });

  it("tie-break: equal total AND equal block → lower wallet (asc lowercased) ranks first", () => {
    // ADDR_A = 0xAAAA… < ADDR_B = 0xBBBB… when lowercased
    const scored = [
      { wallet: ADDR_B, total: 100, enteredBlock: 100 },
      { wallet: ADDR_A, total: 100, enteredBlock: 100 },
    ];
    const { ranked } = buildContestPayout(scored, 100_000000n);
    expect(ranked[0].wallet).toBe(ADDR_A); // 0xaaaa… < 0xbbbb…
    expect(ranked[1].wallet).toBe(ADDR_B);
  });

  it("amounts sum to netPool for ≤250 entrants", () => {
    const pool = 50_000000n;
    const scored = Array.from({ length: 10 }, (_, i) => ({
      wallet: `0x${String(i + 1).padStart(40, "0")}` as Address,
      total: 100 - i,
    }));
    const { ranked } = buildContestPayout(scored, pool);
    const sum = ranked.reduce((acc, r) => acc + r.amount, 0n);
    expect(sum).toBe(pool);
  });

  it("entrants beyond paid (>250) get amount 0n", () => {
    // 260 entrants, only 250 paid; entrants 251–260 must get 0
    const scored = Array.from({ length: 260 }, (_, i) => ({
      wallet: `0x${String(i + 1).padStart(40, "0")}` as Address,
      total: 260 - i, // all different scores, ranks 1..260
    }));
    const { ranked } = buildContestPayout(scored, 9_200000n);
    expect(ranked.length).toBe(260);
    // rank 251 is index 250 (0-based)
    for (let i = 250; i < 260; i++) {
      expect(ranked[i].amount).toBe(0n);
    }
    // ranks 1..250 should still sum to netPool
    const paidSum = ranked.slice(0, 250).reduce((acc, r) => acc + r.amount, 0n);
    expect(paidSum).toBe(9_200000n);
  });

  it("ranks are 1-based and sequential", () => {
    const scored = [
      { wallet: ADDR_A, total: 10 },
      { wallet: ADDR_B, total: 20 },
      { wallet: ADDR_C, total: 30 },
      { wallet: ADDR_D, total: 40 },
    ];
    const { ranked } = buildContestPayout(scored, 10_000000n);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it("single entrant gets the full net pool at rank 1", () => {
    const scored = [{ wallet: ADDR_A, total: 99 }];
    const { ranked } = buildContestPayout(scored, 9_200000n);
    expect(ranked.length).toBe(1);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].amount).toBe(9_200000n);
    expect(ranked[0].wallet).toBe(ADDR_A);
  });
});
