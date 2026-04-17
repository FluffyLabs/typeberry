/**
 * Test vectors from the jam-conformance 0.7.2 suite that fail intermittently
 * under bun's wasm runtime but pass under Node.js.
 *
 * These are all "heavy" test vectors (large state, epoch boundaries, many
 * wasm invocations) that expose known bugs in bun 1.3.12:
 *   - https://github.com/oven-sh/bun/issues/26366 (JSC wasm OSR/JIT)
 *   - https://github.com/oven-sh/bun/issues/15879 (wasm crashes)
 *
 * The main `jam-conformance-072.ts` suite excludes these tests so CI stays
 * green. `jam-conformance-072-flaky.ts` runs them with continue-on-error.
 * Revisit and remove entries when bun ships fixes for the underlying bugs.
 */
export const FLAKY_ON_BUN = [
  "1766243315_2078/00000118.json",
  "1766243315_2078/00000121.json",
  "1766243315_9206/00001064.json",
  "1766243861_9909/00000242.json",
  "1766255635_2170/00000052.json",
  "1767827127_1243/00404396.json",
  "1767827127_1243/00404397.json",
  "1767827127_1243/00404398.json",
  "1767827127_1243/00404399.json",
  "1767827127_2328/00166439.json",
  "1767871405_1773/00000359.json",
  "1767872928_1988/00012584.json",
  "1767889897_2906/00000050.json",
  "1767889897_5940/00000354.json",
  "1767891325_5123/00000200.json",
  "1767895984_4240/00002169.json",
  "1767896003_2013/00036067.json",
  "1767896003_7458/00000654.json",
  "1767896003_9191/00000207.json",
  "1767896003_9191/00000208.json",
  "1767896003_9191/00000210.json",
  "1768067197_6472/00000011.json",
];
