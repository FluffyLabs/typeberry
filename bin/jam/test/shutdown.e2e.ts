import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Logger } from "@typeberry/logger";

const TEST_TIMEOUT = 30_000;
const BOOT_TIMEOUT_MS = 20_000;

const logger = Logger.new(import.meta.filename, "jam:shutdown-e2e");

// Spawning the binary directly via tsx avoids the npm/bash wrapper, which
// does not reliably forward signals.
function spawnFuzzTarget(socket: string): ChildProcess {
  // node26+ supports --experimental-strip-types; using tsx via --import keeps
  // behavior consistent with how the rest of the dev tooling runs TS sources.
  const args = ["--import", "tsx", "bin/jam/index.ts", "fuzz-target", socket];
  return spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
}

async function waitForListening(proc: ChildProcess, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onTimeout = setTimeout(() => {
      proc.off("exit", onExit);
      proc.stdout?.off("data", onData);
      proc.stderr?.off("data", onData);
      reject(new Error(`fuzz-target did not start listening within ${timeoutMs}ms`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(onTimeout);
      proc.off("exit", onExit);
      proc.stdout?.off("data", onData);
      proc.stderr?.off("data", onData);
    };

    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`fuzz-target exited (code=${code}) before listening`));
    };

    const onData = (buf: Buffer) => {
      const s = buf.toString();
      if (s.includes("IPC server is listening")) {
        cleanup();
        resolve();
      }
    };

    proc.on("exit", onExit);
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
  });
}

async function waitForExit(
  proc: ChildProcess,
  timeoutMs: number,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`process did not exit within ${timeoutMs}ms`));
    }, timeoutMs);
    proc.once("exit", (code, signal) => {
      clearTimeout(t);
      resolve({ code, signal });
    });
  });
}

async function runShutdownScenario(signal: NodeJS.Signals): Promise<void> {
  const socket = join(mkdtempSync(join(tmpdir(), "typeberry-shutdown-e2e-")), "fuzz.sock");
  const proc = spawnFuzzTarget(socket);
  try {
    await waitForListening(proc, BOOT_TIMEOUT_MS);

    const before = Date.now();
    proc.kill(signal);
    const { code } = await waitForExit(proc, 10_000);
    const elapsed = Date.now() - before;
    logger.info`${signal} exit: code=${code}, elapsed=${elapsed}ms`;

    if (code !== 0) {
      throw new Error(`expected exit 0 after ${signal}, got ${code}`);
    }
    if (existsSync(socket)) {
      throw new Error(`expected socket ${socket} to be removed after shutdown`);
    }
  } finally {
    if (!proc.killed) {
      proc.kill("SIGKILL");
    }
    rmSync(join(socket, ".."), { recursive: true, force: true });
  }
}

test("fuzz-target exits cleanly on SIGTERM and removes the socket", { timeout: TEST_TIMEOUT }, async () => {
  await runShutdownScenario("SIGTERM");
});

test("fuzz-target exits cleanly on SIGINT and removes the socket", { timeout: TEST_TIMEOUT }, async () => {
  await runShutdownScenario("SIGINT");
});

// NOTE: The "second signal during shutdown forces exit 1" behavior is covered
// by the unit test in `packages/core/utils/shutdown.test.ts`. An integration
// test here would be racy because fuzz-target shutdown completes in <10ms,
// leaving no realistic window for a second signal to land mid-cleanup.
