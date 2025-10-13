import * as blockGenerator from "@typeberry/block-generator";
import { codec } from "@typeberry/codec";
import type { BlocksDb, LeafDb, StatesDb } from "@typeberry/database";
import * as importer from "@typeberry/importer";
import * as jamNetwork from "@typeberry/jam-network";
import type { SerializedState } from "@typeberry/state-merkleization";
import { type DirectWorkerConfig, startSameThread } from "@typeberry/workers-api";
import { type NodeWorkerConfig, spawnWorker } from "@typeberry/workers-api-node";

export async function spawnImporterWorker(config: NodeWorkerConfig<importer.ImporterConfig>) {
  const { api, workerFinished } = spawnWorker(
    importer.protocol,
    importer.WORKER,
    config,
    importer.ImporterConfig.Codec,
  );

  return {
    importer: api,
    finish: async () => {
      await api.sendFinish();
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
      await importerFinish;
    },
  };
}

export async function spawnNetworkWorker(config: NodeWorkerConfig<jamNetwork.NetworkingConfig>) {
  const { api, workerFinished } = spawnWorker(
    jamNetwork.protocol,
    jamNetwork.WORKER,
    config,
    jamNetwork.NetworkingConfig.Codec,
  );

  return {
    network: api,
    finish: async () => {
      await api.sendFinish();
      await workerFinished;
    },
  };
}

export async function startNetwork(
  config: DirectWorkerConfig<jamNetwork.NetworkingConfig>,
): ReturnType<typeof spawnNetworkWorker> {
  const { api, internal } = startSameThread(jamNetwork.protocol);

  const networkFinish = jamNetwork.main(config, internal);

  return {
    network: api,
    finish: async () => {
      await api.sendFinish();
      await networkFinish;
    },
  };
}

export async function spawnBlockGeneratorWorker(config: NodeWorkerConfig) {
  const { api, workerFinished } = spawnWorker(blockGenerator.protocol, blockGenerator.WORKER, config, codec.notdefined);

  return {
    generator: api,
    finish: async () => {
      await api.sendFinish();
      await workerFinished;
    },
  };
}

export async function startBlockGenerator(config: DirectWorkerConfig): ReturnType<typeof spawnBlockGeneratorWorker> {
  const { api, internal } = startSameThread(blockGenerator.protocol);
  const finish = blockGenerator.main(config, internal);

  return {
    generator: api,
    finish: async () => {
      await api.sendFinish();
      await finish;
    },
  };
}
