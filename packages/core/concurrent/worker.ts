import { type MessagePort, parentPort } from "node:worker_threads";
import { Result } from "@typeberry/utils";
import type { IExecutor, MessageIn, MessageOut, WithTransferList } from "./messages.js";

/** A in-worker abstraction. */
export class ConcurrentWorker<TParams, TResult extends WithTransferList, TInternalState>
  implements IExecutor<TParams, TResult>
{
  static new<XParams, XResult extends WithTransferList, XInternalState>(
    run: (params: XParams, state: XInternalState) => Promise<XResult>,
    state: XInternalState,
  ) {
    return new ConcurrentWorker(run, state);
  }

  private constructor(
    private readonly runInternal: (params: TParams, state: TInternalState) => Promise<TResult>,
    public readonly state: TInternalState,
  ) {}

  listenToParentPort() {
    if (parentPort === null) {
      throw new Error("This method is meant to be run inside a worker thread!");
    }
    parentPort.once("close", () => {
      process.exit(0);
    });
    parentPort.once("message", (port: MessagePort) => {
      this.listenTo(port);
      // send back readiness signal.
      parentPort?.postMessage("ready");
    });
  }

  private listenTo(port: MessagePort) {
    port.once("close", () => {
      port.removeAllListeners();
      process.exit(0);
    });

    port.on("message", (ev: MessageIn<TParams>) => {
      const { params } = ev;
      this.run(params)
        .then((result) => {
          const response: MessageOut<TResult> = Result.ok(result);
          port.postMessage(response, result.getTransferList());
        })
        .catch((e) => {
          const response: MessageOut<TResult> = Result.error(`${e}`);
          port.postMessage(response, []);
        });
    });
  }

  async run(params: TParams): Promise<TResult> {
    return await this.runInternal(params, this.state);
  }

  async destroy() {}
}
