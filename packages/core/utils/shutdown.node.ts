import type { Closer, ShutdownOptions } from "./shutdown.js";

export type { Closer, ShutdownLogger, ShutdownOptions, ShutdownSignal } from "./shutdown.js";

const DEFAULT_SIGNALS: readonly NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
const DEFAULT_TIMEOUT_MS = 10_000;

/** Returns an uninstall function (used by tests). */
export function installShutdownHandlers(close: Closer, options: ShutdownOptions = {}): () => void {
  const signals = (options.signals ?? DEFAULT_SIGNALS) as readonly NodeJS.Signals[];
  const exit = (options.exit ?? process.exit) as (code: number) => never;

  const log = options.log;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  type State = "idle" | "closing" | "done";
  let state: State = "idle";

  const forceExit = (signal: NodeJS.Signals) => {
    log?.error(`Received ${signal} during shutdown, forcing exit.`);
    try {
      exit(1);
    } catch {
      // test-time exit throws; swallow.
    }
  };

  const handler = (signal: NodeJS.Signals) => {
    if (state === "closing" || state === "done") {
      forceExit(signal);
      return;
    }
    state = "closing";
    log?.info(`Received ${signal}, draining...`);

    void (async () => {
      const TIMED_OUT = Symbol("timed-out");
      let timeoutHandle: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<typeof TIMED_OUT>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
      });
      timeoutHandle?.unref?.();

      let code = 0;
      try {
        const outcome = await Promise.race([
          Promise.resolve()
            .then(close)
            .then(
              () => "ok" as const,
              (e: unknown) => ({ err: e }) as const,
            ),
          timeoutPromise,
        ]);
        if (outcome === TIMED_OUT) {
          code = 1;
          log?.error(`Shutdown cleanup exceeded ${timeoutMs}ms timeout, forcing exit.`);
        } else if (typeof outcome === "object" && "err" in outcome) {
          code = 1;
          const e = outcome.err;
          log?.error(`Shutdown close threw: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
        } else {
          log?.info("Shutdown complete.");
        }
      } finally {
        clearTimeout(timeoutHandle);
        state = "done";
      }
      try {
        exit(code);
      } catch {
        // test-time exit throws; swallow.
      }
    })();
  };

  // Node passes the signal name to the listener, so a single handler works
  // for every signal.
  for (const sig of signals) {
    process.on(sig, handler);
  }

  return () => {
    for (const sig of signals) {
      process.off(sig, handler);
    }
  };
}
