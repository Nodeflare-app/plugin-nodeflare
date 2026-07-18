import { makeAction, example, type RunResult } from "../action.js";
import { CHAINS, SLUGS } from "../chains.js";
import { nodeflareRpc, ethCallBatch } from "../gateway.js";
import { readErc20, decodeUint, decodeDecimals, decodeStr, formatUnits } from "../erc20.js";
import type { Extracted } from "../extract.js";

function chainOf(args: Extracted): string {
  if (!args.chain) throw new Error(`Which chain? One of: ${SLUGS.join(", ")}.`);
  return args.chain;
}

// Methods that sign or broadcast — rejected: this plugin is read-only.
const WRITE_RE = /^(eth_sendtransaction|eth_sendrawtransaction|eth_sign|eth_signtypeddata|personal_)/i;

export const listChainsAction = makeAction({
  name: "NODEFLARE_LIST_CHAINS",
  similes: ["LIST_CHAINS", "SUPPORTED_CHAINS", "WHICH_CHAINS", "NODEFLARE_CHAINS"],
  description:
    "List the 23 EVM chains NodeFlare serves, with chain IDs and native currencies — including young chains (Robinhood, Plasma, Ink, Zircuit) most providers skip. Use to discover valid `chain` values.",
  examples: [
    example("Which chains does NodeFlare support?", "NodeFlare serves 23 EVM chains — here they are.", "NODEFLARE_LIST_CHAINS"),
    example("Do you support Robinhood Chain?", "Let me list the supported chains.", "NODEFLARE_LIST_CHAINS"),
  ],
  run: async (): Promise<RunResult> => {
    const rows = Object.entries(CHAINS).map(([slug, c]) => `${slug} — ${c.label} (chainId ${c.chainId}, ${c.currency})`);
    return { text: `NodeFlare serves ${rows.length} EVM chains:\n${rows.join("\n")}`, data: { chains: CHAINS } };
  },
});

export const blockNumberAction = makeAction({
  name: "NODEFLARE_BLOCK_NUMBER",
  similes: ["BLOCK_NUMBER", "LATEST_BLOCK", "CURRENT_BLOCK", "BLOCK_HEIGHT"],
  description: "Get the latest block number on any supported EVM chain.",
  examples: [example("What's the latest block on Base?", "Checking Base's latest block.", "NODEFLARE_BLOCK_NUMBER")],
  run: async (args, apiKey): Promise<RunResult> => {
    const slug = chainOf(args);
    const hex = (await nodeflareRpc(slug, "eth_blockNumber", [], apiKey)) as string;
    const n = parseInt(hex, 16);
    return { text: `${CHAINS[slug]!.label} latest block: ${n} (${hex})`, data: { chain: slug, block: n } };
  },
});

export const gasPriceAction = makeAction({
  name: "NODEFLARE_GAS_PRICE",
  similes: ["GAS_PRICE", "CURRENT_GAS", "GAS_FEE"],
  description: "Get the current gas price on any supported EVM chain, in gwei.",
  examples: [example("How much is gas on Arbitrum right now?", "Fetching Arbitrum gas price.", "NODEFLARE_GAS_PRICE")],
  run: async (args, apiKey): Promise<RunResult> => {
    const slug = chainOf(args);
    const hex = (await nodeflareRpc(slug, "eth_gasPrice", [], apiKey)) as string;
    const gwei = formatUnits(BigInt(hex), 9);
    return { text: `${CHAINS[slug]!.label} gas price: ${gwei} gwei`, data: { chain: slug, gwei } };
  },
});

export const getTransactionAction = makeAction({
  name: "NODEFLARE_GET_TRANSACTION",
  similes: ["GET_TRANSACTION", "LOOKUP_TX", "TX_DETAILS", "TRANSACTION_INFO"],
  description: "Look up a transaction by its 0x hash on any supported EVM chain (from, to, value, block).",
  examples: [example("Look up tx 0xabc… on Optimism", "Fetching that transaction.", "NODEFLARE_GET_TRANSACTION")],
  run: async (args, apiKey): Promise<RunResult> => {
    const slug = chainOf(args);
    if (!args.hash) throw new Error("Provide a 0x transaction hash (66 chars).");
    const tx = (await nodeflareRpc(slug, "eth_getTransactionByHash", [args.hash], apiKey)) as Record<string, string> | null;
    if (!tx) return { text: `Transaction ${args.hash} not found on ${CHAINS[slug]!.label}.`, data: { found: false } };
    const value = tx.value ? formatUnits(BigInt(tx.value), 18) : "0";
    const block = tx.blockNumber ? parseInt(tx.blockNumber, 16) : "pending";
    return {
      text: `Tx ${args.hash} on ${CHAINS[slug]!.label}: from ${tx.from} to ${tx.to} value ${value} ${CHAINS[slug]!.currency}, block ${block}`,
      data: { chain: slug, tx },
    };
  },
});

export const nativeBalanceAction = makeAction({
  name: "NODEFLARE_NATIVE_BALANCE",
  similes: ["NATIVE_BALANCE", "ETH_BALANCE", "GAS_BALANCE", "GET_BALANCE"],
  description: "Get the native gas-token balance of an address on ONE supported EVM chain (e.g. ETH, BNB, POL, SEI).",
  examples: [example("What's the ETH balance of 0xd8dA… on mainnet?", "Checking that native balance.", "NODEFLARE_NATIVE_BALANCE")],
  run: async (args, apiKey): Promise<RunResult> => {
    const slug = chainOf(args);
    const address = args.addresses[0];
    if (!address) throw new Error("Provide a 0x address to check.");
    const hex = (await nodeflareRpc(slug, "eth_getBalance", [address, "latest"], apiKey)) as string;
    const bal = formatUnits(BigInt(hex), 18);
    return { text: `${address} on ${CHAINS[slug]!.label}: ${bal} ${CHAINS[slug]!.currency}`, data: { chain: slug, address, balance: bal } };
  },
});

export const erc20BalanceAction = makeAction({
  name: "NODEFLARE_ERC20_BALANCE",
  similes: ["ERC20_BALANCE", "TOKEN_BALANCE", "GET_TOKEN_BALANCE"],
  description:
    "Read an ERC-20 token balance for a holder on ONE supported EVM chain. Provide the token contract address FIRST, then the holder address.",
  examples: [example("How much USDC (0x8335…) does 0xd8dA… hold on Base?", "Reading that token balance.", "NODEFLARE_ERC20_BALANCE")],
  run: async (args, apiKey): Promise<RunResult> => {
    const slug = chainOf(args);
    const [token, holder] = args.addresses;
    if (!token || !holder) throw new Error("Provide two 0x addresses: the token contract first, then the holder.");
    const [balHex, decHex, symHex] = await ethCallBatch(
      slug,
      [readErc20(token, "balanceOf", [holder]), readErc20(token, "decimals"), readErc20(token, "symbol")],
      apiKey,
    );
    if (!balHex) throw new Error(`Could not read balance — check the token address on ${CHAINS[slug]!.label}.`);
    const bal = formatUnits(decodeUint(balHex, "balanceOf"), decodeDecimals(decHex));
    const sym = decodeStr(symHex, "symbol");
    return { text: `${holder} holds ${bal} ${sym} (${token}) on ${CHAINS[slug]!.label}`, data: { chain: slug, token, holder, balance: bal, symbol: sym } };
  },
});

export const tokenMetadataAction = makeAction({
  name: "NODEFLARE_TOKEN_METADATA",
  similes: ["TOKEN_METADATA", "TOKEN_INFO", "ERC20_INFO"],
  description: "Read ERC-20 token metadata (name, symbol, decimals, total supply) on ONE supported EVM chain.",
  examples: [example("What token is 0x8335… on Base?", "Reading that token's metadata.", "NODEFLARE_TOKEN_METADATA")],
  run: async (args, apiKey): Promise<RunResult> => {
    const slug = chainOf(args);
    const token = args.addresses[0];
    if (!token) throw new Error("Provide the ERC-20 contract address.");
    const [nameHex, symHex, decHex, supHex] = await ethCallBatch(
      slug,
      [readErc20(token, "name"), readErc20(token, "symbol"), readErc20(token, "decimals"), readErc20(token, "totalSupply")],
      apiKey,
    );
    if (!decHex && !supHex) throw new Error(`Not an ERC-20, or unreachable — check the address on ${CHAINS[slug]!.label}.`);
    const dec = decodeDecimals(decHex);
    const supply = supHex ? formatUnits(decodeUint(supHex, "totalSupply"), dec) : "?";
    const name = decodeStr(nameHex, "name");
    const symbol = decodeStr(symHex, "symbol");
    return {
      text: `${name} (${symbol}) on ${CHAINS[slug]!.label}: ${dec} decimals, total supply ${supply}`,
      data: { chain: slug, token, name, symbol, decimals: dec, totalSupply: supply },
    };
  },
});

export const rpcQueryAction = makeAction({
  name: "NODEFLARE_RPC_QUERY",
  similes: ["RPC_QUERY", "JSON_RPC", "RAW_RPC", "ETH_CALL_RAW"],
  description:
    "Make an arbitrary READ-ONLY JSON-RPC call on any supported EVM chain (e.g. eth_call, eth_getCode, eth_getLogs). State-changing methods (eth_sendRawTransaction, eth_sign…) are rejected — this plugin never signs or broadcasts.",
  examples: [example("Call eth_getCode for 0x… on Base", "Running that JSON-RPC read.", "NODEFLARE_RPC_QUERY")],
  run: async (args, apiKey): Promise<RunResult> => {
    const slug = chainOf(args);
    if (!args.method) throw new Error("Provide a JSON-RPC method name (e.g. eth_getCode).");
    if (WRITE_RE.test(args.method)) throw new Error(`'${args.method}' signs or broadcasts — this plugin is read-only.`);
    const result = await nodeflareRpc(slug, args.method, args.params ?? [], apiKey);
    return { text: `${args.method} on ${CHAINS[slug]!.label}: ${JSON.stringify(result)}`, data: { chain: slug, method: args.method, result } };
  },
});

export const rpcActions = [
  listChainsAction,
  blockNumberAction,
  gasPriceAction,
  getTransactionAction,
  nativeBalanceAction,
  erc20BalanceAction,
  tokenMetadataAction,
  rpcQueryAction,
];
