import assert from "node:assert";
import { Block } from "@typeberry/block";
import { blockFromJson } from "@typeberry/block-json";
import { Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { InMemoryBlocks } from "@typeberry/database";
import { SimpleAllocator, keccak } from "@typeberry/hash";
import type { FromJson } from "@typeberry/json-parser";
import { merkelizeState, serializeState } from "@typeberry/state-merkleization";
import { TransitionHasher } from "@typeberry/transition";
import { BlockVerifier } from "@typeberry/transition/block-verifier";
import { OnChain } from "@typeberry/transition/chain-stf";
import { deepEqual, resultToString } from "@typeberry/utils";
import { TestState, loadState } from "./stateLoader";

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

export async function runStateTransition(testContent: StateTransition, _path: string) {
  const spec = tinyChainSpec;
  const preState = loadState(spec, testContent.pre_state.keyvals);
  console.log(`Loaded state: ${preState}`);
  console.log(`Loaded services: ${Array.from(preState.services.entries())}`);
  const preStateSerialized = serializeState(preState, spec);

  const postState = loadState(spec, testContent.post_state.keyvals);
  const postStateSerialized = serializeState(postState, spec);

  const preStateRoot = merkelizeState(preStateSerialized);
  const postStateRoot = merkelizeState(postStateSerialized);

  const encodedBlock = Encoder.encodeObject(Block.Codec, testContent.block, spec);
  const blockView = Decoder.decodeObject(Block.Codec.View, encodedBlock, spec);
  const blocksDb = new InMemoryBlocks();

  const stf = new OnChain(
    spec,
    preState,
    blocksDb,
    new TransitionHasher(spec, await keccakHasher, new SimpleAllocator()),
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

  preState.applyUpdate(stfResult.ok);

  // if the stf was successful compare the resulting state and the root (redundant, but double checking).
  const root = merkelizeState(serializeState(preState, spec));
  deepEqual(preState, postState);
  assert.deepStrictEqual(root.toString(), postStateRoot.toString());
}
