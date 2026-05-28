import type { Abi, Address } from "viem";
import { BaseError, ContractFunctionRevertedError } from "viem";

export interface PreflightReq {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  account: Address;
  value?: bigint;
}

export interface PreflightResult {
  willRevert: boolean;
  reason?: string;
  gas?: bigint;
  gasPriceGwei?: number;
}

/**
 * Minimal shape so tests can inject a fake client and so the real viem
 * PublicClient is assignable without casting.
 *
 * Each method is typed with an overloaded function signature (via `Function`)
 * so the real viem PublicClient (which has strongly-typed overloads) satisfies
 * this interface without any explicit cast at call sites.
 */
export interface PreflightClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  simulateContract: (...args: any[]) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  estimateContractGas: (...args: any[]) => Promise<bigint>;
  getGasPrice: () => Promise<bigint>;
}

/**
 * Pure preflight check — simulate, then estimate gas.
 *
 * @param client  Any object with simulateContract / estimateContractGas / getGasPrice.
 *                Pass `publicClient` from lib/clients in production; pass a fake in tests.
 * @param req     The call parameters.
 * @returns       { willRevert, reason?, gas?, gasPriceGwei? }
 */
export async function preflight(
  client: PreflightClient,
  req: PreflightReq,
): Promise<PreflightResult> {
  // ── 1. Simulate ──────────────────────────────────────────────────────────────
  try {
    await client.simulateContract({ ...req });
  } catch (err) {
    // Extract the best human-readable reason from viem's error hierarchy.
    let reason: string | undefined;

    if (err instanceof BaseError) {
      // ContractFunctionRevertedError carries the decoded revert message.
      const revertErr = err.walk(
        (e) => e instanceof ContractFunctionRevertedError,
      ) as ContractFunctionRevertedError | null;

      reason = revertErr?.shortMessage ?? err.shortMessage ?? err.message;
    } else if (err instanceof Error) {
      reason = err.message;
    } else {
      reason = String(err);
    }

    return { willRevert: true, reason };
  }

  // ── 2. Estimate gas (best-effort) ────────────────────────────────────────────
  let gas: bigint | undefined;
  let gasPriceGwei: number | undefined;

  try {
    const [gasEstimate, gasPrice] = await Promise.all([
      client.estimateContractGas({ ...req }),
      client.getGasPrice(),
    ]);
    gas = gasEstimate;
    gasPriceGwei = Number(gasPrice) / 1e9;
  } catch {
    // Gas estimation failed (e.g. no live RPC in tests) — return success with no gas info.
  }

  return { willRevert: false, gas, gasPriceGwei };
}
