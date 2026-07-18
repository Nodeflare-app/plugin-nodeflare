import { encodeFunctionData, decodeFunctionResult, formatUnits, type Abi } from "viem";
import { ethCallBatch } from "./gateway.js";

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;

type Erc20Fn = "balanceOf" | "decimals" | "symbol" | "name" | "totalSupply";

/** Build an eth_call {to,data} for a view function on an ERC-20. */
export function readErc20(token: string, fn: Erc20Fn, args: unknown[] = []): { to: string; data: string } {
  return { to: token, data: encodeFunctionData({ abi: ERC20_ABI, functionName: fn, args: args as never }) };
}

/** Decode a uint result (balanceOf/totalSupply). */
export function decodeUint(hex: string, fn: "balanceOf" | "totalSupply"): bigint {
  return decodeFunctionResult({ abi: ERC20_ABI, functionName: fn, data: hex as `0x${string}` }) as bigint;
}

/** Decode a numeric decimals() result, defaulting to 18 on failure. */
export function decodeDecimals(hex: string | null | undefined): number {
  if (!hex) return 18;
  try {
    return Number(decodeFunctionResult({ abi: ERC20_ABI, functionName: "decimals", data: hex as `0x${string}` }));
  } catch {
    return 18;
  }
}

/** Decode a string result (name/symbol); tolerant of non-standard tokens. */
export function decodeStr(hex: string | null | undefined, fn: "name" | "symbol"): string {
  if (!hex) return "?";
  try {
    return String(decodeFunctionResult({ abi: ERC20_ABI, functionName: fn, data: hex as `0x${string}` }));
  } catch {
    return "?";
  }
}

export { ethCallBatch, formatUnits };
