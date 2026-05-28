import { formatUnits, parseUnits } from "viem";
import { USDC_DECIMALS } from "../constants";

export const toUsdc = (human: string | number): bigint =>
  parseUnits(String(human), USDC_DECIMALS);

export const fromUsdc = (raw: bigint): string => formatUnits(raw, USDC_DECIMALS);

export const fmtUsdc = (raw: bigint, dp = 2): string => {
  const n = Number(formatUnits(raw, USDC_DECIMALS));
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
};
