/**
 * Full on-chain lifecycle runner — makes ACTUAL transactions on X Layer testnet via the SDK.
 *
 * One funded account plays every role (admin/owner/minter/oracle signer + collector/manager/
 * buyer), because only the deployer holds OKB gas on testnet. Mirrors the Foundry E2E test
 * (contracts/test/E2ELifecycle.t.sol) against the live chain.
 *
 * Usage: see scripts/lifecycle.ts
 */
import { keccak256, toHex, parseEventLogs, type Address, type Hex, type WalletClient } from "viem";
import { publicClient } from "./clients";
import { ADDRESSES } from "./contracts/addresses";
import { CardNFTAbi, PackSaleAbi, ContestEscrowAbi, ScoreOracleAbi } from "./abis";
import * as W from "./actions/writes";
import * as R from "./actions/reads";
import { buildPayoutTree, dnpLeaf } from "./business/merkle";
import { toUsdc, fmtUsdc } from "./business/format";
import { ChipId } from "./types";

export interface Step { phase: string; note: string; hash?: Hex }
export type Logger = (s: Step) => void;

const pid = (i: number): Hex => keccak256(toHex(`LC-PLAYER-${i}`));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const EMPTY_PROOF: Hex[] = [];

export async function runFullLifecycle(
  wallet: WalletClient,
  account: Address,
  log: Logger = (s) => console.log(`[${s.phase}] ${s.note}${s.hash ? "  " + s.hash : ""}`)
): Promise<Step[]> {
  const steps: Step[] = [];
  const record = (phase: string, note: string, hash?: Hex) => {
    const s = { phase, note, hash };
    steps.push(s);
    log(s);
  };
  // 2 confirmations: X Layer RPC has read-after-write lag, so a dependent tx's pre-flight
  // gas estimation can run against stale state if we proceed on 1 confirmation.
  const send = async (phase: string, note: string, p: Promise<Hex>): Promise<Hex> => {
    const hash = await p;
    const rcpt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
    if (rcpt.status !== "success") throw new Error(`${phase}: "${note}" reverted (${hash})`);
    record(phase, note, hash);
    return hash;
  };

  // unique matchday per run so per-(matchday) state never collides with a prior run
  const matchday = Math.floor(Date.now() / 1000) % 1_000_000;

  // ---------- 1. onboarding ----------
  await send("1-onboard", "faucet 10,000 USDC", W.usdcFaucet(wallet, toUsdc(10_000)));
  await send("1-onboard", "approve RentalMarket", W.usdcApprove(wallet, ADDRESSES.RentalMarket, toUsdc(1e9)));
  await send("1-onboard", "approve ContestEscrow", W.usdcApprove(wallet, ADDRESSES.ContestEscrow, toUsdc(1e9)));
  await send("1-onboard", "approve InsurancePool", W.usdcApprove(wallet, ADDRESSES.InsurancePool, toUsdc(1e9)));
  await send("1-onboard", "approve PackSale", W.usdcApprove(wallet, ADDRESSES.PackSale, toUsdc(1e9)));
  await send("1-onboard", "approve Marketplace", W.usdcApprove(wallet, ADDRESSES.Marketplace, toUsdc(1e9)));
  try {
    await send("1-onboard", "claim baseline chips", W.claimBaselineChips(wallet));
  } catch {
    record("1-onboard", "chips already claimed (skip)");
  }

  // deterministic stats for every player id we will mint
  const stat = { pace: 80, shooting: 80, passing: 80, defense: 50, physical: 70 };
  for (let i = 0; i < 14; i++) {
    await send("1-onboard", `setPlayerStats ${i} (t0)`, W.setPlayerStats(wallet, pid(i), 0, stat));
  }
  for (let t = 1; t < 4; t++) {
    for (let i = 0; i < 3; i++) {
      await send("1-onboard", `setPlayerStats ${i} (t${t})`, W.setPlayerStats(wallet, pid(i), t, stat));
    }
  }
  const squad = [pid(100), pid(101), pid(102)];
  for (const p of squad) await send("1-onboard", "stats for squad player", W.setPlayerStats(wallet, p, 0, stat));
  await send("1-onboard", "airdrop starter squad (3 cards)", W.airdropStarterSquad(wallet, account, squad));

  // ---------- 2. packs (commit-reveal) ----------
  await send("2-packs", "setPackPrice Bronze=5 USDC", W.setPackPrice(wallet, 0, toUsdc(5)));
  await send("2-packs", "set player pool", W.setPlayerPool(wallet, [pid(0), pid(1), pid(2)]));
  const buyHash = await W.buyPack(wallet, 0);
  const buyRcpt = await publicClient.waitForTransactionReceipt({ hash: buyHash, confirmations: 2 });
  record("2-packs", "buy Bronze pack", buyHash);
  const commitId = parseEventLogs({ abi: PackSaleAbi, eventName: "PackBought", logs: buyRcpt.logs })[0].args.commitId;
  const target = await publicClient.getBlockNumber();
  while ((await publicClient.getBlockNumber()) <= target + 17n) await sleep(1500); // 16-block delay
  await send("2-packs", `reveal pack #${commitId}`, W.revealPack(wallet, commitId));

  // ---------- 3. marketplace ----------
  const mId = await mintAndId(wallet, account, pid(0), 1); // Rare
  await send("3-market", "approve Marketplace for card", W.approveCard(wallet, ADDRESSES.Marketplace, mId));
  await send("3-market", "list card @100 USDC", W.listForSale(wallet, mId, toUsdc(100)));
  await send("3-market", "buy listed card", W.buyListing(wallet, mId));

  // ---------- 4. mint the 11 owned lineup cards ----------
  const lineup: bigint[] = [];
  for (let i = 0; i < 11; i++) lineup.push(await mintAndId(wallet, account, pid(i), 0));
  record("4-cards", `minted 11 lineup cards: ${lineup.map(String).join(",")}`);

  // ---------- 5. matchday + rental + insurance ----------
  const lead = 150; // seconds the open window stays before lock
  const lock = BigInt(Math.floor(Date.now() / 1000) + lead);
  await send("5-rental", `configureMatchday ${matchday}`, W.configureMatchday(wallet, matchday, lock));
  const rentedId = await mintAndId(wallet, account, pid(12), 0);
  await send("5-rental", "list card for rent @1 USDC", W.listForRent(wallet, rentedId, 0, toUsdc(1)));
  await send("5-rental", "rent card for matchday", W.rentCard(wallet, rentedId, matchday));
  // seed the insurance pool so it can collateralise the new policy (deploy doesn't pre-fund it)
  await send("5-rental", "seed insurance pool 100 USDC", W.usdcTransfer(wallet, ADDRESSES.InsurancePool, toUsdc(100)));
  await send("5-rental", "insure the rental (DNP)", W.insureRental(wallet, matchday, rentedId, toUsdc(1)));

  // ---------- 6. gameplay ----------
  await send("6-gameplay", "commit lineup (Free Hit)", W.commitLineup(wallet, matchday, lineup, 0, 0, 1, ChipId.FreeHit));
  record("6-gameplay", `hasLineup=${await R.hasLineup(matchday, account)}`);

  // ---------- 7. contest ----------
  const ccHash = await W.createContest(wallet, matchday, toUsdc(10), 800, 0);
  const ccRcpt = await publicClient.waitForTransactionReceipt({ hash: ccHash, confirmations: 2 });
  record("7-contest", "create contest ($10, 8% rake)", ccHash);
  const contestId = parseEventLogs({ abi: ContestEscrowAbi, eventName: "ContestCreated", logs: ccRcpt.logs })[0].args.id;
  await send("7-contest", `enter contest #${contestId}`, W.enterContest(wallet, contestId));

  // ---------- 8. wait for lock, then oracle + settle + payout ----------
  record("8-oracle", `waiting for matchday lock (~${lead}s)…`);
  for (;;) {
    const blk = await publicClient.getBlock();
    if (blk.timestamp >= lock) break;
    await sleep(3000);
  }
  const scoreRoot = keccak256(toHex(`scores-${matchday}`));
  await send("8-oracle", "submit score+DNP roots", W.submitScoreRoot(wallet, matchday, scoreRoot, dnpLeaf(rentedId)));

  const net = toUsdc(10) - (toUsdc(10) * 800n) / 10000n; // 9.2 USDC net pool
  const payout = buildPayoutTree([{ account, amount: net }]);
  await send("8-oracle", "submit payout root", W.submitPayoutRoot(wallet, contestId, payout.root));
  await send("8-oracle", "take rake", W.takeRake(wallet, contestId));
  const balBeforeClaim = await R.usdcBalance(account);
  await send("8-oracle", "claim contest payout", W.claimContest(wallet, contestId, net, payout.claims[0].proof));
  record("8-oracle", `payout received: ${fmtUsdc((await R.usdcBalance(account)) - balBeforeClaim)} USDC`);
  await send("8-oracle", "settle rental", W.settleRental(wallet, rentedId, matchday));

  // ---------- 9. insurance DNP claim ----------
  const balBeforeDnp = await R.usdcBalance(account);
  await send("9-insure", "claim DNP", W.claimDnp(wallet, matchday, rentedId, toUsdc(1), EMPTY_PROOF));
  record("9-insure", `DNP payout: ${fmtUsdc((await R.usdcBalance(account)) - balBeforeDnp)} USDC`);

  // ---------- 10. season (only if not already finalized on this deployment) ----------
  const seasonDone = await publicClient.readContract({
    address: ADDRESSES.ScoreOracle, abi: ScoreOracleAbi, functionName: "seasonFinalized",
  });
  if (seasonDone) {
    record("10-season", "season root already finalized on this deployment (skip)");
  } else {
    await send("10-season", "fund season pool 500 USDC", W.usdcTransfer(wallet, ADDRESSES.SeasonLeaderboard, toUsdc(500)));
    const sTree = buildPayoutTree([{ account, amount: toUsdc(500) }]);
    await send("10-season", "submit season root", W.submitSeasonRoot(wallet, sTree.root));
    const balBeforeSeason = await R.usdcBalance(account);
    await send("10-season", "claim season payout", W.claimSeason(wallet, toUsdc(500), sTree.claims[0].proof));
    record("10-season", `season payout: ${fmtUsdc((await R.usdcBalance(account)) - balBeforeSeason)} USDC`);
  }

  record("done", `lifecycle complete — ${steps.filter((s) => s.hash).length} on-chain txs`);
  return steps;
}


async function mintAndId(wallet: WalletClient, to: Address, playerId: Hex, tier: number): Promise<bigint> {
  const hash = await W.mintCard(wallet, to, playerId, tier, 1);
  const rcpt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
  const logs = parseEventLogs({ abi: CardNFTAbi, eventName: "Transfer", logs: rcpt.logs });
  return logs[0].args.tokenId;
}
