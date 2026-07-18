import type { Action, ActionExample, ActionResult } from "@elizaos/core";
import { argsFrom, type Extracted } from "./extract.js";

/** What an action's `run` returns: the text the agent speaks + structured data. */
export interface RunResult {
  text: string;
  data?: Record<string, unknown>;
}

export interface ActionSpec {
  name: string;
  similes: string[];
  description: string;
  examples: ActionExample[][];
  run: (args: Extracted, apiKey: string) => Promise<RunResult>;
}

/** Resolve the NodeFlare API key from runtime settings, then env. Empty ⇒ public tier. */
function resolveKey(runtime: unknown): string {
  const rt = runtime as { getSetting?: (k: string) => string | undefined | null };
  const fromRuntime = rt?.getSetting?.("NODEFLARE_API_KEY");
  return (fromRuntime || process.env.NODEFLARE_API_KEY || "").trim();
}

/**
 * Wrap a NodeFlare `run` in the ElizaOS Action contract. Every NodeFlare action
 * is read-only, so `validate` always passes and the LLM routes purely on
 * name/similes/description/examples. Args are extracted deterministically; the
 * handler never throws — failures come back as `{ success: false }` with a
 * human-readable message that the agent can relay.
 */
export function makeAction(spec: ActionSpec): Action {
  return {
    name: spec.name,
    similes: spec.similes,
    description: spec.description,
    examples: spec.examples,
    validate: async (): Promise<boolean> => true,
    handler: async (runtime, message, _state, options, callback): Promise<ActionResult> => {
      const apiKey = resolveKey(runtime);
      const args = argsFrom(message, options);
      try {
        const { text, data } = await spec.run(args, apiKey);
        await callback?.({ text });
        return { success: true, text, data };
      } catch (e) {
        const text = `NodeFlare (${spec.name}): ${(e as Error).message}`;
        await callback?.({ text });
        return { success: false, text, error: e as Error };
      }
    },
  };
}

/** Small helper to build a two-turn user→agent example. */
export function example(userText: string, agentText: string, action: string): ActionExample[] {
  return [
    { name: "{{user}}", content: { text: userText } },
    { name: "{{agent}}", content: { text: agentText, actions: [action] } },
  ];
}
