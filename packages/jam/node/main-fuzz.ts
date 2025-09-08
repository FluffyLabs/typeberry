import { Block, Header, type HeaderHash, type StateRootHash } from "@typeberry/block";
import { Decoder, Encoder } from "@typeberry/codec";
import { BlockImportError, Version, startFuzzTarget } from "@typeberry/ext-ipc";
import { Logger } from "@typeberry/logger";
import type { StateEntries } from "@typeberry/state-merkleization";
import { CURRENT_VERSION, Result } from "@typeberry/utils";
import { getChainSpec } from "./common.js";
import type { JamConfig } from "./jam-config.js";
import { type NodeApi, main } from "./main.js";
import packageJson from "./package.json" with { type: "json" };

export type FuzzConfig = {
  jamNodeConfig: JamConfig;
};

const logger = Logger.new(import.meta.filename, "fuzztarget");
// A number large enough to not collide with near-future date.
const NEXT_FUZZ_SEED = BigInt(1_000 * 3_600 * 24 * 30 * 12 * 2);

export async function mainFuzz(fuzzConfig: FuzzConfig, withRelPath: (v: string) => string) {
  logger.info("💨 Fuzzer starting up.");

  const { jamNodeConfig: config } = fuzzConfig;

  let runningNode: NodeApi | null = null;
  let fuzzSeed = BigInt(Date.now());

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
    resetState: async (header: Header, state: StateEntries): Promise<StateRootHash> => {
      if (runningNode !== null) {
        const finish = runningNode.close();
        runningNode = null;
        await finish;
      }
      fuzzSeed += NEXT_FUZZ_SEED;
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
              genesisState: new Map(state),
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
