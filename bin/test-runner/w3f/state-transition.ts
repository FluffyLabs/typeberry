import assert from "node:assert";
import { Block } from "@typeberry/block";
import { blockFromJson } from "@typeberry/block-json";
import { Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { InMemoryBlocks } from "@typeberry/database";
import { SimpleAllocator, keccak } from "@typeberry/hash";
import type { FromJson } from "@typeberry/json-parser";
import { serializeStateUpdate } from "@typeberry/state-merkleization";
import { TransitionHasher } from "@typeberry/transition";
import { BlockVerifier } from "@typeberry/transition/block-verifier.js";
import { OnChain } from "@typeberry/transition/chain-stf.js";
import { deepEqual, resultToString } from "@typeberry/utils";
import { TestState, loadState } from "./state-loader.js";
import { Bytes } from "@typeberry/bytes";

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
  const preStateRoot = preState.backend.getRootHash();

  const postState = loadState(spec, testContent.post_state.keyvals);
  const postStateRoot = postState.backend.getRootHash();

  const encodedBlock = Encoder.encodeObject(Block.Codec, testContent.block, spec);
  const blockView = Decoder.decodeObject(Block.Codec.View, encodedBlock, spec);
  const blocksDb = new InMemoryBlocks();

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

  // console.log("root hash 1", preState.backend.getRootHash().toString());

  // console.log(
  //   "pre value",
  //   preState.backend.entries.data
  //     .get(Bytes.parseBytes("0xff000000000000000000000000000000000000000000000000000000000000", 31).asOpaque())
  //     ?.toString(),
  // );

  // console.log(
  //   "post value",
  //   postState.backend.entries.data
  //     .get(Bytes.parseBytes("0xff000000000000000000000000000000000000000000000000000000000000", 31).asOpaque())
  //     ?.toString(),
  // );

  // console.log("root hash 2", preState.backend.getRootHash().toString());

  preState.backend.applyUpdate(serializeStateUpdate(spec, stfResult.ok));

  // console.log(
  //   "pre post value",
  //   preState.backend.entries.data
  //     .get(Bytes.parseBytes("0xff000000000000000000000000000000000000000000000000000000000000", 31).asOpaque())
  //     ?.toString(),
  // );

  // if the stf was successful compare the resulting state and the root (redundant, but double checking).
  const root = preState.backend.getRootHash();
  // deepEqual(preState, postState);
  assert.deepStrictEqual(root.toString(), postStateRoot.toString());

  // console.log(preState.backend.getRootHash().toString());
  // console.log(postState.backend.getRootHash().toString());

  // for (const [key, value] of preState.backend.entries.data) {
  //   assert.strictEqual(value.toString(), postState.backend.entries.data.get(key)?.toString(), key.toString());
  // }

  // console.log(preState.availabilityAssignment);
  // console.log(preState.designatedValidatorData);
  // console.log(preState.nextValidatorData);
  // console.log(preState.currentValidatorData);
  // console.log(preState.previousValidatorData);
  // console.log(preState.disputesRecords);
  // console.log(preState.timeslot);
  // console.log(preState.entropy);
  // console.log(preState.authPools);
  // console.log(preState.authQueues);
  // console.log(preState.recentBlocks);
  // console.log(preState.statistics);
  // console.log(preState.accumulationQueue);
  // console.log(preState.recentlyAccumulated);
  // console.log(preState.ticketsAccumulator);
  // console.log(preState.sealingKeySeries);
  // console.log(preState.epochRoot);
  // console.log(preState.privilegedServices);

  // assert.deepStrictEqual(preState.availabilityAssignment, postState.availabilityAssignment);
  // assert.deepStrictEqual(preState.designatedValidatorData, postState.designatedValidatorData);
  // assert.deepStrictEqual(preState.nextValidatorData, postState.nextValidatorData);
  // assert.deepStrictEqual(preState.currentValidatorData, postState.currentValidatorData);
  // assert.deepStrictEqual(preState.previousValidatorData, postState.previousValidatorData);
  // assert.deepStrictEqual(preState.disputesRecords, postState.disputesRecords);
  // assert.deepStrictEqual(preState.timeslot, postState.timeslot);
  // assert.deepStrictEqual(preState.entropy, postState.entropy);
  // assert.deepStrictEqual(preState.authPools, postState.authPools);
  // assert.deepStrictEqual(preState.authQueues, postState.authQueues);
  // assert.deepStrictEqual(preState.recentBlocks, postState.recentBlocks);
  // assert.deepStrictEqual(preState.statistics, postState.statistics);
  // assert.deepStrictEqual(preState.accumulationQueue, postState.accumulationQueue);
  // assert.deepStrictEqual(preState.recentlyAccumulated, postState.recentlyAccumulated);
  // assert.deepStrictEqual(preState.ticketsAccumulator, postState.ticketsAccumulator);
  // assert.deepStrictEqual(preState.sealingKeySeries, postState.sealingKeySeries);
  // assert.deepStrictEqual(preState.epochRoot, postState.epochRoot);
  // assert.deepStrictEqual(preState.privilegedServices, postState.privilegedServices);
}
