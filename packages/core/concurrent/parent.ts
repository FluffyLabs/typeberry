import { type MessagePort, Worker } from "node:worker_threads";
import { check } from "@typeberry/utils";
import type { MessageIn, MessageOut } from "./messages";

type Task<TParams, TResult> = {
  params: TParams;
  resolve: (x: TResult) => void;
  reject: (x: Error) => void;
};

// if we have 10 elements in the queue, we issue a warning.
// NOTE this might need to be configurable in the future.
const QUEUE_SIZE_WARNING = 10;

export class Executor<TParams, TResult> {
  /** Initialize a new concurrent executor given a path to the worker. */
  static initialize<XParams, XResult>(worker: string, concurrency: number): Executor<XParams, XResult> {
    check(concurrency > 0, "Invalid concurrency parameter");

    const workers: WorkerChannel<XParams, XResult>[] = [];
    for (let i = 0; i < concurrency; i++) {
      // create a worker and initialize communication channel
      const { port1, port2 } = new MessageChannel();
      const workerThread = new Worker(worker, {});
      workerThread.postMessage(port1);

      workers.push(new WorkerChannel(workerThread, port2));
    }
    return new Executor(workers);
  }

  private readonly freeWorkerIndices: number[] = [];
  private readonly taskQueue: Task<TParams, TResult>[] = [];

  private constructor(private readonly workers: WorkerChannel<TParams, TResult>[]) {
    // intial free workers.
    for (let i = 0; i < workers.length; i++) {
      this.freeWorkerIndices.push(i);
    }
  }

  /**
   * Execute a task with following parameters.
   */
  async run(params: TParams): Promise<TResult> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({
        params,
        resolve,
        reject,
      });
      this.processTaskQueue();
    });
  }

  /**
   * Process as many elements from the task queue as possible.
   */
  private processTaskQueue() {
    for (;;) {
      const freeWorker = this.freeWorkerIndices.pop();
      // no free workers available currently,
      // we will retry when one of the tasks completes.
      if (freeWorker === undefined) {
        if (this.taskQueue.length > QUEUE_SIZE_WARNING) {
          console.warn(`Task queue has ${this.taskQueue.length} pending items!`);
        }
        return;
      }

      const task = this.taskQueue.pop();
      // no tasks in the queue
      if (task === undefined) {
        this.freeWorkerIndices.push(freeWorker);
        return;
      }

      const worker = this.workers[freeWorker];
      worker.runTask(task, () => {
        // mark the worker as available again
        this.freeWorkerIndices.push(freeWorker);
        // and continue processing the queue
        this.processTaskQueue();
      });
    }
  }
}

class WorkerChannel<TParams, TResult> {
  constructor(
    public readonly worker: Worker,
    public readonly port: MessagePort,
  ) {}

  runTask(task: Task<TParams, TResult>, onFinish: () => void) {
    const message: MessageIn<TParams> = {
      params: task.params,
    };
    // when we receive a response, make sure to process it
    this.port.once("message", (e: MessageOut<TResult>) => {
      setImmediate(onFinish);
      if (e.isOk) {
        task.resolve(e.ok);
      } else {
        task.reject(new Error(e.error));
      }
    });
    // send the task to work on.
    this.port.postMessage(message);
  }
}
