import { type MessagePort, parentPort } from "node:worker_threads";

/** A in-worker abstraction. */
export class ConcurrentWorker<TParams, TResult, TInternalState> {
  static startAndListen<XParams, XResult, XInternalState>(
    run: (params: XParams, state: XInternalState) => Promise<XResult>,
    state: XInternalState,
  ) {
    if (!parentPort) {
      throw new Error("This method is meant to be run inside a worker thread!");
    }
    let worker: ConcurrentWorker<XParams, XResult, XInternalState> | null = null;
    parentPort.on("close", () => {
      worker?.close();
    });
    parentPort.on("message", (ev) => {
      const port = ev as MessagePort;
      worker = new ConcurrentWorker(run, state, port);
    });
  }

  constructor(
    private readonly runInternal: (params: TParams, state: TInternalState) => Promise<TResult>,
    public readonly state: TInternalState,
    public readonly port: MessagePort,
  ) {
    port.on("close", () => {
      this.close();
    });

    port.on("message", (ev: MessageIn<TParams>) => {
      const { params } = ev;
      this.run(params)
        .then((result) => {
          const response: MessageOut<TResult> = Result.ok(result);
          port.postMessage(response);
        })
        .catch((e) => {
          const response: MessageOut<TResult> = Result.error(`${e}`);
          port.postMessage(response);
        });
    });
  }

  run(params: TParams): Promise<TResult> {
    return this.runInternal(params, this.state);
  }

  close() {}
}
