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

// Sharding: run the suite as N parallel bun processes. Each process only picks
// up a subset of test directories (see `BUN_TEST_SHARD` handling in common.ts).
// This works around JSC's habit of under-counting WebAssembly.Memory for GC
// pressure — when a single bun process runs 1000+ tests, stale wasm instances
// pile up until the JS heap hits `RangeError: Out of memory`. Splitting the
// work into fresh short-lived processes makes each process's peak heap small
// enough to stay well under the OOM threshold.
//
// `--smol` on each shard keeps per-process memory low. Override shard count via
// `BUN_TEST_SHARDS=N` (default 4). Set `BUN_TEST_SHARDS=1` to run in a single
// process (useful when debugging a specific test with a name filter).
const shardCount = Math.max(1, Number.parseInt(process.env.BUN_TEST_SHARDS ?? "4", 10));
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

const procs = Array.from({ length: shardCount }, (_, i) => runShard(i + 1));
const exitCodes = await Promise.all(procs.map((p) => p.exited));
const exitCode = exitCodes.some((c) => c !== 0) ? 1 : 0;

const status = exitCode === 0 ? "OK" : "FAILED";
const shardStatuses = exitCodes
  .map((c, i) => `  shard ${i + 1}/${shardCount}: ${c === 0 ? "OK" : "FAILED"}`)
  .join("\n");
fs.writeFileSync(outputFile, `### ${suiteToRun} ${status}\n${shardStatuses}\n`);

process.exit(exitCode);
