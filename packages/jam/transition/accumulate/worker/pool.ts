/**
 * Worker pool for parallel PVM accumulation.
 *
 * Workers request service data from the main thread asynchronously
 * via MessagePort request-response protocol.
 */
import { MessageChannel, type MessagePort, Worker } from "node:worker_threads";
import type { ServiceId } from "@typeberry/block";
import { Logger } from "@typeberry/logger";
import type { Service } from "@typeberry/state";
import { type AccumulateRequest, type AccumulateResponse, type GetServiceRequest, MessageType } from "./protocol.js";
import { type PlainService, serializeService } from "./serialization.js";

const logger = Logger.new(import.meta.filename, "worker-pool");

type PendingAccumulation = {
  resolve: (response: AccumulateResponse) => void;
  reject: (error: Error) => void;
};

type WorkerHandle = {
  worker: Worker;
  /** Dedicated port for structured clone data (main side). */
  dataPort: MessagePort;
  /** FIFO queue of pending accumulations for this worker. */
  pendingQueue: PendingAccumulation[];
};

export class AccumulateWorkerPool {
  private readonly workers: WorkerHandle[];
  private nextWorkerIndex = 0;
  private getServiceFn: ((serviceId: ServiceId) => Service | null) | null = null;
  private terminated = false;

  constructor(workerCount: number) {
    const workerUrl = new URL("./worker.ts", import.meta.url);

    this.workers = new Array(workerCount);
    for (let i = 0; i < workerCount; i++) {
      const { port1: mainPort, port2: workerPort } = new MessageChannel();

      const worker = new Worker(workerUrl, {
        workerData: { dataPort: workerPort },
        transferList: [workerPort],
        execArgv: ["--import", "tsx"],
      });

      mainPort.on("message", (msg: AccumulateResponse | GetServiceRequest) => {
        this.handleWorkerMessage(i, msg);
      });

      worker.on("error", (err) => {
        logger.warn`Worker ${i} error: ${err.message}`;
        const handle = this.workers[i];
        const pending = handle.pendingQueue.shift();
        if (pending !== undefined) {
          pending.reject(err);
        }
      });

      this.workers[i] = { worker, dataPort: mainPort, pendingQueue: [] };
    }

    logger.log`Worker pool created with ${workerCount} workers.`;
  }

  setGetServiceFn(fn: (serviceId: ServiceId) => Service | null) {
    this.getServiceFn = fn;
  }

  dispatch(request: AccumulateRequest): Promise<AccumulateResponse> {
    const workerIndex = this.nextWorkerIndex;
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    const handle = this.workers[workerIndex];

    return new Promise((resolve, reject) => {
      handle.pendingQueue.push({ resolve, reject });
      handle.dataPort.postMessage(request);
    });
  }

  private handleWorkerMessage(workerIndex: number, msg: AccumulateResponse | GetServiceRequest) {
    const handle = this.workers[workerIndex];

    if ((msg as GetServiceRequest).type === MessageType.GetServiceRequest) {
      this.handleGetServiceRequest(handle, msg as GetServiceRequest);
      return;
    }

    const response = msg as AccumulateResponse;
    const pending = handle.pendingQueue.shift();
    if (pending !== undefined) {
      pending.resolve(response);
    }
  }

  private handleGetServiceRequest(handle: WorkerHandle, request: GetServiceRequest) {
    if (this.getServiceFn === null) {
      throw new Error("getServiceFn not set on worker pool");
    }

    const service = this.getServiceFn(request.serviceId);
    const plainService: PlainService | null = service !== null ? serializeService(service) : null;

    handle.dataPort.postMessage({
      type: MessageType.GetServiceResponse,
      service: plainService,
    });
  }

  async terminate() {
    if (this.terminated) {
      return;
    }
    this.terminated = true;
    for (const handle of this.workers) {
      handle.dataPort.close();
      await handle.worker.terminate();
    }
    logger.log`Worker pool terminated.`;
  }
}
