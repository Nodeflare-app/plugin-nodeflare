import { resolveChain } from "./chains.js";

/** Structured params some ElizaOS flows attach to an action call. */
export interface Options {
  chain?: unknown;
  token?: unknown;
  address?: unknown;
  hash?: unknown;
  method?: unknown;
  params?: unknown;
  value?: unknown;
  data?: unknown;
  from?: unknown;
  discover?: unknown;
  [k: string]: unknown;
}

export interface Extracted {
  text: string;
  chain?: string; // resolved slug
  addresses: string[]; // 0x…40-hex, in message order (structured first)
  hash?: string; // 0x…64-hex
  method?: string;
  params?: unknown[];
  value?: string;
  data?: string;
  from?: string;
  discover: boolean;
}

const ADDR = /0x[0-9a-fA-F]{40}\b/g;
const HASH = /0x[0-9a-fA-F]{64}\b/g;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;
const isAddr = (s?: string): s is string => !!s && /^0x[0-9a-fA-F]{40}$/.test(s);
const isHash = (s?: string): s is string => !!s && /^0x[0-9a-fA-F]{64}$/.test(s);

/**
 * Deterministically pull args from an ElizaOS message + optional structured
 * options. No inner LLM call: structured fields win, then the message text is
 * parsed. Hashes are matched (and masked) before addresses so a tx hash's first
 * 40 hex chars aren't mistaken for an address. Chain scanning skips bare numbers
 * (so "check 1 token" doesn't resolve to chainId 1); numeric chain IDs come via
 * the structured `chain` field.
 */
export function argsFrom(message: unknown, options?: unknown): Extracted {
  const msg = (message ?? {}) as { content?: { text?: unknown; [k: string]: unknown } };
  const opt = { ...(msg.content ?? {}), ...((options as Options) ?? {}) } as Options;
  const text = str(opt.text) ?? str(msg.content?.text) ?? "";

  // Hashes first, then mask them out of the address scan.
  const hashes = [...text.matchAll(HASH)].map((m) => m[0]);
  let rest = text;
  for (const h of hashes) rest = rest.split(h).join(" ");

  const addresses: string[] = [];
  const pushAddr = (a?: string) => {
    if (isAddr(a) && !addresses.some((x) => x.toLowerCase() === a.toLowerCase())) addresses.push(a);
  };
  pushAddr(str(opt.token));
  pushAddr(str(opt.address));
  pushAddr(str(opt.from));
  for (const m of rest.matchAll(ADDR)) pushAddr(m[0]);

  const hash = (isHash(str(opt.hash)) ? str(opt.hash) : undefined) ?? hashes[0];

  // Chain: structured first (accepts numeric IDs), else scan non-numeric tokens.
  let chain: string | undefined;
  const sChain = str(opt.chain);
  if (sChain) chain = resolveChain(sChain) ?? undefined;
  if (!chain) {
    for (const tok of text.split(/[^a-z0-9-]+/i)) {
      if (!tok || /^\d+$/.test(tok)) continue;
      const r = resolveChain(tok);
      if (r) {
        chain = r;
        break;
      }
    }
  }

  return {
    text,
    chain,
    addresses,
    hash,
    method: str(opt.method),
    params: Array.isArray(opt.params) ? opt.params : undefined,
    value: str(opt.value),
    data: str(opt.data),
    from: isAddr(str(opt.from)) ? str(opt.from) : undefined,
    discover: opt.discover === true || /\bdiscover|find (all )?tokens|which tokens\b/i.test(text),
  };
}
