import { type MessagePort, Worker } from "node:worker_threads";
import { check } from "@typeberry/utils";
import type { IExecutor, MessageIn, MessageOut, WithTransferList } from "./messages";

// Amount of tasks in the queue that will trigger creation of new worker thread.
// NOTE this might need to be configurable in the future.
const QUEUE_SIZE_WORKER_THRESHOLD = 5;

/** Executor options. */
export type ExecutorOptions = {
  /** Minimal and initial number of workers, initialized before start. */
  minWorkers: number;
  /**
   * Maximal number of workers that can be created in total.
   *
   * Workers between `(minWorkers, maxWorkers]` are created on demand,
   * when there is too many tasks pending in the queue.
   */
  maxWorkers: number;
};

/** Execution pool manager. */
export class Executor<TParams extends WithTransferList, TResult> implements IExecutor<TParams, TResult> {
  /** Initialize a new concurrent executor given a path to the worker. */
  static async initialize<XParams extends WithTransferList, XResult extends WithTransferList>(
    workerPath: string,
    options: ExecutorOptions,
  ): Promise<Executor<XParams, XResult>> {
    check(options.maxWorkers > 0, "Max workers has to be positive.");
    check(options.minWorkers <= options.maxWorkers, "Min workers has to be lower or equal to max workers.");

    const workers: WorkerChannel<XParams, XResult>[] = [];
    for (let i = 0; i < options.minWorkers; i++) {
      workers.push(await initWorker(workerPath));
    }
    return new Executor(workers, options.maxWorkers, workerPath);
  }
  // keeps track of the indices of worker threads that are currently free and available to execute tasks
  private readonly freeWorkerIndices: number[] = [];
  private readonly taskQueue: Task<TParams, TResult>[] = [];
  private isDestroyed = false;
  private isWorkerInitializing = false;

  private constructor(
    private readonly workers: WorkerChannel<TParams, TResult>[],
    private readonly maxWorkers: number,
    private readonly workerPath: string,
  ) {
    // intial free workers.
    for (let i = 0; i < workers.length; i++) {
      this.freeWorkerIndices.push(i);
    }
  }

  /** Attempt to initialize a new worker. */
  async initNewWorker(onSuccess: () => void = () => {}) {
    if (this.workers.length >= this.maxWorkers) {
      console.warn(`Task queue has ${this.taskQueue.length} pending items and we can't init any more workers.`);
      return;
    }
    if (this.isWorkerInitializing) {
      return;
    }

    this.isWorkerInitializing = true;
    this.workers.push(await initWorker(this.workerPath));
    this.freeWorkerIndices.push(this.workers.length - 1);
    this.isWorkerInitializing = false;
    onSuccess();
  }

  /** Terminate all workers and clear the executor. */
  async destroy() {
    for (const worker of this.workers) {
      worker.port.close();
      await worker.worker.terminate();
    }
    this.workers.length = 0;
    this.isDestroyed = true;
  }

  /** Execute a task with given parameters. */
  async run(params: TParams): Promise<TResult> {
    return new Promise((resolve, reject) => {
      if (this.isDestroyed) {
        reject("pool destroyed");
        return;
      }

      this.taskQueue.push({
        params,
        resolve,
        reject,
      });
      this.processEntryFromTaskQueue();
    });
  }

  /** Process single element from the task queue. */
  private processEntryFromTaskQueue() {
    const freeWorker = this.freeWorkerIndices.pop();
    // no free workers available currently,
    // we will retry when one of the tasks completes.
    if (freeWorker === undefined) {
      if (this.taskQueue.length > QUEUE_SIZE_WORKER_THRESHOLD) {
        this.initNewWorker(() => {
          // process an entry in this newly initialized worker.
          this.processEntryFromTaskQueue();
        });
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
      this.processEntryFromTaskQueue();
    });
  }
}

type Task<TParams, TResult> = {
  params: TParams;
  resolve: (x: TResult) => void;
  reject: (x: Error) => void;
};

async function initWorker<XParams extends WithTransferList, XResult>(
  workerPath: string,
): Promise<WorkerChannel<XParams, XResult>> {
  // create a worker and initialize communication channel
  const { port1, port2 } = new MessageChannel();
  const workerThread = new Worker(workerPath, {});
  workerThread.postMessage(port1, [port1]);
  // // wait for the worker to start
  await new Promise((resolve, reject) => {
    workerThread.once("message", resolve);
    workerThread.once("error", reject);
  });
  // make sure the threads don't prevent the program from stopping.
  workerThread.unref();
  return new WorkerChannel(workerThread, port2);
}

class WorkerChannel<TParams extends WithTransferList, TResult> {
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
      if (e.isOk) {
        task.resolve(e.ok);
      } else {
        task.reject(new Error(e.error));
      }
      onFinish();
    });
    // send the task to work on.
    this.port.postMessage(message, message.params.getTransferList());
  }
}
