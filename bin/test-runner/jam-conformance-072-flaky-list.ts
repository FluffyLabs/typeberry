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
  "1768066437_6431/00000011.json",
  "1768067197_6472/00000011.json",
  // Heavy early dirs of shard 8/8 that drive cumulative JSC/wasm memory past
  // the crash threshold before shard 8 finishes. CI crashes have landed at
  // dir 12 (1766479507_7734) and dir 14 (1766565819_9942) of shard 8; these
  // are the heaviest dirs (by post-state size) in shard 8's first 11 slots.
  "1766243113/00000054.json",
  "1766243113/00000055.json",
  "1766243113/00000056.json",
  "1766243113/00000057.json",
  "1766243113/00000058.json",
  "1766243493_2605/00000030.json",
  "1766243493_2605/00000031.json",
  "1766243861_8319/00000115.json",
  "1766243861_8319/00000116.json",
  "1766243861_8319/00000117.json",
  "1766243861_8319/00000118.json",
  "1766243861_8319/00000119.json",
  "1766244251_1244/00000120.json",
  "1766244251_1244/00000122.json",
  "1766244251_1244/00000124.json",
  "1766255635_3673/00000081.json",
  "1766255635_3673/00000082.json",
  "1766255635_3673/00000083.json",
  "1766255635_3673/00000084.json",
];
