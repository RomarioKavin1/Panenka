import { describe, it, expect, vi } from "vitest";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { preflight } from "../preflight";
import type { PreflightReq, PreflightClient } from "../preflight";

// ── Minimal fake request (ABI is irrelevant for unit tests) ──────────────────
const fakeReq: PreflightReq = {
  address: "0x0000000000000000000000000000000000000001",
  abi: [],
  functionName: "transfer",
  args: ["0x0000000000000000000000000000000000000002", 100n],
  account: "0x0000000000000000000000000000000000000003",
};

// ── Helpers to build fake clients ────────────────────────────────────────────
function fakeRevertClient(reason: string): PreflightClient {
  return {
    simulateContract: vi.fn().mockRejectedValue(new Error(reason)),
    estimateContractGas: vi.fn().mockResolvedValue(21000n),
    getGasPrice: vi.fn().mockResolvedValue(1_000_000_000n),
  };
}

function fakeOkClient(): PreflightClient {
  return {
    simulateContract: vi.fn().mockResolvedValue({ result: undefined }),
    estimateContractGas: vi.fn().mockResolvedValue(21000n),
    getGasPrice: vi.fn().mockResolvedValue(1_000_000_000n),
  };
}

function fakeOkClientGasThrows(): PreflightClient {
  return {
    simulateContract: vi.fn().mockResolvedValue({ result: undefined }),
    estimateContractGas: vi.fn().mockRejectedValue(new Error("rpc error")),
    getGasPrice: vi.fn().mockResolvedValue(1_000_000_000n),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("preflight", () => {
  // (a) simulate throws → willRevert:true + reason string
  it("(a) simulate throws a plain Error → willRevert:true with reason", async () => {
    const client = fakeRevertClient("execution reverted: insufficient balance");
    const result = await preflight(client, fakeReq);

    expect(result.willRevert).toBe(true);
    expect(typeof result.reason).toBe("string");
    expect(result.reason).toContain("insufficient balance");
    // gas fields must be absent
    expect(result.gas).toBeUndefined();
    expect(result.gasPriceGwei).toBeUndefined();
  });

  // (a2) simulate throws a viem BaseError → shortMessage is extracted
  it("(a2) simulate throws a viem BaseError → shortMessage used as reason", async () => {
    // In viem, BaseError's first argument becomes both .message and .shortMessage.
    const baseErr = new BaseError("transfer amount exceeds balance");
    const client: PreflightClient = {
      simulateContract: vi.fn().mockRejectedValue(baseErr),
      estimateContractGas: vi.fn(),
      getGasPrice: vi.fn(),
    };

    const result = await preflight(client, fakeReq);
    expect(result.willRevert).toBe(true);
    expect(result.reason).toContain("transfer amount exceeds balance");
  });

  // (b) simulate ok + gas estimate succeeds → willRevert:false, gas:21000n, gasPriceGwei:1
  it("(b) simulate ok + estimateContractGas:21000n + getGasPrice:1gwei → willRevert:false", async () => {
    const client = fakeOkClient();
    const result = await preflight(client, fakeReq);

    expect(result.willRevert).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(result.gas).toBe(21000n);
    expect(result.gasPriceGwei).toBe(1);
  });

  // (c) simulate ok but estimateContractGas throws → willRevert:false, gas:undefined
  it("(c) simulate ok but estimateContractGas throws → willRevert:false, gas undefined", async () => {
    const client = fakeOkClientGasThrows();
    const result = await preflight(client, fakeReq);

    expect(result.willRevert).toBe(false);
    expect(result.gas).toBeUndefined();
    expect(result.gasPriceGwei).toBeUndefined();
  });
});

// ── ContractFunctionRevertedError shortMessage extraction ────────────────────
describe("preflight: viem ContractFunctionRevertedError reason extraction", () => {
  it("extracts shortMessage from ContractFunctionRevertedError inside BaseError walk", async () => {
    // Build a ContractFunctionRevertedError the way viem creates it
    const revertErr = new ContractFunctionRevertedError({
      abi: [],
      functionName: "transfer",
    });
    // Wrap it in a BaseError chain
    const wrapped = new BaseError("Simulation failed.", {
      cause: revertErr,
    });

    const client: PreflightClient = {
      simulateContract: vi.fn().mockRejectedValue(wrapped),
      estimateContractGas: vi.fn(),
      getGasPrice: vi.fn(),
    };

    const result = await preflight(client, fakeReq);
    expect(result.willRevert).toBe(true);
    // shortMessage from the inner ContractFunctionRevertedError
    expect(typeof result.reason).toBe("string");
    expect(result.reason!.length).toBeGreaterThan(0);
  });
});
