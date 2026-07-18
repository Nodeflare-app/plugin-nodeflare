import type { Plugin } from "@elizaos/core";
import { dataActions } from "./actions/data.js";
import { rpcActions } from "./actions/rpc.js";
import { chainsProvider } from "./provider.js";

/**
 * NodeFlare ElizaOS plugin — read on-chain data + agent-intelligence across 23
 * EVM chains, including young chains (Robinhood, Plasma, Ink, Zircuit) the big
 * indexers skip. Read-only: no wallet or private key. Works on the free public
 * tier; set NODEFLARE_API_KEY for higher limits + heavy methods.
 */
export const nodeflarePlugin: Plugin = {
  name: "nodeflare",
  description:
    "Read on-chain data & agent-intelligence (balances, portfolio, token approvals/revoke-risk, tx simulation, wallet reports, token safety) across 23 EVM chains — incl. young chains like Robinhood, Plasma, Ink, Zircuit. Read-only, no private key.",
  // Data/intelligence actions first (the differentiators), then RPC reads.
  actions: [...dataActions, ...rpcActions],
  providers: [chainsProvider],
};

export default nodeflarePlugin;

// Named exports for advanced users / tests.
export { CHAINS, resolveChain, badChain, SLUGS } from "./chains.js";
export { chainsProvider } from "./provider.js";
export * from "./actions/data.js";
export * from "./actions/rpc.js";
