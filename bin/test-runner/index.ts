import fs from "node:fs";

const distDir = `${import.meta.dirname}/../../dist`;
try {
  fs.mkdirSync(distDir);
} catch {
  // ignore
}

const suiteToRun = process.argv[2];
if (suiteToRun === undefined) {
  throw new Error("Provide 1 argument with a suite filename to run.");
}

const suitePath = `${import.meta.dirname}/${suiteToRun}`;
const outputFile = `${distDir}/${suiteToRun.replace(".ts", "")}.txt`;

// Sharding: run the suite as N bun processes. Each process only picks up a
// subset of test directories (see `BUN_TEST_SHARD` handling in common.ts).
// This works around JSC's habit of under-counting WebAssembly.Memory for GC
// pressure — when a single bun process runs 1000+ tests, stale wasm instances
// pile up until the JS heap hits `RangeError: Out of memory`. Splitting the
// work into fresh short-lived processes makes each process's peak heap small
// enough to stay well under the OOM threshold.
//
// `--smol` on each shard keeps per-process memory low.
//
// Env knobs:
//   BUN_TEST_SHARDS=N         total shards (default 4). Use 1 to disable sharding
//                             (useful when debugging a specific test with --test-name-pattern).
//   BUN_TEST_CONCURRENCY=N    how many shards may run at once (default = shard count,
//                             i.e. fully parallel). On memory-constrained runners set this
//                             lower, e.g. =1 for strictly sequential execution.
//   BUN_TEST_SHARD_DELAY_MS=N delay in ms between shard batches (default 0). On
//                             self-hosted runners a small delay (~2–5s) gives the
//                             kernel time to reclaim pages before the next shard
//                             mmaps — without it the last shard sometimes hits
//                             `mprotect failed: Cannot allocate memory`.
const shardCount = Math.max(1, Number.parseInt(process.env.BUN_TEST_SHARDS ?? "4", 10));
const concurrency = Math.max(
  1,
  Math.min(shardCount, Number.parseInt(process.env.BUN_TEST_CONCURRENCY ?? `${shardCount}`, 10)),
);
const shardDelayMs = Math.max(0, Number.parseInt(process.env.BUN_TEST_SHARD_DELAY_MS ?? "0", 10));
const forwardedArgs = process.argv.slice(3);

const runShard = (shard: number) =>
  Bun.spawn(["bun", "--smol", "test", suitePath, "--timeout", "300000", ...forwardedArgs], {
    cwd: import.meta.dirname,
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      ...(shardCount > 1 ? { BUN_TEST_SHARD: `${shard}/${shardCount}` } : {}),
    },
  });

const exitCodes: number[] = new Array(shardCount);
// Execute shards in rolling batches of `concurrency` processes.
for (let i = 0; i < shardCount; i += concurrency) {
  const batchSize = Math.min(concurrency, shardCount - i);
  const procs = Array.from({ length: batchSize }, (_, j) => runShard(i + j + 1));
  const batchCodes = await Promise.all(procs.map((p) => p.exited));
  for (let j = 0; j < batchSize; j++) {
    exitCodes[i + j] = batchCodes[j];
  }
  // Give the kernel a chance to reclaim the child's pages before the next batch.
  const moreBatches = i + batchSize < shardCount;
  if (moreBatches && shardDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, shardDelayMs));
  }
}
const exitCode = exitCodes.some((c) => c !== 0) ? 1 : 0;

const status = exitCode === 0 ? "OK" : "FAILED";
const shardStatuses = exitCodes
  .map((c, i) => `  shard ${i + 1}/${shardCount}: ${c === 0 ? "OK" : "FAILED"}`)
  .join("\n");
fs.writeFileSync(outputFile, `### ${suiteToRun} ${status}\n${shardStatuses}\n`);

process.exit(exitCode);
