import type { Address } from "viem";

export type ContractName =
  | "MockUSDC"
  | "CardNFT"
  | "ChipNFT"
  | "PackSale"
  | "Marketplace"
  | "RentalMarket"
  | "GameRegistry"
  | "ScoreOracle"
  | "ContestEscrow"
  | "InsurancePool"
  | "SeasonLeaderboard";

// X Layer testnet (chain 1952) — post-flow-review build.
// Keep in sync with ../../../contracts/deployments/xlayer-testnet.json
export const ADDRESSES: Record<ContractName, Address> = {
  MockUSDC: "0x29A46d0376C41423FF2aa9425A13c44FC53a1850",
  CardNFT: "0xa6188b7eCb3638A3b7Fbb855089cdCFc84dE36c9",
  ChipNFT: "0x2991dF527c84823a16917f425E24e746EE31F314",
  PackSale: "0x0136b193EE83BffC55262aAFC411efd578F9e8D5",
  Marketplace: "0x4b1c73E8d59FD4a0EB1525A1255d64FEE05aF7C8",
  GameRegistry: "0x53d6CBe6bcA72396Fe1E5AD8E2249a78Ec79D5fC",
  RentalMarket: "0x7a809b6e51b5DeE675036F24F76Eeb149C0f266c",
  ScoreOracle: "0x3470694dD5Afd5474F916B89C108bBB85d05A295",
  ContestEscrow: "0x00B08f0E928933422A7b623E475Dd84b2B98BaA4",
  InsurancePool: "0xc6d3061ccEA1c25769962A9cBDcee293Aaf698fB",
  SeasonLeaderboard: "0x9D696CBB6BD4DcfA322C14Ff74B662560aa5C2d8",
};
