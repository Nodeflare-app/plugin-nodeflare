// Thin fetch layer over NodeFlare's gateway. Everything here is read-only.
// Public tier needs no key; passing an nf_live_ key unlocks keyed RPC paths and
// heavy data methods (Authorization: Bearer on /data/*).
const GATEWAY = "https://rpc.nodeflare.app";
const TIMEOUT_MS = 12_000;
// Distinct UA so the gateway edge — which blocks empty / bare-"node" (undici
// default) User-Agents on the public tier as bot noise — keeps our keyless calls.
const UA = "plugin-nodeflare/0.1.2";

export interface JsonRpcCall {
  to: string;
  data: string;
}

function rpcUrl(slug: string, apiKey?: string): string {
  return apiKey ? `${GATEWAY}/${slug}/v1/${apiKey}` : `${GATEWAY}/${slug}/public`;
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { res, json };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error(`NodeFlare request timed out after ${TIMEOUT_MS / 1000}s`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** One JSON-RPC call. Public keyless by default; keyed when apiKey is given. */
export async function nodeflareRpc(slug: string, method: string, params: unknown[], apiKey?: string): Promise<unknown> {
  const { json } = (await postJson(rpcUrl(slug, apiKey), { jsonrpc: "2.0", id: 1, method, params })) as {
    json: { result?: unknown; error?: unknown; message?: string };
  };
  if (json.error !== undefined && json.error !== null) {
    // JSON-RPC errors are objects ({ message }); NodeFlare gateway errors
    // (rate limit, unknown chain, blocked method) are a flat string + `message`.
    const msg =
      typeof json.error === "string"
        ? json.message ?? json.error
        : (json.error as { message?: string }).message ?? "RPC error";
    throw new Error(msg);
  }
  return json.result;
}

/**
 * Several eth_calls in ONE JSON-RPC batch — a single rate-limit token, so
 * multi-read actions (token balance/metadata) don't trip the per-IP public
 * limit the way N concurrent calls would. Returns result hex per call (null on
 * a per-call error).
 */
export async function ethCallBatch(slug: string, calls: JsonRpcCall[], apiKey?: string): Promise<(string | null)[]> {
  const batch = calls.map((c, i) => ({ jsonrpc: "2.0", id: i, method: "eth_call", params: [c, "latest"] }));
  const { res, json } = (await postJson(rpcUrl(slug, apiKey), batch)) as {
    res: Response;
    json: unknown;
  };
  if (!Array.isArray(json)) {
    const e = json as { error?: unknown; message?: string };
    throw new Error(e.message ?? (typeof e.error === "string" ? e.error : `batch request failed (HTTP ${res.status})`));
  }
  const byId = new Map((json as Array<{ id: number; result?: unknown; error?: unknown }>).map((r) => [r.id, r]));
  return calls.map((_, i) => {
    const r = byId.get(i);
    return r && !r.error && typeof r.result === "string" ? r.result : null;
  });
}

/**
 * POST to a NodeFlare agent-intelligence data endpoint (/data/{name}). Public
 * tier returns the light result; an nf_live_ key (Authorization: Bearer) returns
 * the full/heavy result and is billed per the plan.
 */
export async function nodeflareData(name: string, body: unknown, apiKey?: string): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const { res, json } = (await postJson(`${GATEWAY}/data/${name}`, body, headers)) as {
    res: Response;
    json: Record<string, unknown>;
  };
  if (res.status === 402) {
    throw new Error(
      "This is a heavy method — set NODEFLARE_API_KEY (free at nodeflare.app/sign-up) for full results, or pay per call over x402.",
    );
  }
  if (!res.ok) {
    const msg = (json.message as string) ?? (typeof json.error === "string" ? json.error : `request failed (HTTP ${res.status})`);
    throw new Error(msg);
  }
  return json;
}
