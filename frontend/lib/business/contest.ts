import type { Address } from "viem";

// ─────────────────────────────────────────────────────────────────────────────
// §5.2 prize-curve weight table (×100 to stay in integer land)
// rank 1       → 1500  (15%)
// rank 2       →  800  ( 8%)
// rank 3       →  500  ( 5%)
// ranks  4–10  →  250  ( 2.5%) each  — 7 ranks
// ranks 11–50  →   50  ( 0.5%) each  — 40 ranks
// ranks 51–250 →   15  ( 0.15%) each — 200 ranks
// ─────────────────────────────────────────────────────────────────────────────

function weightFor(rank: number): number {
  if (rank === 1) return 1500;
  if (rank === 2) return 800;
  if (rank === 3) return 500;
  if (rank <= 10) return 250;
  if (rank <= 50) return 50;
  return 15; // ranks 51–250
}

/**
 * Compute the prize distribution for a contest (spec §5.2).
 *
 * @param netPool  - Total amount to distribute, in USDC 6-decimal bigint units.
 * @param numEntrants - Number of participants in the contest.
 * @returns Array of bigint amounts, index 0 = 1st place.  Length = min(250, numEntrants).
 *          Amounts are strictly non-increasing by rank.
 *          Σ amounts === netPool (dust from floor division is added to rank 1).
 */
export function prizeCurve(netPool: bigint, numEntrants: number): bigint[] {
  const paid = Math.min(250, numEntrants);

  // Collect per-rank integer weights and sum
  const weights: number[] = [];
  let W = 0;
  for (let r = 1; r <= paid; r++) {
    const w = weightFor(r);
    weights.push(w);
    W += w;
  }

  const bigW = BigInt(W);

  // Floor-divide each payout; track running sum to compute dust
  let distributed = 0n;
  const payouts: bigint[] = weights.map((w) => {
    const p = (netPool * BigInt(w)) / bigW;
    distributed += p;
    return p;
  });

  // Add dust (from floor divisions) to rank 1 so Σ === netPool exactly
  const dust = netPool - distributed;
  payouts[0] += dust;

  return payouts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ranked payout builder
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoredEntrant {
  wallet: Address;
  total: number;
  /** Block at which this entrant submitted their lineup. Used as first tie-break (asc). */
  enteredBlock?: number;
}

export interface RankedPayout {
  wallet: Address;
  rank: number;
  amount: bigint;
}

/**
 * Build the full ranked payout array for a contest.
 *
 * Sorting (fully deterministic):
 *  1. `total` descending
 *  2. `enteredBlock` ascending (earlier = better; missing → treated as +∞)
 *  3. `wallet` ascending (lowercased string compare)
 *
 * @param scored   - Array of scored entrants (unsorted).
 * @param netPool  - Net pool to distribute (USDC 6dp bigint).
 * @returns `{ ranked }` — one entry per entrant, rank 1-based.
 *          Entrants ranked > 250 receive `amount: 0n`.
 */
export function buildContestPayout(
  scored: ScoredEntrant[],
  netPool: bigint,
): { ranked: RankedPayout[] } {
  // Sort: total desc → enteredBlock asc (missing = +∞) → wallet asc (lowercased)
  const sorted = [...scored].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;

    const blockA = a.enteredBlock ?? Number.POSITIVE_INFINITY;
    const blockB = b.enteredBlock ?? Number.POSITIVE_INFINITY;
    if (blockA !== blockB) return blockA - blockB;

    const wA = a.wallet.toLowerCase();
    const wB = b.wallet.toLowerCase();
    if (wA < wB) return -1;
    if (wA > wB) return 1;
    return 0;
  });

  // Compute curve amounts for top min(250, n) ranks
  const curve = prizeCurve(netPool, sorted.length);

  // Map to ranked payouts; entrants beyond `paid` get 0n
  const ranked: RankedPayout[] = sorted.map((entrant, idx) => ({
    wallet: entrant.wallet,
    rank: idx + 1,
    amount: idx < curve.length ? curve[idx] : 0n,
  }));

  return { ranked };
}
