import { createPublicClient, createWalletClient, http, custom, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ACTIVE_CHAIN } from "./contracts/chain";

/** Read-only client. Safe in the browser and in scripts. */
export const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(),
});

/** Browser wallet client (OKX Wallet / MetaMask injected). Call only client-side. */
export function getBrowserWalletClient() {
  if (typeof window === "undefined") throw new Error("wallet client is browser-only");
  // OKX Wallet injects window.okxwallet; fall back to window.ethereum.
  const injected =
    (window as unknown as { okxwallet?: unknown }).okxwallet ??
    (window as unknown as { ethereum?: unknown }).ethereum;
  if (!injected) throw new Error("No injected wallet found (install OKX Wallet or MetaMask)");
  return createWalletClient({ chain: ACTIVE_CHAIN, transport: custom(injected as never) });
}

/** Server/script wallet client from a private key (scripts only — never ship a key to the browser). */
export function getScriptWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({ account, chain: ACTIVE_CHAIN, transport: http() });
}

export type { Address };
