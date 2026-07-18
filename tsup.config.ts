import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // @elizaos/core is a peer; viem is bundled-safe but left external so the
  // host dedupes it. Both are resolved from the consuming agent.
  external: ["@elizaos/core", "viem"],
});
