import * as blockGenerator from "@typeberry/block-generator";
import type { BlocksDb, LeafDb, StatesDb } from "@typeberry/database";
import * as importer from "@typeberry/importer";
import * as jamNetwork from "@typeberry/jam-network";
import type { SerializedState } from "@typeberry/state-merkleization";
import { type DirectWorkerConfig, startSameThread } from "@typeberry/workers-api";

export async function startImporter(
  config: DirectWorkerConfig<importer.ImporterConfig, BlocksDb, StatesDb<SerializedState<LeafDb>>>,
) {
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

export async function startNetwork(config: DirectWorkerConfig<jamNetwork.NetworkingConfig>) {
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

export async function startBlockGenerator(config: DirectWorkerConfig) {
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
