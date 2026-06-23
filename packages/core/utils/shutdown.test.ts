import assert from "node:assert";
import { afterEach, describe, it } from "node:test";

import { installShutdownHandlers as installGenericShutdownHandlers } from "./shutdown.js";
import { installShutdownHandlers } from "./shutdown.node.js";

type Recorder = {
  exitCode: number | null;
  exited: Promise<void>;
  exit: (code: number) => never;
};

function makeExitRecorder(): Recorder {
  let resolveExited!: () => void;
  const exited = new Promise<void>((resolve) => {
    resolveExited = resolve;
  });
  const recorder: Recorder = {
    exitCode: null,
    exited,
    exit: ((code: number): never => {
      recorder.exitCode = code;
      resolveExited();
      // Satisfy `never` and abort the calling promise chain.
      throw new Error(`__test_exit_${code}`);
    }) as (code: number) => never,
  };
  return recorder;
}

const silentLog = { info: () => {}, error: () => {} };

describe("utils::installShutdownHandlers", () => {
  const uninstallers: Array<() => void> = [];

  afterEach(() => {
    while (uninstallers.length > 0) {
      uninstallers.pop()?.();
    }
  });

  it("calls close and exits 0 on first SIGTERM", async () => {
    const exitRec = makeExitRecorder();
    let closeCalled = false;

    uninstallers.push(
      installShutdownHandlers(
        async () => {
          closeCalled = true;
        },
        { exit: exitRec.exit, log: silentLog },
      ),
    );

    process.emit("SIGTERM", "SIGTERM");

    await exitRec.exited;

    assert.strictEqual(closeCalled, true);
    assert.strictEqual(exitRec.exitCode, 0);
  });

  it("exits with code 1 when cleanup exceeds timeoutMs", async () => {
    const exitRec = makeExitRecorder();
    let closeStarted = false;
    let errorLogged: string | null = null;
    let releaseClose!: () => void;
    const closeReleased = new Promise<void>((resolve) => {
      releaseClose = resolve;
    });

    uninstallers.push(
      installShutdownHandlers(
        async () => {
          closeStarted = true;
          await closeReleased;
        },
        {
          exit: exitRec.exit,
          timeoutMs: 5,
          log: {
            info: () => {},
            error: (msg) => {
              errorLogged = msg;
            },
          },
        },
      ),
    );

    process.emit("SIGTERM", "SIGTERM");

    await exitRec.exited;

    assert.strictEqual(closeStarted, true, "close should have been invoked");
    assert.strictEqual(exitRec.exitCode, 1);
    assert.ok(errorLogged !== null, "expected timeout to be logged");
    assert.match(errorLogged as unknown as string, /timeout|exceed/i);

    // Allow the in-flight close promise to settle so the test doesn't leak.
    releaseClose();
  });

  it("forces exit 1 when a second signal arrives during cleanup", async () => {
    const exitRec = makeExitRecorder();
    let releaseClose!: () => void;
    const closeReleased = new Promise<void>((resolve) => {
      releaseClose = resolve;
    });
    let errorLogged: string | null = null;

    uninstallers.push(
      installShutdownHandlers(
        async () => {
          await closeReleased;
        },
        {
          // Large timeout so this test can't pass via the timeout path.
          timeoutMs: 60_000,
          exit: exitRec.exit,
          log: {
            info: () => {},
            error: (msg) => {
              errorLogged = msg;
            },
          },
        },
      ),
    );

    process.emit("SIGTERM", "SIGTERM");
    await new Promise((resolve) => setImmediate(resolve));
    process.emit("SIGINT", "SIGINT");

    await exitRec.exited;

    assert.strictEqual(exitRec.exitCode, 1);
    assert.ok(errorLogged !== null, "expected force-exit message to be logged");
    assert.match(errorLogged as unknown as string, /SIGINT/);

    releaseClose();
  });

  it("does nothing after uninstall", async () => {
    const exitRec = makeExitRecorder();
    let closeCalled = false;

    const uninstall = installShutdownHandlers(
      async () => {
        closeCalled = true;
      },
      { exit: exitRec.exit, log: silentLog },
    );
    uninstall();

    process.emit("SIGTERM", "SIGTERM");

    // Give any (incorrectly registered) handler a tick to fire.
    await new Promise((resolve) => setImmediate(resolve));

    assert.strictEqual(closeCalled, false);
    assert.strictEqual(exitRec.exitCode, null);
  });

  it("is a no-op from the generic shutdown module", async () => {
    const exitRec = makeExitRecorder();
    let closeCalled = false;

    const uninstall = installGenericShutdownHandlers(
      async () => {
        closeCalled = true;
      },
      { exit: exitRec.exit, log: silentLog },
    );

    uninstall();

    assert.strictEqual(typeof uninstall, "function");
    assert.strictEqual(closeCalled, false);
    assert.strictEqual(exitRec.exitCode, null);
  });

  it("exits with code 1 when close rejects", async () => {
    const exitRec = makeExitRecorder();
    let errorLogged: string | null = null;

    uninstallers.push(
      installShutdownHandlers(
        async () => {
          throw new Error("boom");
        },
        {
          exit: exitRec.exit,
          log: {
            info: () => {},
            error: (msg) => {
              errorLogged = msg;
            },
          },
        },
      ),
    );

    process.emit("SIGTERM", "SIGTERM");

    await exitRec.exited;

    assert.strictEqual(exitRec.exitCode, 1);
    assert.ok(errorLogged !== null, "expected error to be logged");
    assert.match(errorLogged as unknown as string, /boom/);
  });

  it("exits with code 1 when close throws synchronously", async () => {
    const exitRec = makeExitRecorder();
    let errorLogged: string | null = null;

    uninstallers.push(
      installShutdownHandlers(
        () => {
          throw new Error("sync boom");
        },
        {
          exit: exitRec.exit,
          log: {
            info: () => {},
            error: (msg) => {
              errorLogged = msg;
            },
          },
        },
      ),
    );

    process.emit("SIGTERM", "SIGTERM");

    await exitRec.exited;

    assert.strictEqual(exitRec.exitCode, 1);
    assert.ok(errorLogged !== null, "expected error to be logged");
    assert.match(errorLogged as unknown as string, /sync boom/);
  });
});
