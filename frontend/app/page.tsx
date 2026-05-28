"use client";

import { useAccount, useConnect, useDisconnect, useReadContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { ADDRESSES } from "@/lib/contracts/addresses";
import { MockUSDCAbi } from "@/lib/abis";
import { fmtUsdc } from "@/lib/business/format";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const { data: balance } = useReadContract({
    address: ADDRESSES.MockUSDC,
    abi: MockUSDCAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-bold">ManagerCup</h1>
        <p className="text-sm opacity-70">World Cup fantasy football on X Layer (testnet)</p>
      </header>

      {isConnected ? (
        <section className="rounded-lg border p-4">
          <p className="font-mono text-sm break-all">{address}</p>
          <p className="mt-2 text-lg">
            USDC: <strong>{balance != null ? fmtUsdc(balance) : "…"}</strong>
          </p>
          <button
            className="mt-3 rounded bg-black px-4 py-2 text-white"
            onClick={() => disconnect()}
          >
            Disconnect
          </button>
        </section>
      ) : (
        <button
          className="w-fit rounded bg-black px-4 py-2 text-white"
          onClick={() => connect({ connector: injected() })}
        >
          Connect Wallet (OKX / MetaMask)
        </button>
      )}

      <p className="text-xs opacity-60">
        Contract layer in <code>lib/</code>: ABIs, typed clients, business logic, and call wrappers.
        Runnable scripts in <code>scripts/</code>.
      </p>
    </main>
  );
}
