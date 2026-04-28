import { MessageChannel, type MessagePort, parentPort, Worker } from "node:worker_threads";
import type { Decode, Encode } from "@typeberry/codec";
import { Listener } from "@typeberry/listener";
import { Level, Logger } from "@typeberry/logger";
import { assertNever } from "@typeberry/utils";
import { Channel } from "@typeberry/workers-api";
import type { Api, Internal, LousyProtocol } from "@typeberry/workers-api/types.js";
import { LmdbWorkerConfig, type TransferableConfig } from "./config.js";
import { ThreadPort } from "./port.js";

const logger = Logger.new(import.meta.filename, "workers");

/** Type of the control plane message. */
export enum WorkerControlPlaneMsg {
  /** Transfers a communication port to some other thread. */
  CommunicationPort = 0,
  /** Transfers worker configuration. */
  Config = 1,
  /** Signal from the worker that it is ready to receive configuration. */
  Ready = 2,
}

export type ThreadComms = {
  /** Name of the thread we can communicate with. */
  threadName: string;
  /** Communication port. */
  port: MessagePort;
};
/** Control plane message. Received received from parent thread, only on `parentPort`. */
export type WorkerControlPlane =
  | ({
      /** Direct communication port with some other thread. */
      kind: WorkerControlPlaneMsg.CommunicationPort;
    } & ThreadComms)
  | {
      /** Configuration object for a worker and parent-thread communication port. */
      kind: WorkerControlPlaneMsg.Config;
      /** Main thread communication port. */
      parentPort: MessagePort;
      /** Configuration object. */
      config: TransferableConfig;
    };

function isControlPlane(data: unknown): data is WorkerControlPlane {
  const isObject = data !== null && typeof data === "object";
  if (!isObject) {
    return false;
  }

  if ("kind" in data && typeof data.kind === "number" && WorkerControlPlaneMsg[data.kind] !== undefined) {
    return true;
  }

  return false;
}

/**
 * Invoked by the main thread, to spawn a worker thread and initiate communication channel.
 */
export function spawnWorker<To, From, Params>(
  protocol: LousyProtocol<To, From>,
  bootstrapPath: URL,
  config: LmdbWorkerConfig<Params>,
  paramsEncoder: Encode<Params>,
): {
  api: Api<typeof protocol>;
  worker: Worker;
  workerFinished: Promise<void>;
} {
  logger.trace`Spawning ${protocol.name} child worker.`;

  const channel = new MessageChannel();
  const worker = new Worker(bootstrapPath);

  const transferableConfig = config.intoTransferable(paramsEncoder);
  const msg: WorkerControlPlane = {
    kind: WorkerControlPlaneMsg.Config,
    parentPort: channel.port2,
    config: transferableConfig,
  };

  logger.trace`(${protocol.name}) <-- config`;
  // Every MessagePort inside the message must be listed in the transferable
  // argument — otherwise bun rejects the postMessage with a structured-clone
  // error (Node is more lenient but still risks duplicating the port).
  const transferredPorts = transferableConfig.workerPorts.map(([, { port }]) => port);
  // Wait for the worker to signal it's ready before sending the config.
  // Node buffers messages sent before the worker attaches its parentPort
  // listener, but bun does not — messages sent during bootstrap are silently
  // dropped. The worker sends a Ready message as soon as its listener is
  // attached (see initWorker below).
  const onReady = (incoming: unknown) => {
    if (
      incoming !== null &&
      typeof incoming === "object" &&
      "kind" in incoming &&
      incoming.kind === WorkerControlPlaneMsg.Ready
    ) {
      worker.off("message", onReady);
      worker.postMessage(msg, [msg.parentPort, ...transferredPorts]);
    }
  };
  worker.on("message", onReady);

  const workerFinished = new Promise<void>((resolve, reject) => {
    worker.once("error", reject);
    worker.once("exit", (exitCode) => {
      if (exitCode === 0) {
        resolve();
      } else {
        reject(new Error(`(${protocol.name}) exit code: ${exitCode}`));
      }
    });
  });

  // now return communication channel with that worker
  const txPort = ThreadPort.new(config.chainSpec, channel.port1);
  return {
    api: Channel.tx(protocol, txPort),
    worker,
    workerFinished,
  };
}

/**
 * Initialize worker thread by awaiting the config message.
 */
export async function initWorker<To, From, Params>(
  protocol: LousyProtocol<To, From>,
  paramsDecoder: Decode<Params>,
): Promise<{
  config: LmdbWorkerConfig<Params>;
  comms: Internal<typeof protocol>;
  threadComms: Listener<ThreadComms>;
}> {
  // configure logger inside a worker thread
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

  logger.trace`Worker ${protocol.name} starting.`;

  return new Promise((resolve, reject) => {
    if (parentPort === null) {
      throw new Error(`Unable to start ${protocol.name} worker. Not running in a worker thread!`);
    }

    parentPort.once("close", () => reject(new Error(`(${protocol.name}) parent port closed too early`)));

    let isResolved = false;
    const threadComms = new Listener<ThreadComms>();
    parentPort.on("message", async (msg) => {
      if (!isControlPlane(msg)) {
        logger.error`--> (${protocol.name}) received unexpected message: ${msg}`;
        return;
      }

      if (msg.kind === WorkerControlPlaneMsg.CommunicationPort) {
        logger.trace`--> (${protocol.name}) received comms port with ${msg.threadName}.`;
        threadComms.emit(msg);
        return;
      }

      if (msg.kind === WorkerControlPlaneMsg.Config) {
        if (isResolved) {
          logger.error`--> (${protocol.name}) ignoring duplicated config message.`;
          return;
        }

        logger.trace`--> (${protocol.name}) received configuration.`;
        isResolved = true;
        const config = await LmdbWorkerConfig.fromTransferable(paramsDecoder, msg.config);
        const rxPort = ThreadPort.new(config.chainSpec, msg.parentPort);
        const comms = Channel.rx(protocol, rxPort);

        resolve({
          config,
          comms,
          threadComms,
        });
        return;
      }

      if (msg.kind === WorkerControlPlaneMsg.Ready) {
        // Ready is only ever sent from worker -> parent, not the other way.
        logger.error`--> (${protocol.name}) unexpected Ready message on worker side.`;
        return;
      }

      assertNever(msg.kind);
    });

    // Signal to the parent that we're ready to receive the configuration.
    // Node buffers pre-listener messages, bun does not — this handshake
    // ensures the parent only sends once our listener is attached.
    parentPort.postMessage({ kind: WorkerControlPlaneMsg.Ready });
  });
}
