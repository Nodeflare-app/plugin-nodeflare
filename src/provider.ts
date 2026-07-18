import type { Provider, ProviderResult } from "@elizaos/core";
import { CHAINS } from "./chains.js";

/**
 * Read-only context provider: tells the agent which chains NodeFlare can read,
 * so it can pick a valid `chain` without first calling NODEFLARE_LIST_CHAINS.
 */
export const chainsProvider: Provider = {
  name: "NODEFLARE_CHAINS",
  description: "The 23 EVM chains NodeFlare can read (incl. young chains like Robinhood, Plasma, Ink, Zircuit).",
  get: async (): Promise<ProviderResult> => {
    const list = Object.entries(CHAINS)
      .map(([slug, c]) => `${slug} (${c.label}, chainId ${c.chainId})`)
      .join(", ");
    return {
      text: `NodeFlare RPC + data serves these ${Object.keys(CHAINS).length} EVM chains: ${list}.`,
      values: { nodeflareChainCount: Object.keys(CHAINS).length },
      data: { chains: CHAINS },
    };
  },
};
