import type { Worker } from "node:worker_threads";
import * as blockAuthorship from "@typeberry/block-authorship";
import { protocol } from "@typeberry/comms-authorship-network";
import * as importer from "@typeberry/importer";
import * as jamNetwork from "@typeberry/jam-network";
import { Channel, type DirectPort, type DirectWorkerConfig, startSameThread } from "@typeberry/workers-api";
import { type PersistentWorkerConfig, spawnWorker } from "@typeberry/workers-api-node";

function createReadySignal() {
  let markReady = () => {};
  const signal = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  return { markReady, signal };
}

function raceReady(signal: Promise<void>, finished: Promise<unknown>, name: string) {
  return Promise.race([
    signal,
    finished.then(
      () => {
        throw new Error(`${name} worker finished before becoming ready`);
      },
      (e: unknown) => {
        throw e;
      },
    ),
  ]);
}

export async function spawnImporterWorker(config: PersistentWorkerConfig<importer.ImporterConfig>) {
  const { api, workerReady, workerFinished } = spawnWorker(
    importer.protocol,
    importer.WORKER,
    config,
    importer.ImporterConfig.Codec,
  );
  await workerReady;

  return {
    importer: api,
    finish: async () => {
      await api.sendFinish();
      api.destroy();
      await workerFinished;
    },
  };
}

export async function startImporterDirect(config: importer.Config): ReturnType<typeof spawnImporterWorker> {
  const { api, internal } = startSameThread(importer.protocol);
  const { markReady, signal } = createReadySignal();

  const importerFinish = importer.main(config, internal, markReady);
  await raceReady(signal, importerFinish, "importer");

  return {
    importer: api,
    finish: async () => {
      await api.sendFinish();
      api.destroy();
      await importerFinish;
    },
  };
}

export async function spawnNetworkWorker(config: PersistentWorkerConfig<jamNetwork.NetworkingConfig>) {
  const { api, worker, workerReady, workerFinished } = spawnWorker(
    jamNetwork.protocol,
    jamNetwork.WORKER,
    config,
    jamNetwork.NetworkingConfig.Codec,
  );

  return {
    network: api,
    worker,
    ready: workerReady,
    finish: async () => {
      await api.sendFinish();
      api.destroy();
      await workerFinished;
    },
  };
}

export async function startNetwork(
  config: DirectWorkerConfig<jamNetwork.NetworkingConfig>,
  authorshipPort: DirectPort,
): Promise<Omit<Awaited<ReturnType<typeof spawnNetworkWorker>>, "worker"> & { worker: Worker | null }> {
  const { api, internal } = startSameThread(jamNetwork.protocol);
  const authorshipComms = Channel.rx(protocol, authorshipPort);
  const { markReady, signal } = createReadySignal();

  const networkFinish = jamNetwork.main(config, internal, authorshipComms, markReady);
  return {
    network: api,
    worker: null,
    ready: raceReady(signal, networkFinish, "network"),
    finish: async () => {
      await api.sendFinish();
      api.destroy();
      await networkFinish;
      authorshipComms.destroy();
    },
  };
}

export async function spawnBlockGeneratorWorker(config: PersistentWorkerConfig<blockAuthorship.BlockAuthorshipConfig>) {
  const { api, worker, workerReady, workerFinished } = spawnWorker(
    blockAuthorship.protocol,
    blockAuthorship.WORKER,
    config,
    blockAuthorship.BlockAuthorshipConfig.Codec,
  );

  return {
    generator: api,
    worker,
    ready: workerReady,
    finish: async () => {
      await api.sendFinish();
      api.destroy();
      await workerFinished;
    },
  };
}

export async function startBlockGenerator(
  config: DirectWorkerConfig<blockAuthorship.BlockAuthorshipConfig>,
  networkingPort: DirectPort,
): Promise<Omit<Awaited<ReturnType<typeof spawnBlockGeneratorWorker>>, "worker"> & { worker: Worker | null }> {
  const { api, internal } = startSameThread(blockAuthorship.protocol);

  const networkingComms = Channel.tx(protocol, networkingPort);
  const { markReady, signal } = createReadySignal();
  const finish = blockAuthorship.main(config, internal, networkingComms, markReady);

  return {
    generator: api,
    worker: null,
    ready: raceReady(signal, finish, "block-authorship"),
    finish: async () => {
      await api.sendFinish();
      api.destroy();
      await finish;
      networkingComms.destroy();
    },
  };
}
