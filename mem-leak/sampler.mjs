/**
 * RSS / heap sampler, injected into the typeberry fuzz-target via
 *   NODE_OPTIONS="--import=file:///out/sampler.mjs --expose-gc"
 *
 * It runs inside the target process (so it sees the *real* numbers) and does
 * two things:
 *
 *   1. Every SAMPLE_SEC seconds, append one row of memory stats to
 *      $MEM_OUT_DIR/mem.csv. This is the primary artifact: it tells you whether
 *      RSS growth lives in the JS heap (heapUsed) or outside it (rss - heapUsed:
 *      LMDB mmap, native, WASM linear memory). A heap snapshot can only ever
 *      explain the heapUsed part.
 *
 *   2. On SIGUSR2, run a full GC and write a V8 heap snapshot to
 *      $MEM_OUT_DIR/<label>.heapsnapshot. The first signal is labelled
 *      "baseline", the second "after", any further ones "snap-N". Load baseline
 *      + after in Chrome DevTools > Memory > Comparison to see which
 *      constructors retained objects across the run.
 *
 * Throwaway debug tool, mirrors mem-leak/run.sh. NOT part of the committed tree.
 */
import fs from "node:fs";
import v8 from "node:v8";

const OUT = process.env.MEM_OUT_DIR ?? "/out";
const SAMPLE_SEC = Number(process.env.SAMPLE_SEC) || 5;
const CSV = `${OUT}/mem.csv`;

const HEADER =
  "ts,iso,rss,heapTotal,heapUsed,external,arrayBuffers,mallocedMemory,detachedContexts,nativeContexts,heapSizeLimit\n";

function ensureCsv() {
  try {
    if (!fs.existsSync(CSV)) fs.writeFileSync(CSV, HEADER);
  } catch (e) {
    console.error(`[sampler] could not create ${CSV}: ${e}`);
  }
}

function sample() {
  try {
    const m = process.memoryUsage();
    const h = v8.getHeapStatistics();
    const now = Date.now();
    const row =
      [
        now,
        new Date(now).toISOString(),
        m.rss,
        m.heapTotal,
        m.heapUsed,
        m.external,
        m.arrayBuffers,
        h.malloced_memory,
        h.number_of_detached_contexts,
        h.number_of_native_contexts,
        h.heap_size_limit,
      ].join(",") + "\n";
    fs.appendFileSync(CSV, row);
  } catch (e) {
    console.error(`[sampler] sample failed: ${e}`);
  }
}

let snapCount = 0;
function labelFor(n) {
  if (n === 0) return "baseline";
  if (n === 1) return "after";
  return `snap-${n}`;
}

function takeSnapshot() {
  const label = labelFor(snapCount++);
  const path = `${OUT}/${label}.heapsnapshot`;
  try {
    if (typeof global.gc === "function") {
      // Full GC so the snapshot reflects retained (not transient) memory,
      // matching the --heapsnapshot-signal behaviour run.sh relied on.
      global.gc();
    }
    console.error(`[sampler] writing '${label}' heap snapshot -> ${path}`);
    const written = v8.writeHeapSnapshot(path);
    console.error(`[sampler]   done: ${written} (${fs.statSync(path).size} bytes)`);
    // Also drop a sample row right next to the snapshot for easy correlation.
    sample();
  } catch (e) {
    console.error(`[sampler] snapshot '${label}' failed: ${e}`);
  }
}

ensureCsv();
sample(); // one row at startup
const timer = setInterval(sample, SAMPLE_SEC * 1000);
timer.unref(); // never keep the process alive just for sampling

process.on("SIGUSR2", takeSnapshot);

console.error(
  `[sampler] installed (pid ${process.pid}, out=${OUT}, every ${SAMPLE_SEC}s, gc=${typeof global.gc === "function"})`,
);
