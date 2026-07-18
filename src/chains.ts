// NodeFlare's 23 EVM chains. Addressed by slug; a public keyless read endpoint
// lives at https://rpc.nodeflare.app/{slug}/public for each, and a keyed one at
// /{slug}/v1/{key}. The set deliberately includes young chains (Robinhood,
// Plasma, Ink, Zircuit…) that Alchemy/Moralis/Sim leave uncovered.
export interface ChainInfo {
  label: string;
  chainId: number;
  currency: string;
}

export const CHAINS: Record<string, ChainInfo> = {
  eth: { label: "Ethereum", chainId: 1, currency: "ETH" },
  base: { label: "Base", chainId: 8453, currency: "ETH" },
  bnb: { label: "BNB Chain", chainId: 56, currency: "BNB" },
  arb: { label: "Arbitrum One", chainId: 42161, currency: "ETH" },
  op: { label: "Optimism", chainId: 10, currency: "ETH" },
  hl: { label: "HyperEVM (HyperLiquid)", chainId: 999, currency: "HYPE" },
  avax: { label: "Avalanche C-Chain", chainId: 43114, currency: "AVAX" },
  unichain: { label: "Unichain", chainId: 130, currency: "ETH" },
  sonic: { label: "Sonic", chainId: 146, currency: "S" },
  polygon: { label: "Polygon PoS", chainId: 137, currency: "POL" },
  linea: { label: "Linea", chainId: 59144, currency: "ETH" },
  mantle: { label: "Mantle", chainId: 5000, currency: "MNT" },
  zircuit: { label: "Zircuit", chainId: 48900, currency: "ETH" },
  robinhood: { label: "Robinhood Chain", chainId: 4663, currency: "ETH" },
  xlayer: { label: "XLayer", chainId: 196, currency: "OKB" },
  soneium: { label: "Soneium", chainId: 1868, currency: "ETH" },
  nova: { label: "Arbitrum Nova", chainId: 42170, currency: "ETH" },
  bob: { label: "BOB", chainId: 60808, currency: "ETH" },
  ink: { label: "Ink", chainId: 57073, currency: "ETH" },
  cronos: { label: "Cronos", chainId: 25, currency: "CRO" },
  mode: { label: "Mode", chainId: 34443, currency: "ETH" },
  sei: { label: "Sei", chainId: 1329, currency: "SEI" },
  plasma: { label: "Plasma", chainId: 9745, currency: "XPL" },
};

const ALIASES: Record<string, string> = {
  ethereum: "eth", mainnet: "eth", arbitrum: "arb", "arbitrum-one": "arb",
  "arbitrum-nova": "nova", optimism: "op", bsc: "bnb", binance: "bnb",
  "bnb-chain": "bnb", avalanche: "avax", matic: "polygon", pol: "polygon",
  hyperevm: "hl", hyperliquid: "hl", "x-layer": "xlayer",
};

const BY_CHAIN_ID: Record<number, string> = Object.fromEntries(
  Object.entries(CHAINS).map(([slug, c]) => [c.chainId, slug]),
);

/** Resolve a slug, common name, or numeric chain ID to a canonical slug (or null). */
export function resolveChain(input: string): string | null {
  const s = String(input ?? "").trim().toLowerCase();
  if (CHAINS[s]) return s;
  if (ALIASES[s]) return ALIASES[s];
  const n = s.startsWith("0x") ? parseInt(s, 16) : /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  if (!Number.isNaN(n) && BY_CHAIN_ID[n]) return BY_CHAIN_ID[n];
  return null;
}

/** Human-readable "unknown chain" message listing valid slugs. */
export function badChain(input: string): string {
  return `Unknown chain '${input}'. NodeFlare serves: ${Object.keys(CHAINS).join(", ")}. Pass a slug, name, or chain ID.`;
}

export const SLUGS = Object.keys(CHAINS);
