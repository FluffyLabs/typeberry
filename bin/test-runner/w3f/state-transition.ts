import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { Block, Header } from "@typeberry/block";
import { blockFromJson, headerFromJson } from "@typeberry/block-json";
import { Decoder, Encoder, codec } from "@typeberry/codec";
import { type ChainSpec, tinyChainSpec } from "@typeberry/config";
import { InMemoryBlocks } from "@typeberry/database";
import { SimpleAllocator, WithHash, keccak } from "@typeberry/hash";
import { type FromJson, parseFromJson } from "@typeberry/json-parser";
import { emptyBlock } from "@typeberry/node";
import { serializeStateUpdate } from "@typeberry/state-merkleization";
import { TransitionHasher } from "@typeberry/transition";
import { BlockVerifier } from "@typeberry/transition/block-verifier.js";
import { OnChain } from "@typeberry/transition/chain-stf.js";
import { deepEqual, resultToString } from "@typeberry/utils";
import { TestState, loadState } from "./state-loader.js";

export class StateTransitionGenesis {
  static fromJson: FromJson<StateTransitionGenesis> = {
    header: headerFromJson,
    state: TestState.fromJson,
  };

  static Codec = codec.object({
    header: Header.Codec,
    state: TestState.Codec,
  });

  header!: Header;
  state!: TestState;
}

const blockFromJsonCodec = blockFromJson(tinyChainSpec);

export class StateTransition {
  static fromJson: FromJson<StateTransition> = {
    pre_state: TestState.fromJson,
    post_state: TestState.fromJson,
    block: blockFromJsonCodec,
  };

  static Codec = codec.object({
    pre_state: TestState.Codec,
    block: Block.Codec,
    post_state: TestState.Codec,
  });

  pre_state!: TestState;
  post_state!: TestState;
  block!: Block;
}

const keccakHasher = keccak.KeccakHasher.create();

const cachedBlocks = new Map<string, Block[]>();
function loadBlocks(testPath: string) {
  const dir = path.dirname(testPath);
  const fromCache = cachedBlocks.get(dir);
  if (fromCache !== undefined) {
    return fromCache;
  }

  const blocks: Block[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const data = fs.readFileSync(path.join(dir, file), "utf8");
    const parsed = JSON.parse(data);
    if (file.endsWith("genesis.json")) {
      const content = parseFromJson(parsed, StateTransitionGenesis.fromJson);
      const genesisBlock = Block.create({ header: content.header, extrinsic: emptyBlock().extrinsic });
      blocks.push(genesisBlock);
    } else {
      const content = parseFromJson(parsed, StateTransition.fromJson);
      blocks.push(content.block);
    }
  }

  blocks.sort((a, b) => a.header.timeSlotIndex - b.header.timeSlotIndex);
  cachedBlocks.set(dir, blocks);
  return blocks;
}

function blockAsView(spec: ChainSpec, block: Block) {
  const encodedBlock = Encoder.encodeObject(Block.Codec, block, spec);
  const blockView = Decoder.decodeObject(Block.Codec.View, encodedBlock, spec);
  return blockView;
}

export async function runStateTransition(testContent: StateTransition, testPath: string) {
  const spec = tinyChainSpec;

  const preState = loadState(spec, testContent.pre_state.keyvals);
  const preStateRoot = preState.backend.getRootHash();

  const postState = loadState(spec, testContent.post_state.keyvals);
  const postStateRoot = postState.backend.getRootHash();

  const encodedBlock = Encoder.encodeObject(Block.Codec, testContent.block, spec);
  const blockView = Decoder.decodeObject(Block.Codec.View, encodedBlock, spec);

  const allBlocks = loadBlocks(testPath);
  const myBlockIndex = allBlocks.findIndex(
    ({ header }) => header.timeSlotIndex === testContent.block.header.timeSlotIndex,
  );
  const previousBlocks = allBlocks.slice(0, myBlockIndex);

  const hasher = new TransitionHasher(spec, await keccakHasher, new SimpleAllocator());

  const blocksDb = InMemoryBlocks.fromBlocks(
    previousBlocks.map((block) => {
      const blockView = blockAsView(spec, block);
      const headerHash = hasher.header(blockView.header.view());
      return new WithHash(headerHash.hash, blockView);
    }),
  );

  const stf = new OnChain(
    spec,
    preState,
    blocksDb,
    new TransitionHasher(spec, await keccakHasher, new SimpleAllocator()),
    { enableParallelSealVerification: false },
  );

  // verify that we compute the state root exactly the same.
  assert.deepStrictEqual(testContent.pre_state.state_root.toString(), preStateRoot.toString());
  assert.deepStrictEqual(testContent.post_state.state_root.toString(), postStateRoot.toString());

  const verifier = new BlockVerifier(stf.hasher, blocksDb);
  // NOTE [ToDr] we skip full verification here, since we can run tests in isolation
  // (i.e. no block history)
  const headerHash = verifier.hashHeader(blockView);

  // now perform the state transition
  const stfResult = await stf.transition(blockView, headerHash.hash);
  if (stfResult.isError) {
    assert.fail(`Expected the transition to go smoothly, got error: ${resultToString(stfResult)}`);
  }

  preState.backend.applyUpdate(serializeStateUpdate(spec, stfResult.ok));

  // if the stf was successful compare the resulting state and the root (redundant, but double checking).
  const root = preState.backend.getRootHash();

  deepEqual(
    Object.fromEntries(preState.backend.entries.data.entries()),
    Object.fromEntries(postState.backend.entries.data.entries()),
  );
  assert.deepStrictEqual(root.toString(), postStateRoot.toString());
}
