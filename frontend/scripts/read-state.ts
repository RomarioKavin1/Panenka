// Read-only sanity check against the deployed contracts.
// Run from frontend/:  npx tsx scripts/read-state.ts
import { wallet, account, publicClient } from "./_env";
import { usdcBalance } from "../lib/actions/reads";
import { ADDRESSES } from "../lib/contracts/addresses";
import { fmtUsdc } from "../lib/business/format";

async function main() {
  const block = await publicClient.getBlockNumber();
  const usdc = await usdcBalance(account);
  console.log("chain head block:", block);
  console.log("account:        ", account);
  console.log("USDC balance:   ", fmtUsdc(usdc), "USDC");
  console.log("contracts:");
  for (const [name, addr] of Object.entries(ADDRESSES)) console.log(`  ${name.padEnd(18)} ${addr}`);
  void wallet;
}

main().catch((e) => { console.error(e); process.exit(1); });
