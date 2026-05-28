import type { Address, Hex } from "viem";
import { publicClient } from "../clients";
import { ADDRESSES } from "../contracts/addresses";
import {
  CardNFTAbi, ChipNFTAbi, PackSaleAbi, MarketplaceAbi, RentalMarketAbi,
  GameRegistryAbi, ScoreOracleAbi, ContestEscrowAbi, MockUSDCAbi,
} from "../abis";
import { Tier, type Stats } from "../types";

export async function usdcBalance(account: Address): Promise<bigint> {
  return publicClient.readContract({
    address: ADDRESSES.MockUSDC, abi: MockUSDCAbi, functionName: "balanceOf", args: [account],
  });
}

export async function usdcAllowance(owner: Address, spender: Address): Promise<bigint> {
  return publicClient.readContract({
    address: ADDRESSES.MockUSDC, abi: MockUSDCAbi, functionName: "allowance", args: [owner, spender],
  });
}

export async function cardOwner(tokenId: bigint): Promise<Address> {
  return publicClient.readContract({
    address: ADDRESSES.CardNFT, abi: CardNFTAbi, functionName: "ownerOf", args: [tokenId],
  });
}

export async function cardUser(tokenId: bigint): Promise<Address> {
  return publicClient.readContract({
    address: ADDRESSES.CardNFT, abi: CardNFTAbi, functionName: "userOf", args: [tokenId],
  });
}

/** The address allowed to play a card: the active renter if set, else the owner. */
export async function cardController(tokenId: bigint): Promise<Address> {
  const user = await cardUser(tokenId);
  if (user !== "0x0000000000000000000000000000000000000000") return user;
  return cardOwner(tokenId);
}

export async function cardMeta(tokenId: bigint): Promise<{ playerId: Hex; tier: Tier; serial: number; mintBatch: number }> {
  const [playerId, tier, serial, mintBatch] = await publicClient.readContract({
    address: ADDRESSES.CardNFT, abi: CardNFTAbi, functionName: "cards", args: [tokenId],
  });
  return { playerId, tier: tier as Tier, serial: Number(serial), mintBatch: Number(mintBatch) };
}

export async function cardStats(tokenId: bigint): Promise<Stats> {
  const [pace, shooting, passing, defense, physical] = await publicClient.readContract({
    address: ADDRESSES.CardNFT, abi: CardNFTAbi, functionName: "statsOf", args: [tokenId],
  });
  return { pace, shooting, passing, defense, physical };
}

export async function chipBalance(account: Address, chipId: number): Promise<bigint> {
  return publicClient.readContract({
    address: ADDRESSES.ChipNFT, abi: ChipNFTAbi, functionName: "balanceOf", args: [account, BigInt(chipId)],
  });
}

export async function staminaOf(tokenId: bigint): Promise<number> {
  const s = await publicClient.readContract({
    address: ADDRESSES.GameRegistry, abi: GameRegistryAbi, functionName: "staminaOf", args: [tokenId],
  });
  return Number(s);
}

export async function hasLineup(matchday: number, wallet: Address): Promise<boolean> {
  return publicClient.readContract({
    address: ADDRESSES.GameRegistry, abi: GameRegistryAbi, functionName: "hasLineup",
    args: [BigInt(matchday), wallet],
  });
}

export async function matchdayIsOpen(matchday: number): Promise<boolean> {
  return publicClient.readContract({
    address: ADDRESSES.GameRegistry, abi: GameRegistryAbi, functionName: "isOpen", args: [BigInt(matchday)],
  });
}

export async function rentalListing(tokenId: bigint) {
  const [owner, mode, priceValue, active] = await publicClient.readContract({
    address: ADDRESSES.RentalMarket, abi: RentalMarketAbi, functionName: "listings", args: [tokenId],
  });
  return { owner, mode: Number(mode), priceValue, active };
}

export async function marketListing(tokenId: bigint) {
  const [seller, price] = await publicClient.readContract({
    address: ADDRESSES.Marketplace, abi: MarketplaceAbi, functionName: "listings", args: [tokenId],
  });
  return { seller, price };
}

export async function packCommit(commitId: bigint) {
  const [buyer, targetBlock, packType, opened, pricePaid] = await publicClient.readContract({
    address: ADDRESSES.PackSale, abi: PackSaleAbi, functionName: "commits", args: [commitId],
  });
  return { buyer, targetBlock, packType: Number(packType), opened, pricePaid };
}

export async function contestInfo(contestId: bigint) {
  const [matchday, entryFee, rakeBps, minTier, pool, rakeTaken] = await publicClient.readContract({
    address: ADDRESSES.ContestEscrow, abi: ContestEscrowAbi, functionName: "contests", args: [contestId],
  });
  return {
    matchday: Number(matchday), entryFee, rakeBps: Number(rakeBps),
    minTier: Number(minTier) as Tier, pool, rakeTaken,
  };
}

export async function scoreRoot(matchday: number): Promise<Hex> {
  return publicClient.readContract({
    address: ADDRESSES.ScoreOracle, abi: ScoreOracleAbi, functionName: "roots", args: [BigInt(matchday)],
  });
}

export async function payoutRootFinalized(contestId: bigint): Promise<boolean> {
  return publicClient.readContract({
    address: ADDRESSES.ScoreOracle, abi: ScoreOracleAbi, functionName: "payoutFinalized", args: [contestId],
  });
}
