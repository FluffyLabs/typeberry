export type Closer = () => Promise<void>;

export interface ShutdownLogger {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

export interface ShutdownOptions {
  /** Max ms allowed for `close` before forced exit(1). Default 10_000. */
  timeoutMs?: number;
  /** Signals to listen for. Default ["SIGTERM", "SIGINT"]. */
  signals?: readonly NodeJS.Signals[];
  /** Logger; defaults to a no-op logger. */
  log?: ShutdownLogger;
  /** Test hook used instead of process.exit. */
  exit?: (code: number) => never;
}

const DEFAULT_SIGNALS: readonly NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
const DEFAULT_TIMEOUT_MS = 10_000;

function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && typeof process.on === "function" && typeof process.exit === "function";
}

/** Returns an uninstall function (used by tests). */
export function installShutdownHandlers(close: Closer, options: ShutdownOptions = {}): () => void {
  if (!isNodeRuntime()) {
    return () => {};
  }

  const signals = options.signals ?? DEFAULT_SIGNALS;
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
          close().then(
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
