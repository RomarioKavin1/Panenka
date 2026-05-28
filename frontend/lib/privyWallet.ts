import { createWalletClient, custom, type Address, type WalletClient } from "viem";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { ACTIVE_CHAIN } from "./contracts/chain";

/**
 * Build a viem WalletClient from a Privy ConnectedWallet.
 *
 * Mirrors the pattern used in app/demo/page.tsx:
 *   switchChain → getEthereumProvider → createWalletClient({ custom(provider) })
 *
 * Not a "use client" file — it is a plain async helper that can be imported
 * from client components or server contexts where the wallet object is available.
 */
export async function walletClientFromPrivy(wallet: ConnectedWallet): Promise<WalletClient> {
  await wallet.switchChain(ACTIVE_CHAIN.id);
  const provider = await wallet.getEthereumProvider();
  return createWalletClient({
    account: wallet.address as Address,
    chain: ACTIVE_CHAIN,
    transport: custom(provider),
  });
}
