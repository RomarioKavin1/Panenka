"use client";

import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import type { Abi, Address, Hex } from "viem";
import { ACTIVE_CHAIN } from "@/lib/contracts/chain";
import { publicClient } from "@/lib/clients";
import { walletClientFromPrivy } from "@/lib/privyWallet";
import { preflight } from "@/lib/business/preflight";
import type { PreflightResult } from "@/lib/business/preflight";
import { waitFor } from "@/lib/actions/writes";

// ── Props ────────────────────────────────────────────────────────────────────

export interface TxRequest {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

export interface TxButtonProps {
  request: TxRequest;
  /** Label shown on the primary simulate button */
  label: string;
  /** Called with the transaction hash once mined */
  onSuccess?: (hash: Hex) => void;
  disabled?: boolean;
}

// ── Internal state machine ───────────────────────────────────────────────────

type Phase =
  | { tag: "idle" }
  | { tag: "simulating" }
  | { tag: "simulated"; result: PreflightResult }
  | { tag: "sending" }
  | { tag: "mining" }
  | { tag: "done"; hash: Hex }
  | { tag: "error"; message: string };

// ── Component ────────────────────────────────────────────────────────────────

/**
 * TxButton — reusable write-button with preflight simulation.
 *
 * Flow:
 *   1. User clicks the label button → simulate via publicClient.
 *   2. Badge shows simulation outcome (gas estimate OR revert reason).
 *   3. "Confirm" button appears only when simulation succeeded.
 *   4. On confirm → build WalletClient from Privy → writeContract → waitFor.
 *   5. onSuccess(hash) called when mined.
 */
export function TxButton({ request, label, onSuccess, disabled = false }: TxButtonProps) {
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const address = wallet?.address as Address | undefined;

  const [phase, setPhase] = useState<Phase>({ tag: "idle" });

  // ── Step 1: Simulate ───────────────────────────────────────────────────────
  async function handleSimulate() {
    if (!wallet || !address) {
      setPhase({ tag: "error", message: "No wallet connected — please connect first." });
      return;
    }

    setPhase({ tag: "simulating" });
    try {
      const result = await preflight(publicClient, { ...request, account: address });
      setPhase({ tag: "simulated", result });
    } catch (err) {
      setPhase({
        tag: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Step 2: Confirm & send ─────────────────────────────────────────────────
  async function handleConfirm() {
    if (!wallet || !address) return;

    setPhase({ tag: "sending" });
    try {
      const walletClient = await walletClientFromPrivy(wallet);

      const hash = await walletClient.writeContract({
        ...request,
        account: address,
        chain: ACTIVE_CHAIN,
      });

      setPhase({ tag: "mining" });
      await waitFor(hash);
      setPhase({ tag: "done", hash });
      onSuccess?.(hash);
    } catch (err) {
      setPhase({
        tag: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Badge ──────────────────────────────────────────────────────────────────
  function renderBadge() {
    switch (phase.tag) {
      case "idle":
        return null;
      case "simulating":
        return <SimBadge text="Simulating…" color="neutral" />;
      case "simulated": {
        const r = phase.result;
        if (r.willRevert) {
          return <SimBadge text={`✗ will revert: ${r.reason ?? "unknown reason"}`} color="red" />;
        }
        const gasStr = r.gas !== undefined ? `~${r.gas.toLocaleString()} gas` : "gas unknown";
        const gweiStr = r.gasPriceGwei !== undefined ? ` @ ${r.gasPriceGwei} gwei` : "";
        return <SimBadge text={`✓ will succeed · ${gasStr}${gweiStr}`} color="green" />;
      }
      case "sending":
        return <SimBadge text="Sending transaction…" color="neutral" />;
      case "mining":
        return <SimBadge text="Waiting for confirmation…" color="neutral" />;
      case "done":
        return (
          <SimBadge
            text={`Mined: ${phase.hash.slice(0, 10)}…`}
            color="green"
          />
        );
      case "error":
        return <SimBadge text={`Error: ${phase.message}`} color="red" />;
    }
  }

  // ── No wallet ──────────────────────────────────────────────────────────────
  if (!wallet) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-amber-700">Connect a wallet to send transactions.</p>
      </div>
    );
  }

  const isBusy =
    phase.tag === "simulating" ||
    phase.tag === "sending" ||
    phase.tag === "mining";

  const showConfirm =
    phase.tag === "simulated" && !phase.result.willRevert;

  return (
    <div className="flex flex-col gap-2">
      {/* Primary simulate button */}
      <button
        type="button"
        disabled={disabled || isBusy}
        onClick={handleSimulate}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-40"
      >
        {isBusy && phase.tag === "simulating" ? "Simulating…" : label}
      </button>

      {/* Simulation result badge */}
      {renderBadge()}

      {/* Confirm button — only when simulation succeeded */}
      {showConfirm && (
        <button
          type="button"
          disabled={isBusy}
          onClick={handleConfirm}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-40"
        >
          Confirm &amp; Send
        </button>
      )}

      {/* Reset link after terminal states */}
      {(phase.tag === "done" || phase.tag === "error") && (
        <button
          type="button"
          onClick={() => setPhase({ tag: "idle" })}
          className="w-fit text-xs underline opacity-60 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          reset
        </button>
      )}
    </div>
  );
}

// ── Tiny internal badge ────────────────────────────────────────────────────

function SimBadge({ text, color }: { text: string; color: "green" | "red" | "neutral" }) {
  const cls =
    color === "green"
      ? "bg-emerald-50 text-emerald-800"
      : color === "red"
        ? "bg-red-50 text-red-700"
        : "bg-zinc-100 text-zinc-600";
  return (
    <p className={`rounded px-3 py-1 text-xs font-mono ${cls}`} role="status" aria-live="polite">
      {text}
    </p>
  );
}
