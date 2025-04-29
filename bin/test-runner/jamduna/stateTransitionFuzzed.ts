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
import { BlockVerifier } from "@typeberry/transition/block-verification";
import { OnChain } from "@typeberry/transition/chain-stf";
import { TestState, loadState } from "./stateLoader";

export class StateTransitionFuzzed {
  static fromJson: FromJson<StateTransitionFuzzed> = {
    pre_state: TestState.fromJson,
    block: blockFromJson(tinyChainSpec),
  };
  pre_state!: TestState;
  block!: Block;
}

const keccakHasher = keccak.KeccakHasher.create();

export async function runStateTransitionFuzzed(testContent: StateTransitionFuzzed, _path: string) {
  const spec = tinyChainSpec;
  const preState = loadState(testContent.pre_state.keyvals);
  const preStateSerialized = serializeState(preState, spec);

  const preStateRoot = merkelizeState(preStateSerialized);

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

  const verifier = new BlockVerifier(stf.hasher, blocksDb);
  const verificationResult = await verifier.verifyBlock(blockView, stf.state.timeslot);
  if (verificationResult.isError) {
    assert.fail(`Block verification failed, got: ${JSON.stringify(verificationResult.error)}`);
  }

  // now perform the state transition
  const stfResult = await stf.transition(blockView, verificationResult.ok);
  if (stfResult.isError) {
    assert.fail(`Expected the transition to go smoothly, got error: ${JSON.stringify(stfResult.error)}`);
  }

  // if the stf was successful compare the resulting state and the root (redundant, but double checking).
  const _root = merkelizeState(serializeState(stf.state, spec));
}
