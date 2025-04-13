import assert from "node:assert";
import { Block } from "@typeberry/block";
import { Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { InMemoryBlocks } from "@typeberry/database";
import { SimpleAllocator, keccak } from "@typeberry/hash";
import type { FromJson } from "@typeberry/json-parser";
import { merkelizeState, serializeState } from "@typeberry/state-merkleization";
import { TransitionHasher } from "@typeberry/transition";
import { OnChain } from "@typeberry/transition/chain-stf";
import { deepEqual } from "@typeberry/utils";
import { BlockVerifier } from "../../../packages/jam/transition/block-verification";
import { blockFromJson } from "../w3f/codec/block";
import { TestState, loadState } from "./stateLoader";

export class StateTransition {
  static fromJson: FromJson<StateTransition> = {
    pre_state: TestState.fromJson,
    post_state: TestState.fromJson,
    block: blockFromJson,
  };
  pre_state!: TestState;
  post_state!: TestState;
  block!: Block;
}

const keccakHasher = keccak.KeccakHasher.create();

export async function runStateTransition(testContent: StateTransition, _path: string) {
  const spec = tinyChainSpec;
  const preState = loadState(testContent.pre_state.keyvals);
  const preStateSerialized = serializeState(preState, spec);

  const postState = loadState(testContent.post_state.keyvals);
  const postStateSerialized = serializeState(postState, spec);

  const preStateRoot = merkelizeState(preStateSerialized);
  const postStateRoot = merkelizeState(postStateSerialized);

  const encodedBlock = Encoder.encodeObject(Block.Codec, testContent.block, spec);
  const blockView = Decoder.decodeObject(Block.Codec.View, encodedBlock, spec);

  const stf = new OnChain(
    spec,
    preState,
    new InMemoryBlocks(),
    new TransitionHasher(spec, await keccakHasher, new SimpleAllocator()),
  );

  // verify that we compute the state root exactly the same.
  assert.deepStrictEqual(testContent.pre_state.state_root.toString(), preStateRoot.toString());
  assert.deepStrictEqual(testContent.post_state.state_root.toString(), postStateRoot.toString());

  const verifier = new BlockVerifier(stf.hasher);
  const verificationResult = await verifier.verifyBlock(blockView);
  if (verificationResult.isError) {
    assert.fail(`Block verification failed, got: ${JSON.stringify(verificationResult.error)}`);
  }

  // now perform the state transition
  const stfResult = await stf.transition(blockView, verificationResult.ok);
  if (stfResult.isError) {
    assert.fail(`Expected the transition to go smoothly, got error: ${JSON.stringify(stfResult.error)}`);
  }

  // if the stf was successful compare the resulting state and the root (redundant, but double checking).
  const root = merkelizeState(serializeState(stf.state, spec));
  deepEqual(stf.state, postState);
  assert.deepStrictEqual(root.toString(), postStateRoot.toString());
}
