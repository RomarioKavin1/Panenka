import type { Abi } from "viem";
import {
  MockUSDCAbi,
  CardNFTAbi,
  ChipNFTAbi,
  PackSaleAbi,
  MarketplaceAbi,
  RentalMarketAbi,
  GameRegistryAbi,
  ScoreOracleAbi,
  ContestEscrowAbi,
  InsurancePoolAbi,
  SeasonLeaderboardAbi,
} from "../abis";
import { ADDRESSES, type ContractName } from "./addresses";

export * from "./chain";
export * from "./addresses";
export * from "../abis";

export const ABIS = {
  MockUSDC: MockUSDCAbi,
  CardNFT: CardNFTAbi,
  ChipNFT: ChipNFTAbi,
  PackSale: PackSaleAbi,
  Marketplace: MarketplaceAbi,
  RentalMarket: RentalMarketAbi,
  GameRegistry: GameRegistryAbi,
  ScoreOracle: ScoreOracleAbi,
  ContestEscrow: ContestEscrowAbi,
  InsurancePool: InsurancePoolAbi,
  SeasonLeaderboard: SeasonLeaderboardAbi,
} as const;

/** Typed {address, abi} bundle for a contract — drop into viem read/write or wagmi hooks. */
export function contract<N extends ContractName>(name: N) {
  return { address: ADDRESSES[name], abi: ABIS[name] as Abi } as const;
}
