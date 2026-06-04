import fs from "node:fs";
import os from "node:os";
import v8 from "node:v8";
import type { Logger } from "@typeberry/logger";

const toGiB = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GiB`;

/**
 * Log details about the host the node is running on (cpu, memory, platform)
 * and the memory limits that apply to the process.
 *
 * Call this once from the main thread. Worker threads share the same OS process,
 * so the host/cgroup/ulimit values are identical for them; use `logHeapLimit`
 * to log the per-isolate V8 heap limit instead.
 */
export function logHostEnvironment(logger: Logger): void {
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model ?? "unknown";

  logger.info`💻 Platform: ${os.platform()}/${os.arch()}, Node ${process.version}.`;
  logger.info`⚙️ CPU: ${cpuModel} (${cpus.length} cores, ${os.availableParallelism()} available).`;
  logger.info`🧠 Memory: ${toGiB(os.freemem())} free / ${toGiB(os.totalmem())} total (host).`;
  logger.info`📦 V8 heap limit: ${toGiB(v8.getHeapStatistics().heap_size_limit)}.`;

  // On Linux the process can be capped well below host memory by the container
  // runtime (cgroup) or an address-space ulimit. os.totalmem() reflects neither,
  // so surface them explicitly to make OOMs diagnosable.
  const cgroupLimit = readCgroupMemoryLimit();
  if (cgroupLimit !== null) {
    logger.info`🐳 cgroup memory limit: ${toGiB(cgroupLimit)}.`;
  }
  const addressSpaceLimit = readAddressSpaceLimit();
  if (addressSpaceLimit !== null) {
    logger.info`🚧 Address space limit (ulimit -v): ${toGiB(addressSpaceLimit)}.`;
  }
}

/**
 * Log just this isolate's V8 heap limit, labelled with the worker name.
 *
 * Worker threads get their own V8 isolate, so this can differ from the main
 * thread. Everything else (cpu, host/cgroup/ulimit memory) is process-wide and
 * already logged by `logHostEnvironment` on the main thread.
 */
export function logHeapLimit(logger: Logger, workerName: string): void {
  logger.info`📦 V8 heap limit (${workerName}): ${toGiB(v8.getHeapStatistics().heap_size_limit)}.`;
}

/**
 * `resourceLimits` to pass to `new Worker(...)` so the worker isolate gets the
 * same heap budget as the main thread.
 *
 * Worker threads run in their own V8 isolate and do not reliably inherit the
 * main thread's `--max-old-space-size` (set via NODE_OPTIONS). Without this they
 * fall back to V8's default (~2 GiB) and abort with SIGABRT (exit code 134) once
 * they outgrow it. Call this on the main thread at spawn time so we propagate
 * whatever limit the process was actually started with.
 */
export function workerResourceLimits(): { maxOldGenerationSizeMb: number } {
  return {
    maxOldGenerationSizeMb: Math.floor(v8.getHeapStatistics().heap_size_limit / 1024 ** 2),
  };
}

/** Read the cgroup (v2, then v1) memory limit in bytes, or null if unlimited / unavailable. */
function readCgroupMemoryLimit(): number | null {
  if (os.platform() !== "linux") {
    return null;
  }
  // cgroup v2 first, then the v1 fallback path.
  for (const path of ["/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"]) {
    try {
      const raw = fs.readFileSync(path, "utf8").trim();
      if (raw === "max") {
        return null; // cgroup v2 sentinel for "no limit"
      }
      const value = Number(raw);
      // cgroup v1 reports a value close to 2^63 when unbounded; treat anything at or
      // above host memory as effectively no limit.
      if (!Number.isFinite(value) || value <= 0 || value >= os.totalmem()) {
        return null;
      }
      return value;
    } catch {
      // file missing or unreadable, fall through to the next candidate
    }
  }
  return null;
}

/** Read the soft RLIMIT_AS (address space, i.e. `ulimit -v`) in bytes, or null if unlimited / unavailable. */
function readAddressSpaceLimit(): number | null {
  if (os.platform() !== "linux") {
    return null;
  }
  try {
    const limits = fs.readFileSync("/proc/self/limits", "utf8");
    const line = limits.split("\n").find((l) => l.startsWith("Max address space"));
    if (line === undefined) {
      return null;
    }
    // Columns are: name (multi-word), soft limit, hard limit, units.
    const soft = line.slice("Max address space".length).trim().split(/\s+/)[0];
    if (soft === undefined || soft === "unlimited") {
      return null;
    }
    const value = Number(soft);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    // /proc not mounted or unreadable
    return null;
  }
}
