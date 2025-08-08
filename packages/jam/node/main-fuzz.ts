import { Block, Header, type HeaderHash, type StateRootHash } from "@typeberry/block";
import { Decoder, Encoder } from "@typeberry/codec";
import { Version, startFuzzTarget } from "@typeberry/ext-ipc";
import { Logger } from "@typeberry/logger";
import type { StateEntries, TruncatedEntries } from "@typeberry/state-merkleization";
import { CURRENT_VERSION, Result } from "@typeberry/utils";
import { getChainSpec } from "./common.js";
import type { JamConfig } from "./jam-config.js";
import { type NodeApi, main } from "./main.js";
import packageJson from "./package.json" with { type: "json" };

export type FuzzConfig = {
  jamNodeConfig: JamConfig;
};

export enum BlockImportError {
  NodeNotRunning = 0,
  BlockRejected = 1,
}

const logger = Logger.new(import.meta.filename, "fuzztarget");

export async function mainFuzz(fuzzConfig: FuzzConfig, withRelPath: (v: string) => string) {
  logger.info("💨 Fuzzer starting up.");

  const { jamNodeConfig: config } = fuzzConfig;

  let runningNode: NodeApi | null = null;
  let fuzzSeed = Date.now();

  const chainSpec = getChainSpec(config.node.flavor);

  const closeFuzzTarget = startFuzzTarget({
    nodeName: packageJson.name,
    nodeVersion: Version.tryFromString(packageJson.version),
    gpVersion: Version.tryFromString(CURRENT_VERSION),
    chainSpec,
    importBlock: async (block: Block): Promise<Result<StateRootHash, BlockImportError>> => {
      if (runningNode === null) {
        return Result.error(BlockImportError.NodeNotRunning);
      }
      const encoded = Encoder.encodeObject(Block.Codec, block, chainSpec);
      const blockView = Decoder.decodeObject(Block.Codec.View, encoded, chainSpec);
      const importResult = await runningNode.importBlock(blockView);
      if (importResult === null) {
        return Result.error(BlockImportError.BlockRejected);
      }
      return Result.ok(importResult);
    },
    getPostSerializedState: async (hash: HeaderHash): Promise<StateEntries | null> => {
      if (runningNode === null) {
        return null;
      }
      return runningNode.getStateEntries(hash);
    },
    resetState: async (header: Header, state: StateEntries<TruncatedEntries>): Promise<StateRootHash> => {
      if (runningNode !== null) {
        const finish = runningNode.close();
        runningNode = null;
        await finish;
      }
      fuzzSeed += 1_000_000_000;
      // update the chainspec
      const newNode = await main(
        {
          ...config,
          node: {
            ...config.node,
            databaseBasePath: `${config.node.databaseBasePath}/fuzz/${fuzzSeed}`,
            chainSpec: {
              ...config.node.chainSpec,
              genesisHeader: Encoder.encodeObject(Header.Codec, header, chainSpec),
              genesisState: new Map(state.entries.data.entries()),
            },
          },
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
