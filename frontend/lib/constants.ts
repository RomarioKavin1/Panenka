import { Tier, type FormationName, type Position } from "./types";

// ---------- Token decimals ----------
export const USDC_DECIMALS = 6;

// ---------- Basis-point splits (must mirror the contracts) ----------
export const BPS_DENOMINATOR = 10_000n;

export const RENTAL_SPLIT = {
  ownerBps: 8800n,
  platformBps: 1000n,
  originalBuyerBps: 200n,
  cancelRefundBps: 9000n, // renter share on pre-lock cancel
} as const;

export const MARKETPLACE_SPLIT = {
  sellerBps: 9500n,
  platformBps: 400n,
  originalBuyerBps: 100n,
} as const;

export const INSURANCE = {
  premiumBps: 2000n, // +20%
  premiumReturnBps: 5000n, // 50% of premium back on payout
} as const;

// ---------- Supply caps per tier (mirror CardNFT.tierSupplyCap) ----------
export const TIER_SUPPLY_CAP: Record<Tier, number> = {
  [Tier.Common]: Number.MAX_SAFE_INTEGER, // uint32.max on-chain ~= unlimited
  [Tier.Rare]: 1000,
  [Tier.SuperRare]: 100,
  [Tier.Unique]: 1,
};

// ---------- Tier stat bonus (off-chain scoring multiplier) ----------
export const TIER_BONUS: Record<Tier, number> = {
  [Tier.Common]: 1.0,
  [Tier.Rare]: 1.05,
  [Tier.SuperRare]: 1.12,
  [Tier.Unique]: 1.2,
};

// ---------- Pack pull rates (cumulative /10000, mirror PackSale.tierCum) ----------
// packType 0=Bronze, 1=Silver, 2=Gold. Order: [Common, Rare, SR, Unique] cumulative.
export const PACK_TIER_CUM: Record<number, [number, number, number, number]> = {
  0: [9000, 9950, 9999, 10000],
  1: [8000, 9700, 9980, 10000],
  2: [6500, 9300, 9950, 10000],
};
export const PACK_NAME: Record<number, string> = { 0: "Bronze", 1: "Silver", 2: "Gold" };
export const CARDS_PER_PACK = 5;
export const PACK_REVEAL_DELAY_BLOCKS = 16;

// ---------- Stamina (mirror GameRegistry) ----------
export const STAMINA = {
  max: 100,
  cost: 30,
  regen: 50,
  freshThreshold: 70, // > 70 => +5%
  fatiguedThreshold: 30, // < 30 => -20%
  freshBonus: 1.05,
  fatiguedPenalty: 0.8,
} as const;

export const OUT_OF_POSITION_PENALTY = 0.85; // -15%

// ---------- Captain multipliers ----------
export const CAPTAIN_MULT = { none: 1, captain: 2, tripleCaptain: 3 } as const;

// ---------- Country synergy ----------
export const COUNTRY_SYNERGY: { threshold: number; mult: number }[] = [
  { threshold: 7, mult: 1.2 },
  { threshold: 5, mult: 1.12 },
  { threshold: 3, mult: 1.05 },
];

// ---------- Formations ----------
export interface Formation {
  name: FormationName;
  slots: Position[]; // 11 positions (1 GK first)
}
export const FORMATIONS: Formation[] = [
  { name: "4-3-3", slots: ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD", "FWD"] },
  { name: "4-4-2", slots: ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD"] },
  { name: "3-5-2", slots: ["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "FWD", "FWD"] },
  { name: "4-2-3-1", slots: ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "FWD"] },
  { name: "3-4-3", slots: ["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD", "FWD"] },
  { name: "5-3-2", slots: ["GK", "DEF", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD"] },
];
export const LINEUP_SIZE = 11;

// ---------- Scoring tables (spec §4.8), points per position ----------
// Index by position.
export const SCORE_GOAL: Record<Position, number> = { FWD: 5, MID: 6, DEF: 8, GK: 10 };
export const SCORE_ASSIST = 3;
export const SCORE_CLEAN_SHEET: Record<Position, number> = { FWD: 0, MID: 1, DEF: 4, GK: 4 };
export const SCORE_TACKLE = 0.5; // cap +4
export const SCORE_TACKLE_CAP = 4;
export const SCORE_KEY_PASS = 0.3; // cap +3
export const SCORE_KEY_PASS_CAP = 3;
export const SCORE_SAVE = 0.5; // GK only, cap +5
export const SCORE_SAVE_CAP = 5;
export const SCORE_PEN_SAVED = 5;
export const SCORE_MOTM = 3;
export const SCORE_PLAYED_60 = 1;
export const SCORE_YELLOW = -1;
export const SCORE_RED = -3;
export const SCORE_OWN_GOAL = -2;
export const SCORE_PEN_MISSED = -2;
export const SCORE_CONCEDED_PER_2 = -1; // DEF/GK, per 2 conceded

// ---------- Contest tiers (PRD §5.2), entry in USDC ----------
export const CONTEST_TIERS = [
  { name: "Common Open", entryUsdc: 1, minTier: Tier.Common },
  { name: "Rare+ Open", entryUsdc: 10, minTier: Tier.Rare },
  { name: "Super Rare+ Open", entryUsdc: 50, minTier: Tier.SuperRare },
  { name: "Whale Pool", entryUsdc: 250, minTier: Tier.Unique },
] as const;
export const DEFAULT_CONTEST_RAKE_BPS = 800; // 8%
