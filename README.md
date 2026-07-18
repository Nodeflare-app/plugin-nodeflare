# plugin-nodeflare

Read on-chain data and **agent-intelligence** across **23 EVM chains** from your ElizaOS agent —
including young chains (**Robinhood, Plasma, Ink, Zircuit**) the big indexers skip. Powered by
[NodeFlare](https://nodeflare.app).

**Read-only. No wallet, no private key.** Works out of the box on the free public tier; add an API key
for higher limits and heavy methods. Complements [`@elizaos/plugin-evm`](https://www.npmjs.com/package/@elizaos/plugin-evm)
(which signs & sends) — this plugin is the read/intelligence side.

## Why

Most data providers cover the same dozen big chains and stop. NodeFlare runs its own nodes on 23 EVM
chains and exposes higher-level **agent-intelligence** on top of raw RPC: know a wallet, screen a token,
check approvals, pre-flight a transaction — in one call, over chains other tools leave as empty shells.

## Install

```bash
npm install plugin-nodeflare
# or:  elizaos plugins add plugin-nodeflare
```

Add it to your character/agent:

```ts
import { nodeflarePlugin } from "plugin-nodeflare";

export const character = {
  name: "MyAgent",
  plugins: [nodeflarePlugin],
  // ...
};
```

## Configuration

Zero-config on the **public tier**. For higher rate limits and heavy methods (token discovery, deep
token-safety, full approval scans), set an API key — get one free at
[nodeflare.app/sign-up](https://nodeflare.app/sign-up):

```bash
NODEFLARE_API_KEY=nf_live_...
```

The plugin reads it from `runtime.getSetting("NODEFLARE_API_KEY")` or the environment.

## Actions (14)

**Agent-intelligence**

| Action | Does |
|---|---|
| `NODEFLARE_WALLET_REPORT` | Know any wallet: balances + USD total + approvals, in one call |
| `NODEFLARE_TOKEN_SAFETY` | Screen an ERC-20: ownership, risk signals, honeypot/rug score |
| `NODEFLARE_BALANCES` | Native + ERC-20 balances across chains (optional token discovery) |
| `NODEFLARE_PORTFOLIO` | USD portfolio value + per-chain breakdown |
| `NODEFLARE_ALLOWANCES` | Active token approvals / revoke-risk (flags unlimited) |
| `NODEFLARE_SIMULATE_TX` | Pre-flight a tx: revert reason, gas, asset changes |

**RPC reads**

| Action | Does |
|---|---|
| `NODEFLARE_LIST_CHAINS` | The 23 supported chains + IDs |
| `NODEFLARE_BLOCK_NUMBER` | Latest block on a chain |
| `NODEFLARE_GAS_PRICE` | Current gas price (gwei) |
| `NODEFLARE_GET_TRANSACTION` | Look up a tx by hash |
| `NODEFLARE_NATIVE_BALANCE` | Native-token balance of an address |
| `NODEFLARE_ERC20_BALANCE` | ERC-20 balance for a holder |
| `NODEFLARE_TOKEN_METADATA` | Name / symbol / decimals / supply |
| `NODEFLARE_RPC_QUERY` | Any **read-only** JSON-RPC method (send/sign are rejected) |

## Example prompts

- "Give me a report on wallet `0xd8dA…`."
- "Is `0x…` on Base a honeypot?"
- "What approvals has `0x…` granted — any unlimited?"
- "Discover every token `0x…` holds on Robinhood Chain."
- "Simulate calling `0x…` with data `0x…` on Base — will it revert?"
- "What's the latest block on Sonic?"

## Supported chains (23)

Ethereum · Base · BNB Chain · Arbitrum One · Optimism · HyperEVM · Avalanche · Unichain · Sonic ·
Polygon · Linea · Mantle · Zircuit · **Robinhood** · XLayer · Soneium · Arbitrum Nova · BOB · **Ink** ·
Cronos · Mode · Sei · **Plasma**

Address a chain by slug, name, or numeric chain ID.

## Safety

Every action is **read-only** — nothing signs or broadcasts. `NODEFLARE_SIMULATE_TX` only simulates;
`NODEFLARE_RPC_QUERY` rejects `eth_sendRawTransaction` / `eth_sign*` / `personal_*`. The plugin never
holds keys and only takes public on-chain identifiers as input.

## Links

- Docs: [nodeflare.app/agents](https://nodeflare.app/agents)
- Free API key: [nodeflare.app/sign-up](https://nodeflare.app/sign-up)
- Also available as an [MCP server](https://www.npmjs.com/package/nodeflare-mcp) and a
  [Coinbase AgentKit provider](https://www.npmjs.com/package/nodeflare-agentkit)

## License

MIT
