// End-to-end demo on X Layer testnet using the deployer key (owner + minter + 1-of-1 oracle).
// Exercises: faucet -> stats -> mint -> list-for-rent -> rent -> matchday -> commit lineup ->
// contest enter -> oracle payout root (built off-chain with lib/merkle) -> takeRake -> claim.
// Run from frontend/:  npx tsx scripts/demo-flow.ts
import { keccak256, toHex, type Hex } from "viem";
import { wallet, account, publicClient } from "./_env";
import * as W from "../lib/actions/writes";
import * as R from "../lib/actions/reads";
import { ADDRESSES } from "../lib/contracts/addresses";
import { toUsdc, fmtUsdc } from "../lib/business/format";
import { buildPayoutTree } from "../lib/business/merkle";
import { ChipId } from "../lib/types";

const LINEUP = 11;
const playerId = (i: number) => keccak256(toHex(`DEMO-PLAYER-${i}`));

async function mined(hash: Hex, label: string) {
  const r = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✓ ${label} (${r.status}) ${hash}`);
}

async function main() {
  console.log("account:", account);

  // 1) USDC + approvals
  await mined(await W.usdcFaucet(wallet, toUsdc(1000)), "faucet 1000 USDC");
  await mined(await W.usdcApprove(wallet, ADDRESSES.RentalMarket, toUsdc(1_000_000)), "approve RentalMarket");
  await mined(await W.usdcApprove(wallet, ADDRESSES.ContestEscrow, toUsdc(1_000_000)), "approve ContestEscrow");

  // 2) Deterministic stats per (player, Common) then mint 11 Common cards to self
  const ids: bigint[] = [];
  for (let i = 0; i < LINEUP; i++) {
    await mined(
      await W.setPlayerStats(wallet, playerId(i), 0, { pace: 50, shooting: 50, passing: 50, defense: 50, physical: 50 }),
      `setPlayerStats ${i}`
    );
    const hash = await W.mintCard(wallet, account, playerId(i), 0, 1);
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    // tokenId is sequential from the contract; read via Transfer is overkill for a demo — derive from index.
    console.log(`  ✓ mint ${i} (${rcpt.status})`);
  }
  // Recover token ids: contract mints sequentially starting at 1 across all mints ever, so read owner balance window.
  // Simpler for the demo: assume these are the latest 11 ids by querying nextId-ish via cards() probing.
  // We instead track via the CardNFT Transfer logs from the mint receipts would be ideal; here we probe ownerOf.
  let probe = 1n;
  const owned: bigint[] = [];
  // Find the 11 most recent tokens owned by `account`.
  // (Bounded probe; fine for a fresh demo deployment.)
  for (let t = 1n; owned.length < LINEUP && t < 5000n; t++) {
    try {
      const o = await R.cardOwner(t);
      if (o.toLowerCase() === account.toLowerCase()) owned.push(t);
    } catch { /* token doesn't exist */ }
    probe = t;
  }
  ids.push(...owned.slice(-LINEUP));
  console.log("  lineup tokenIds:", ids.map(String).join(","), `(probed to ${probe})`);

  // 3) List each for rent and rent for matchday N (single-account demo)
  const matchday = Number((await publicClient.getBlockNumber()) % 100000n) + 1; // unique-ish
  const lock = BigInt(Math.floor(Date.now() / 1000) + 3600);
  await mined(await W.configureMatchday(wallet, matchday, lock), `configureMatchday ${matchday}`);
  for (const id of ids) {
    await mined(await W.listForRent(wallet, id, 0, toUsdc(1)), `listForRent ${id}`);
    await mined(await W.rentCard(wallet, id, matchday), `rent ${id}`);
  }

  // 4) Commit lineup of the rented cards
  await mined(
    await W.commitLineup(wallet, matchday, ids, 0, 0, 1, ChipId.None),
    `commitLineup matchday ${matchday}`
  );
  console.log("  hasLineup:", await R.hasLineup(matchday, account));

  // 5) Paid contest + oracle-routed payout + claim (validates merkle.ts against the contract)
  const entryHash = await W.createContest(wallet, matchday, toUsdc(10), 800, 0);
  await publicClient.waitForTransactionReceipt({ hash: entryHash });
  // contestId is sequential; read it back by scanning recent ids (fresh deployment -> small)
  let contestId = 1n;
  for (let c = 1n; c < 1000n; c++) {
    const info = await R.contestInfo(c);
    if (info.matchday === matchday) { contestId = c; break; }
  }
  await mined(await W.enterContest(wallet, contestId), `enter contest ${contestId}`);

  const balBefore = await R.usdcBalance(account);
  const net = toUsdc(10) - (toUsdc(10) * 800n) / 10000n; // single entrant gets the net pool
  const { root, claims } = buildPayoutTree([{ account, amount: net }]);
  await mined(await W.submitPayoutRoot(wallet, contestId, root), "oracle submitPayoutRoot");
  await mined(await W.takeRake(wallet, contestId), "takeRake");
  await mined(await W.claimContest(wallet, contestId, claims[0].amount, claims[0].proof), "claim payout");
  const balAfter = await R.usdcBalance(account);
  console.log(`  payout claimed: ${fmtUsdc(balAfter - balBefore)} USDC (net pool ${fmtUsdc(net)})`);

  console.log("DEMO COMPLETE");
}

main().catch((e) => { console.error(e); process.exit(1); });
