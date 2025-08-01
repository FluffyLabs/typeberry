import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { Block } from "@typeberry/block";
import { blockFromJson } from "@typeberry/block-json";
import { Decoder, Encoder } from "@typeberry/codec";
import { type ChainSpec, tinyChainSpec } from "@typeberry/config";
import { InMemoryBlocks } from "@typeberry/database";
import { SimpleAllocator, WithHash, keccak } from "@typeberry/hash";
import { type FromJson, parseFromJson } from "@typeberry/json-parser";
import { StateEntries } from "@typeberry/state-merkleization";
import { TransitionHasher } from "@typeberry/transition";
import { BlockVerifier } from "@typeberry/transition/block-verifier.js";
import { OnChain } from "@typeberry/transition/chain-stf.js";
import { Compatibility, GpVersion, deepEqual, resultToString } from "@typeberry/utils";
import { TestState, loadState } from "./state-loader.js";

export class StateTransition {
  static fromJson: FromJson<StateTransition> = {
    pre_state: TestState.fromJson,
    post_state: TestState.fromJson,
    block: blockFromJson(tinyChainSpec),
  };
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
    const content = parseFromJson(parsed, StateTransition.fromJson);
    blocks.push(content.block);
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
  const preStateSerialized = StateEntries.serializeInMemory(spec, preState);

  const postState = loadState(spec, testContent.post_state.keyvals);
  const postStateSerialized = StateEntries.serializeInMemory(spec, postState);

  const preStateRoot = preStateSerialized.getRootHash();
  const postStateRoot = postStateSerialized.getRootHash();

  const blockView = blockAsView(spec, testContent.block);
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

  const stf = new OnChain(spec, preState, blocksDb, hasher, { enableParallelSealVerification: false });

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

  preState.applyUpdate(stfResult.ok);

  // if the stf was successful compare the resulting state and the root (redundant, but double checking).
  const root = StateEntries.serializeInMemory(spec, preState).getRootHash();

  let ignore: string[] = [];
  if (!Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
    // NOTE These fields were introduced in version 0.6.7.
    ignore = ["info.created", "info.gratisStorage", "info.lastAccumulation", "info.parentService"];
  }
  deepEqual(preState, postState, { ignore });
  assert.deepStrictEqual(root.toString(), postStateRoot.toString());
}
