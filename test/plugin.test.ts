import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  nodeflarePlugin,
  resolveChain,
  CHAINS,
  chainsProvider,
  walletReportAction,
  tokenSafetyAction,
  balancesAction,
  allowancesAction,
  simulateTxAction,
  portfolioAction,
  listChainsAction,
  blockNumberAction,
  gasPriceAction,
  getTransactionAction,
  nativeBalanceAction,
  erc20BalanceAction,
  tokenMetadataAction,
  rpcQueryAction,
} from "../src/index.js";
import { argsFrom } from "../src/extract.js";

const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TXHASH = "0x" + "a".repeat(64);

// ── fetch mock ────────────────────────────────────────────────────────────────
let calls: { url: string; init: RequestInit }[] = [];
let responder: (url: string, body: unknown) => { status?: number; body: unknown };

function mockFetch() {
  return vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const { status = 200, body: out } = responder(url, body);
    return { ok: status >= 200 && status < 300, status, json: async () => out } as unknown as Response;
  });
}

beforeEach(() => {
  calls = [];
  responder = () => ({ body: { result: "0x0" } });
  vi.stubGlobal("fetch", mockFetch());
  delete process.env.NODEFLARE_API_KEY;
});
afterEach(() => vi.unstubAllGlobals());

const cb = vi.fn(async () => []);
const run = (action: (typeof nodeflarePlugin.actions)[number], text: string, opts: Record<string, unknown> = {}, runtime: unknown = {}) =>
  action.handler(runtime as never, { content: { text } } as never, undefined as never, opts as never, cb as never);
const lastUrl = () => calls[calls.length - 1]!.url;
const lastBody = () => JSON.parse(calls[calls.length - 1]!.init.body as string);
const lastHeaders = () => (calls[calls.length - 1]!.init.headers ?? {}) as Record<string, string>;

// ── plugin shape ──────────────────────────────────────────────────────────────
describe("plugin", () => {
  it("exposes 14 actions + a provider with no duplicate names", () => {
    expect(nodeflarePlugin.name).toBe("nodeflare");
    expect(nodeflarePlugin.actions).toHaveLength(14);
    expect(nodeflarePlugin.providers).toHaveLength(1);
    const names = nodeflarePlugin.actions!.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it("every action validates true and has description + examples", async () => {
    for (const a of nodeflarePlugin.actions!) {
      expect(await a.validate({} as never, {} as never)).toBe(true);
      expect(a.description.length).toBeGreaterThan(20);
      expect(Array.isArray(a.examples)).toBe(true);
    }
  });
});

// ── resolveChain ──────────────────────────────────────────────────────────────
describe("resolveChain", () => {
  it("resolves slug, alias, name and chain id", () => {
    expect(resolveChain("base")).toBe("base");
    expect(resolveChain("ethereum")).toBe("eth");
    expect(resolveChain("bsc")).toBe("bnb");
    expect(resolveChain("8453")).toBe("base");
    expect(resolveChain("4663")).toBe("robinhood");
    expect(resolveChain("0x2105")).toBe("base");
    expect(resolveChain("nope")).toBeNull();
  });
  it("covers all 23 chains", () => {
    expect(Object.keys(CHAINS)).toHaveLength(23);
  });
});

// ── extraction ────────────────────────────────────────────────────────────────
describe("argsFrom", () => {
  it("pulls a tx hash before addresses (no 40-hex-of-hash confusion)", () => {
    const a = argsFrom({ content: { text: `look up ${TXHASH} on base` } });
    expect(a.hash).toBe(TXHASH);
    expect(a.addresses).toHaveLength(0);
    expect(a.chain).toBe("base");
  });
  it("pulls addresses in order and a chain from text", () => {
    const a = argsFrom({ content: { text: `balance of ${VITALIK} on arbitrum` } });
    expect(a.addresses[0]).toBe(VITALIK);
    expect(a.chain).toBe("arb");
  });
  it("does not resolve a bare number as a chain", () => {
    const a = argsFrom({ content: { text: `check 1 token for ${VITALIK}` } });
    expect(a.chain).toBeUndefined();
  });
  it("prefers structured options and accepts numeric chain ids there", () => {
    const a = argsFrom({ content: { text: "hi" } }, { chain: "8453", token: USDC_BASE });
    expect(a.chain).toBe("base");
    expect(a.addresses[0]).toBe(USDC_BASE);
  });
  it("detects discovery intent", () => {
    expect(argsFrom({ content: { text: "discover all tokens for x" } }).discover).toBe(true);
    expect(argsFrom({ content: { text: "balances" } }).discover).toBe(false);
  });
});

// ── RPC actions ───────────────────────────────────────────────────────────────
describe("rpc actions", () => {
  it("block number hits the public endpoint and formats", async () => {
    responder = () => ({ body: { result: "0x10" } });
    const r = await run(blockNumberAction, "latest block on base");
    expect(lastUrl()).toBe("https://rpc.nodeflare.app/base/public");
    expect(lastBody().method).toBe("eth_blockNumber");
    expect(r.success).toBe(true);
    expect(r.text).toContain("16");
  });
  it("gas price formats gwei", async () => {
    responder = () => ({ body: { result: "0x3b9aca00" } }); // 1e9 wei = 1 gwei
    const r = await run(gasPriceAction, "gas on arbitrum");
    expect(r.text).toContain("1 gwei");
  });
  it("missing chain returns a helpful failure, not a throw", async () => {
    const r = await run(blockNumberAction, "latest block");
    expect(r.success).toBe(false);
    expect(r.text).toContain("Which chain");
  });
  it("get_transaction reads by hash", async () => {
    responder = () => ({ body: { result: { from: "0x1", to: "0x2", value: "0x0", blockNumber: "0x5" } } });
    const r = await run(getTransactionAction, `tx ${TXHASH} on op`);
    expect(lastBody().params[0]).toBe(TXHASH);
    expect(r.text).toContain("block 5");
  });
  it("native balance formats 18-dec", async () => {
    responder = () => ({ body: { result: "0xde0b6b3a7640000" } }); // 1e18
    const r = await run(nativeBalanceAction, `balance of ${VITALIK} on ethereum`);
    expect(r.text).toContain("1 ETH");
  });
  it("rpc_query rejects state-changing methods (read-only)", async () => {
    const r = await run(rpcQueryAction, "call on base", { method: "eth_sendRawTransaction", params: ["0x02"] });
    expect(r.success).toBe(false);
    expect(r.text).toMatch(/read-only/i);
    expect(calls).toHaveLength(0); // never hit the network
  });
  it("rpc_query allows read methods", async () => {
    responder = () => ({ body: { result: "0xabc" } });
    const r = await run(rpcQueryAction, "call on base", { method: "eth_getCode", params: ["0x1", "latest"] });
    expect(r.success).toBe(true);
    expect(lastBody().method).toBe("eth_getCode");
  });
  it("erc20 balance batches calls and decodes", async () => {
    // balanceOf=1e6, decimals=6, symbol="USDC"
    responder = () => ({
      body: [
        { id: 0, result: "0x" + (10n ** 6n).toString(16).padStart(64, "0") },
        { id: 1, result: "0x" + (6).toString(16).padStart(64, "0") },
        { id: 2, result: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000455534443" + "0".repeat(56) },
      ],
    });
    const r = await run(erc20BalanceAction, `usdc ${USDC_BASE} held by ${VITALIK} on base`);
    expect(Array.isArray(lastBody())).toBe(true);
    expect(r.text).toContain("1 USDC");
  });
  it("list_chains needs no network", async () => {
    const r = await run(listChainsAction, "which chains");
    expect(calls).toHaveLength(0);
    expect(r.text).toContain("23 EVM chains");
  });
});

// ── data actions ──────────────────────────────────────────────────────────────
describe("data actions", () => {
  it("wallet report posts to /data/wallet-report and summarises", async () => {
    responder = () => ({ body: { address: VITALIK, totalUsd: 18963.58, summary: { chainsWithBalance: 21 }, topHoldings: [{ chain: "eth", symbol: "ETH", usdValue: 12326.55 }] } });
    const r = await run(walletReportAction, `report on ${VITALIK}`);
    expect(lastUrl()).toBe("https://rpc.nodeflare.app/data/wallet-report");
    expect(lastBody().address).toBe(VITALIK);
    expect(r.text).toContain("$18,963.58");
  });
  it("token safety posts chain+token and shows score", async () => {
    responder = () => ({ body: { name: "USD Coin", symbol: "USDC", score: 20, isContract: true, ownershipRenounced: false, signals: ["ownership not renounced"], note: "deep checks need x402" } });
    const r = await run(tokenSafetyAction, `is ${USDC_BASE} on base a honeypot`);
    expect(lastUrl()).toBe("https://rpc.nodeflare.app/data/token-safety");
    expect(lastBody()).toEqual({ chain: "base", token: USDC_BASE });
    expect(r.text).toContain("score 20");
  });
  it("balances scopes to a named chain and can request discovery", async () => {
    responder = () => ({ body: { address: VITALIK, chains: [{ chain: "robinhood", native: { symbol: "ETH", balance: "1.0", usd: 3000 }, tokens: [{}, {}] }] } });
    const r = await run(balancesAction, `discover all tokens ${VITALIK} holds on robinhood`);
    expect(lastBody().chains).toEqual(["robinhood"]);
    expect(lastBody().discover).toBe(true);
    expect(r.text).toContain("robinhood");
  });
  it("simulate posts chain+to+optional fields", async () => {
    responder = () => ({ body: { willRevert: false, gas: "21000" } });
    const r = await run(simulateTxAction, `simulate calling ${USDC_BASE} on base`, { data: "0x1234", value: "0x0" });
    expect(lastBody()).toMatchObject({ chain: "base", to: USDC_BASE, data: "0x1234" });
    expect(r.text).toContain("succeeds");
  });
});

// ── auth tiering ──────────────────────────────────────────────────────────────
describe("auth", () => {
  const KEY = "nf_live_" + "0".repeat(64);
  it("no key ⇒ public URL, no Authorization header", async () => {
    responder = () => ({ body: { result: "0x1" } });
    await run(blockNumberAction, "block on base");
    expect(lastUrl()).toContain("/base/public");
    expect(lastHeaders().Authorization).toBeUndefined();
  });
  it("runtime key ⇒ keyed RPC URL", async () => {
    responder = () => ({ body: { result: "0x1" } });
    await run(blockNumberAction, "block on base", {}, { getSetting: (k: string) => (k === "NODEFLARE_API_KEY" ? KEY : undefined) });
    expect(lastUrl()).toBe(`https://rpc.nodeflare.app/base/v1/${KEY}`);
  });
  it("key ⇒ Bearer header on data endpoints", async () => {
    responder = () => ({ body: { totalUsd: 0, summary: {}, topHoldings: [] } });
    await run(walletReportAction, `report ${VITALIK}`, {}, { getSetting: () => KEY });
    expect(lastHeaders().Authorization).toBe(`Bearer ${KEY}`);
  });
  it("402 without key ⇒ friendly upsell message", async () => {
    responder = () => ({ status: 402, body: { error: "payment required" } });
    const r = await run(allowancesAction, `approvals for ${VITALIK}`);
    expect(r.success).toBe(false);
    expect(r.text).toMatch(/NODEFLARE_API_KEY|x402/);
  });
});

// ── provider ──────────────────────────────────────────────────────────────────
describe("chainsProvider", () => {
  it("returns the chain list as context", async () => {
    const res = await chainsProvider.get({} as never, {} as never, {} as never);
    expect(res.text).toContain("23 EVM chains");
    expect(res.text).toContain("robinhood");
  });
});
