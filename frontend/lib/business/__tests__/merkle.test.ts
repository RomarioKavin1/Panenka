/**
 * TDD tests for scoreLeaf (spec §3.3) + existing merkle helpers.
 *
 * Written BEFORE scoreLeaf implementation.
 *
 * Score leaf encoding: keccak256(abi.encodePacked(address, uint32, int256))
 * The oracle scales fractional fantasy points ×1000 before calling scoreLeaf
 * (e.g. 16.5 pts → 16500n). This ensures all scores are integer bigints and
 * supports negative scores (red cards, penalties missed, own goals, etc.).
 */

import { describe, it, expect } from "vitest";
import { keccak256, encodePacked } from "viem";
import type { Address, Hex } from "viem";
import { scoreLeaf, payoutLeaf, dnpLeaf } from "../merkle";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures — must be EIP-55 checksum addresses (viem encodePacked validates)
// Using well-known Hardhat/Anvil deterministic accounts.
// ─────────────────────────────────────────────────────────────────────────────

const WALLET_A = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address; // hardhat[0]
const WALLET_B = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address; // hardhat[1]

// ─────────────────────────────────────────────────────────────────────────────
// scoreLeaf — determinism
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreLeaf — determinism", () => {
  it("returns the same hash on repeated calls with identical args", () => {
    const first = scoreLeaf(WALLET_A, 1, 16500n);
    const second = scoreLeaf(WALLET_A, 1, 16500n);
    expect(first).toBe(second);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreLeaf — cross-check (encoding proof)
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreLeaf — cross-check", () => {
  it("equals an independently computed keccak256(encodePacked([address,uint32,int256]))", () => {
    // Compute independently in the test — proves the encoding is correct
    const expected: Hex = keccak256(
      encodePacked(["address", "uint32", "int256"], [WALLET_A, 1, 16500n]),
    );
    expect(scoreLeaf(WALLET_A, 1, 16500n)).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreLeaf — distinctness
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreLeaf — distinctness", () => {
  it("different wallet produces a different leaf", () => {
    const a = scoreLeaf(WALLET_A, 1, 16500n);
    const b = scoreLeaf(WALLET_B, 1, 16500n);
    expect(a).not.toBe(b);
  });

  it("different matchday produces a different leaf", () => {
    const a = scoreLeaf(WALLET_A, 1, 16500n);
    const b = scoreLeaf(WALLET_A, 2, 16500n);
    expect(a).not.toBe(b);
  });

  it("different score produces a different leaf", () => {
    const a = scoreLeaf(WALLET_A, 1, 16500n);
    const b = scoreLeaf(WALLET_A, 1, 16501n);
    expect(a).not.toBe(b);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreLeaf — signed scores (int256)
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreLeaf — signed / negative score", () => {
  it("negative score produces a valid 0x-prefixed 32-byte hash", () => {
    const hash = scoreLeaf(WALLET_A, 1, -3000n);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("negative score differs from the corresponding positive score", () => {
    const pos = scoreLeaf(WALLET_A, 1, 3000n);
    const neg = scoreLeaf(WALLET_A, 1, -3000n);
    expect(pos).not.toBe(neg);
  });

  it("negative score cross-checks against independent keccak256(encodePacked)", () => {
    const expected: Hex = keccak256(
      encodePacked(["address", "uint32", "int256"], [WALLET_A, 1, -3000n]),
    );
    expect(scoreLeaf(WALLET_A, 1, -3000n)).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreLeaf — output format
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreLeaf — output format", () => {
  it("result matches /^0x[0-9a-f]{64}$/ (lowercase hex, 32 bytes)", () => {
    const hash = scoreLeaf(WALLET_A, 1, 16500n);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("result is exactly 66 chars (0x + 64 hex chars)", () => {
    const hash = scoreLeaf(WALLET_A, 5, 0n);
    expect(hash).toHaveLength(66);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression: existing helpers are unaffected
// ─────────────────────────────────────────────────────────────────────────────

describe("existing helpers — regression", () => {
  it("payoutLeaf still produces a valid hex hash", () => {
    const h = payoutLeaf(WALLET_A, 1000000n);
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("dnpLeaf still produces a valid hex hash", () => {
    const h = dnpLeaf(42n);
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
