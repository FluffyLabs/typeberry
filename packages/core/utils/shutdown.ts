export type Closer = () => Promise<void>;

export type ShutdownSignal = string;

export interface ShutdownLogger {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

export interface ShutdownOptions {
  /** Max ms allowed for `close` before forced exit(1). Default 10_000. */
  timeoutMs?: number;
  /** Signals to listen for. Default ["SIGTERM", "SIGINT"]. */
  signals?: readonly ShutdownSignal[];
  /** Logger; defaults to a no-op logger. */
  log?: ShutdownLogger;
  /** Test hook used instead of process.exit. */
  exit?: (code: number) => never;
}

export function installShutdownHandlers(_close: Closer, _options: ShutdownOptions = {}): () => void {
  return () => {};
}
