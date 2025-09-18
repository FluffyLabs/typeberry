import fs from "node:fs/promises";
import { BlockView, Header, type HeaderHash, type StateRootHash, type TimeSlot } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { type FuzzVersion, startFuzzTarget, Version } from "@typeberry/ext-ipc";
import { HASH_SIZE } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import type { StateEntries } from "@typeberry/state-merkleization";
import { CURRENT_VERSION, Result } from "@typeberry/utils";
import { getChainSpec } from "./common.js";
import type { JamConfig } from "./jam-config.js";
import { type NodeApi } from "./main.js";
import packageJson from "./package.json" with { type: "json" };
import {mainImporter} from "./main-importer.js";

export type FuzzConfig = {
  version: FuzzVersion;
  jamNodeConfig: JamConfig;
  socket: string | null;
};

const logger = Logger.new(import.meta.filename, "fuzztarget");

export function getFuzzDetails() {
  return {
    nodeName: "@typeberry/jam",
    nodeVersion: Version.tryFromString(packageJson.version),
    gpVersion: Version.tryFromString(CURRENT_VERSION.split("-")[0]),
  };
}

export async function mainFuzz(fuzzConfig: FuzzConfig, withRelPath: (v: string) => string) {
  logger.info(`💨 Fuzzer V${fuzzConfig.version} starting up.`);

  const { jamNodeConfig: config } = fuzzConfig;

  let runningNode: NodeApi | null = null;
  const fuzzSeed = BigInt(Date.now());

  const chainSpec = getChainSpec(config.node.flavor);

  const closeFuzzTarget = startFuzzTarget(fuzzConfig.version, fuzzConfig.socket, {
    ...getFuzzDetails(),
    chainSpec,
    importBlock: async (blockView: BlockView): Promise<Result<StateRootHash, string>> => {
      if (runningNode === null) {
        return Result.error("node not running");
      }
      const importResult = await runningNode.importBlock(blockView);
      return importResult;
    },
    getBestStateRootHash: async (): Promise<StateRootHash> => {
      if (runningNode === null) {
        return Bytes.zero(HASH_SIZE).asOpaque();
      }
      return runningNode.getBestStateRootHash();
    },
    getPostSerializedState: async (hash: HeaderHash): Promise<StateEntries | null> => {
      if (runningNode === null) {
        return null;
      }
      return runningNode.getStateEntries(hash);
    },
    resetState: async (
      header: Header,
      state: StateEntries,
      ancestry: [HeaderHash, TimeSlot][],
    ): Promise<StateRootHash> => {
      if (runningNode !== null) {
        const finish = runningNode.close();
        runningNode = null;
        await finish;
      }
      const databaseBasePath = `${config.node.databaseBasePath}/fuzz/${fuzzSeed}`;
      // remove the database
      await fs.rm(databaseBasePath, { recursive: true, force: true });
      // update the chainspec
      const newNode = await mainImporter(
        {
          ...config,
          node: {
            ...config.node,
            databaseBasePath,
            chainSpec: {
              ...config.node.chainSpec,
              genesisHeader: Encoder.encodeObject(Header.Codec, header, chainSpec),
              genesisState: new Map(state),
            },
          },
          ancestry,
          network: null,
        },
        withRelPath,
      );
      runningNode = newNode;
      return await newNode.getBestStateRootHash();
    },
  });

  return closeFuzzTarget;
}
