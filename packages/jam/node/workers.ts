import type { Worker } from "node:worker_threads";
import * as blockAuthorship from "@typeberry/block-authorship";
import { protocol } from "@typeberry/comms-authorship-network";
import type { BlocksDb, LeafDb, StatesDb } from "@typeberry/database";
import * as importer from "@typeberry/importer";
import * as jamNetwork from "@typeberry/jam-network";
import type { SerializedState } from "@typeberry/state-merkleization";
import { Channel, type DirectPort, type DirectWorkerConfig, startSameThread } from "@typeberry/workers-api";
import { type LmdbWorkerConfig, spawnWorker } from "@typeberry/workers-api-node";

// Worker bootstraps differ: Node uses .mjs files that load tsx/esm/api (TS loader),
// while bun handles .ts natively and can import bootstrap-main.ts directly.
// We compute bun worker URLs here (not in the worker packages) to avoid ncc trying
// to bundle bootstrap-main.ts during the npm build, which fails on top-level await.
const isBun = "Bun" in globalThis;

function workerUrl(nodeWorker: URL): URL {
  if (!isBun) {
    return nodeWorker;
  }
  // Replace the .mjs bootstrap with bootstrap-main.ts in the same directory
  return new URL("./bootstrap-main.ts", nodeWorker);
}

export async function spawnImporterWorker(config: LmdbWorkerConfig<importer.ImporterConfig>) {
  const { api, workerFinished } = spawnWorker(
    importer.protocol,
    workerUrl(importer.WORKER),
    config,
    importer.ImporterConfig.Codec,
  );

  return {
    importer: api,
    finish: async () => {
      await api.sendFinish();
      api.destroy();
      await workerFinished;
    },
  };
}

export async function startImporterDirect(
  config: DirectWorkerConfig<importer.ImporterConfig, BlocksDb, StatesDb<SerializedState<LeafDb>>>,
): ReturnType<typeof spawnImporterWorker> {
  const { api, internal } = startSameThread(importer.protocol);

  const importerFinish = importer.main(config, internal);

  return {
    importer: api,
    finish: async () => {
      await api.sendFinish();
      api.destroy();
      await importerFinish;
    },
  };
}

export async function spawnNetworkWorker(config: LmdbWorkerConfig<jamNetwork.NetworkingConfig>) {
  const { api, worker, workerFinished } = spawnWorker(
    jamNetwork.protocol,
    workerUrl(jamNetwork.WORKER),
    config,
    jamNetwork.NetworkingConfig.Codec,
  );

  return {
    network: api,
    worker,
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

  const networkFinish = jamNetwork.main(config, internal, authorshipComms);
  return {
    network: api,
    worker: null,
    finish: async () => {
      await api.sendFinish();
      api.destroy();
      await networkFinish;
      authorshipComms.destroy();
    },
  };
}

export async function spawnBlockGeneratorWorker(config: LmdbWorkerConfig<blockAuthorship.BlockAuthorshipConfig>) {
  const { api, worker, workerFinished } = spawnWorker(
    blockAuthorship.protocol,
    workerUrl(blockAuthorship.WORKER),
    config,
    blockAuthorship.BlockAuthorshipConfig.Codec,
  );

  return {
    generator: api,
    worker,
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
  const finish = blockAuthorship.main(config, internal, networkingComms);

  return {
    generator: api,
    worker: null,
    finish: async () => {
      await api.sendFinish();
      api.destroy();
      await finish;
      networkingComms.destroy();
    },
  };
}
