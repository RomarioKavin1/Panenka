import type { Address, Hex } from "viem";

// ---------- Cards ----------
export enum Tier {
  Common = 0,
  Rare = 1,
  SuperRare = 2,
  Unique = 3,
}
export const TIER_NAME: Record<Tier, string> = {
  [Tier.Common]: "Common",
  [Tier.Rare]: "Rare",
  [Tier.SuperRare]: "Super Rare",
  [Tier.Unique]: "Unique",
};

export interface Stats {
  pace: number;
  shooting: number;
  passing: number;
  defense: number;
  physical: number;
}

export type Position = "GK" | "DEF" | "MID" | "FWD";

export interface Card {
  tokenId: bigint;
  playerId: Hex; // bytes32, e.g. keccak256("FRA-10-Mbappe")
  tier: Tier;
  serialNumber: number;
  mintBatch: number;
  baseStats: Stats;
  owner: Address;
  /** active ERC-4907 renter, or zero address */
  user: Address;
  userExpires: bigint;
  originalBuyer: Address;
}

// ---------- Gameplay ----------
export type FormationName =
  | "4-3-3"
  | "4-4-2"
  | "3-5-2"
  | "4-2-3-1"
  | "3-4-3"
  | "5-3-2";

export enum ChipId {
  TripleCaptain = 0,
  Doubler = 1,
  Wildcard = 2,
  FreeHit = 3,
  None = 255,
}

export interface Lineup {
  matchday: number;
  wallet: Address;
  tokenIds: bigint[]; // length 11
  formation: number; // index into FORMATIONS
  captainIdx: number;
  viceIdx: number;
  chipId: ChipId;
}

// ---------- Matchday ----------
export enum MatchdayStatus {
  None = 0,
  Open = 1,
  Locked = 2,
  Cancelled = 3,
  Settled = 4,
}

// ---------- Rentals ----------
export enum PricingMode {
  Fixed = 0,
  FloorPegged = 1,
  Suggested = 2,
}
export interface RentalListing {
  tokenId: bigint;
  owner: Address;
  mode: PricingMode;
  priceValue: bigint; // USDC (6dp) for Fixed/Suggested; bps of floor for FloorPegged
  active: boolean;
}
export interface Rental {
  matchday: number;
  tokenId: bigint;
  renter: Address;
  owner: Address;
  paid: bigint;
  settled: boolean;
}

// ---------- Contests ----------
export interface Contest {
  id: bigint;
  matchday: number;
  entryFee: bigint; // USDC 6dp; 0 = free
  rakeBps: number;
  minTier: Tier;
  pool: bigint;
  rakeTaken: boolean;
}

// ---------- Scoring (off-chain) ----------
export interface MatchEvents {
  goals: number;
  assists: number;
  cleanSheet: boolean; // 60+ min, team conceded 0
  tackles: number;
  keyPasses: number;
  saves: number;
  penaltiesSaved: number;
  manOfTheMatch: boolean;
  played60: boolean;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  penaltiesMissed: number;
  goalsConceded: number; // DEF/GK
  minutes: number;
}

export interface ScoredCard {
  tokenId: bigint;
  raw: number;
  final: number;
  breakdown: Record<string, number>;
}

// ---------- Merkle payouts ----------
export interface PayoutLeaf {
  account: Address;
  amount: bigint;
}
export interface MerkleClaim {
  amount: bigint;
  proof: Hex[];
}
