import { makeAction, example, type RunResult } from "../action.js";
import { SLUGS } from "../chains.js";
import { nodeflareData } from "../gateway.js";
import type { Extracted } from "../extract.js";

function chainOf(args: Extracted): string {
  if (!args.chain) throw new Error(`Which chain? One of: ${SLUGS.join(", ")}.`);
  return args.chain;
}
function addressOf(args: Extracted): string {
  const a = args.addresses[0];
  if (!a) throw new Error("Provide a 0x wallet address.");
  return a;
}
const usd = (n: unknown): string =>
  typeof n === "number" ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "n/a";
// chains filter: scope to the one mentioned chain if any, else all 23.
const chainsFilter = (args: Extracted): string[] | undefined => (args.chain ? [args.chain] : undefined);

export const walletReportAction = makeAction({
  name: "NODEFLARE_WALLET_REPORT",
  similes: ["WALLET_REPORT", "KNOW_THIS_WALLET", "ANALYZE_WALLET", "WALLET_SUMMARY", "WALLET_PROFILE"],
  description:
    "Get a full 'know this wallet' report for an address in one call: native + ERC-20 balances (USD-priced), total value and top holdings, plus active token approvals (revoke risk) across NodeFlare's 23 EVM chains — including young chains (Robinhood, Plasma, Ink) other tools skip. Balances + USD come back on the free tier; the approvals scan needs an API key or x402.",
  examples: [example("Give me a report on wallet 0xd8dA…", "Pulling a full wallet report.", "NODEFLARE_WALLET_REPORT")],
  run: async (args, apiKey): Promise<RunResult> => {
    const address = addressOf(args);
    const r = await nodeflareData("wallet-report", { address, chains: chainsFilter(args) }, apiKey);
    const summary = (r.summary ?? {}) as { chainsWithBalance?: number; tokenCount?: number };
    const holdings = Array.isArray(r.topHoldings) ? (r.topHoldings as Array<Record<string, unknown>>) : [];
    const top = holdings
      .slice(0, 5)
      .map((h) => `  ${h.symbol ?? "?"} on ${h.chain}: ${usd(h.usdValue)}`)
      .join("\n");
    const lines = [
      `Wallet ${address}: total ${usd(r.totalUsd)} across ${summary.chainsWithBalance ?? "?"} chains.`,
      top && `Top holdings:\n${top}`,
      r.note ? String(r.note) : "",
    ].filter(Boolean);
    return { text: lines.join("\n"), data: r };
  },
});

export const tokenSafetyAction = makeAction({
  name: "NODEFLARE_TOKEN_SAFETY",
  similes: ["TOKEN_SAFETY", "CHECK_TOKEN", "IS_HONEYPOT", "RUG_CHECK", "SCAM_CHECK", "TOKEN_RISK"],
  description:
    "Risk-check an ERC-20 token before trading it, on any supported chain. Returns metadata, whether ownership is renounced, risk signals and a rule-based score. Metadata + ownership are free; deep checks (holder concentration, honeypot/transfer simulation) need an API key or x402. Provide the token contract address and the chain.",
  examples: [
    example("Is token 0x… on Base a honeypot?", "Screening that token's safety.", "NODEFLARE_TOKEN_SAFETY"),
    example("Rug check 0x… on ethereum", "Running a token-safety check.", "NODEFLARE_TOKEN_SAFETY"),
  ],
  run: async (args, apiKey): Promise<RunResult> => {
    const chain = chainOf(args);
    const token = args.addresses[0];
    if (!token) throw new Error("Provide the ERC-20 contract address to screen.");
    const r = await nodeflareData("token-safety", { chain, token }, apiKey);
    const signals = Array.isArray(r.signals) ? (r.signals as string[]) : [];
    const lines = [
      `${r.name ?? "?"} (${r.symbol ?? "?"}) on ${chain} — safety score ${r.score ?? "?"}/100.`,
      `Contract: ${r.isContract ? "yes" : "no"}; ownership renounced: ${r.ownershipRenounced ? "yes" : "no"}.`,
      signals.length ? `Signals: ${signals.join("; ")}.` : "No risk signals flagged.",
      r.note ? String(r.note) : "",
    ].filter(Boolean);
    return { text: lines.join("\n"), data: r };
  },
});

export const balancesAction = makeAction({
  name: "NODEFLARE_BALANCES",
  similes: ["MULTICHAIN_BALANCES", "GET_BALANCES", "ALL_BALANCES", "CROSS_CHAIN_BALANCES", "TOKEN_HOLDINGS"],
  description:
    "Get native + ERC-20 token balances for one address across many of NodeFlare's 23 EVM chains in a single call — including young chains (Robinhood, Plasma, Ink) that Alchemy/Moralis omit. Add 'discover' to auto-find every token the address holds (needs an API key or x402). Defaults to all chains unless one is named.",
  examples: [
    example("What does 0xd8dA… hold across chains?", "Fetching multi-chain balances.", "NODEFLARE_BALANCES"),
    example("Discover all tokens 0x… holds on Robinhood", "Discovering held tokens.", "NODEFLARE_BALANCES"),
  ],
  run: async (args, apiKey): Promise<RunResult> => {
    const address = addressOf(args);
    const body: Record<string, unknown> = { address, chains: chainsFilter(args) };
    if (args.discover) body.discover = true;
    const r = await nodeflareData("balances", body, apiKey);
    const chains = Array.isArray(r.chains) ? (r.chains as Array<Record<string, unknown>>) : [];
    const withBal = chains.filter((c) => {
      const native = (c.native ?? {}) as { usd?: number; balance?: string };
      const tokens = Array.isArray(c.tokens) ? c.tokens : [];
      return Number(native.usd ?? 0) > 0 || Number(native.balance ?? 0) > 0 || tokens.length > 0;
    });
    const summary = withBal
      .map((c) => {
        const native = (c.native ?? {}) as { symbol?: string; balance?: string };
        const tokens = Array.isArray(c.tokens) ? (c.tokens as unknown[]) : [];
        return `  ${c.chain}: ${native.balance ?? "0"} ${native.symbol ?? ""}${tokens.length ? ` + ${tokens.length} token(s)` : ""}`;
      })
      .join("\n");
    return {
      text: `Balances for ${address} (${withBal.length} chain(s) with a balance):\n${summary || "  none found"}`,
      data: r,
    };
  },
});

export const portfolioAction = makeAction({
  name: "NODEFLARE_PORTFOLIO",
  similes: ["PORTFOLIO", "PORTFOLIO_VALUE", "NET_WORTH", "TOTAL_USD", "WALLET_VALUE"],
  description:
    "Get the USD portfolio value of an address across NodeFlare's 23 EVM chains: native balances priced in USD, a rolled-up total and a per-chain breakdown. Defaults to all chains unless one is named.",
  examples: [example("What's the total portfolio value of 0xd8dA…?", "Calculating the portfolio value.", "NODEFLARE_PORTFOLIO")],
  run: async (args, apiKey): Promise<RunResult> => {
    const address = addressOf(args);
    const r = await nodeflareData("portfolio", { address, chains: chainsFilter(args) }, apiKey);
    const chains = Array.isArray(r.chains) ? (r.chains as Array<Record<string, unknown>>) : [];
    const rows = chains
      .filter((c) => Number(c.usdValue ?? 0) > 0)
      .map((c) => `  ${c.chain}: ${usd(c.usdValue)}`)
      .join("\n");
    return { text: `Portfolio for ${address}: ${usd(r.totalUsd)} total.\n${rows}`.trim(), data: r };
  },
});

export const allowancesAction = makeAction({
  name: "NODEFLARE_ALLOWANCES",
  similes: ["ALLOWANCES", "APPROVALS", "REVOKE_RISK", "TOKEN_APPROVALS", "WHAT_CAN_SPEND"],
  description:
    "List the ERC-20 approvals a wallet has granted — which spenders can still move its funds, and how much — across NodeFlare's 23 EVM chains, including young chains other revoke tools skip. Unlimited approvals are flagged. Uses on-chain log scans, so it needs an API key or x402.",
  examples: [example("What approvals has 0xd8dA… granted?", "Scanning token approvals / revoke risk.", "NODEFLARE_ALLOWANCES")],
  run: async (args, apiKey): Promise<RunResult> => {
    const address = addressOf(args);
    const r = await nodeflareData("allowances", { address, chains: chainsFilter(args) }, apiKey);
    const approvals = Array.isArray(r.approvals) ? (r.approvals as Array<Record<string, unknown>>) : [];
    const rows = approvals
      .slice(0, 10)
      .map((a) => `  ${a.symbol ?? a.token} on ${a.chain} → spender ${a.spender}${a.unlimited ? " (UNLIMITED)" : ""}`)
      .join("\n");
    const head = `${address}: ${approvals.length} active approval(s)${approvals.some((a) => a.unlimited) ? ", some unlimited" : ""}.`;
    return { text: [head, rows, r.note ? String(r.note) : ""].filter(Boolean).join("\n"), data: r };
  },
});

export const simulateTxAction = makeAction({
  name: "NODEFLARE_SIMULATE_TX",
  similes: ["SIMULATE_TX", "PREFLIGHT_TX", "DRY_RUN_TX", "WILL_TX_REVERT", "SIMULATE_TRANSACTION"],
  description:
    "Pre-flight a transaction on any supported chain before broadcasting: will it revert (and why), how much gas, and which tokens/ETH move. Runs eth_call + gas estimation (free); asset-change tracing needs an API key or x402. Provide the target address; optionally calldata, value, and a from-address.",
  examples: [example("Simulate calling 0x… with data 0x… on Base", "Pre-flighting that transaction.", "NODEFLARE_SIMULATE_TX")],
  run: async (args, apiKey): Promise<RunResult> => {
    const chain = chainOf(args);
    const to = args.addresses[0];
    if (!to) throw new Error("Provide the target/contract address to simulate.");
    const body: Record<string, unknown> = { chain, to };
    if (args.data) body.data = args.data;
    if (args.value) body.value = args.value;
    if (args.from ?? args.addresses[1]) body.from = args.from ?? args.addresses[1];
    const r = await nodeflareData("simulate", body, apiKey);
    const verdict = r.willRevert ? `WILL REVERT${r.revertReason ? ` (${r.revertReason})` : ""}` : "succeeds";
    const lines = [
      `Simulation on ${chain}: ${verdict}.`,
      r.gas ? `Estimated gas: ${r.gas}.` : "",
      r.note ? String(r.note) : "",
    ].filter(Boolean);
    return { text: lines.join("\n"), data: r };
  },
});

export const dataActions = [
  walletReportAction,
  tokenSafetyAction,
  balancesAction,
  portfolioAction,
  allowancesAction,
  simulateTxAction,
];
