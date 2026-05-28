// Full on-chain lifecycle on X Layer testnet — makes real transactions.
// Run from frontend/:  npx tsx scripts/lifecycle.ts
import { wallet, account } from "./_env";
import { runFullLifecycle } from "../lib/lifecycle";

runFullLifecycle(wallet, account)
  .then((steps) => {
    const txs = steps.filter((s) => s.hash).length;
    console.log(`\n✓ lifecycle finished: ${txs} transactions, ${steps.length} steps`);
  })
  .catch((e) => {
    console.error("lifecycle failed:", e);
    process.exit(1);
  });
