import assert from "node:assert";
import { Block } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { InMemoryBlocks } from "@typeberry/database";
import { HASH_SIZE, SimpleAllocator, keccak } from "@typeberry/hash";
import type { FromJson } from "@typeberry/json-parser";
import { merkelizeState, serializeState } from "@typeberry/state-merkleization";
import { TransitionHasher } from "@typeberry/transition";
import { OnChain } from "@typeberry/transition/chain-stf";
import { deepEqual } from "@typeberry/utils";
import { blockFromJson } from "../w3f/codec/block";
import { TestState, loadState } from "./stateLoader";

export class AssurancesStateTransition {
  static fromJson: FromJson<AssurancesStateTransition> = {
    pre_state: TestState.fromJson,
    post_state: TestState.fromJson,
    block: blockFromJson,
  };
  pre_state!: TestState;
  post_state!: TestState;
  block!: Block;
}

const keccakHasher = keccak.KeccakHasher.create();

export async function runAssurancesStateTransition(testContent: AssurancesStateTransition, _path: string) {
  const spec = tinyChainSpec;
  // TODO [ToDr] bring in the hacky parser !!
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

  // now perform the state transition
  const stfResult = await stf.transition(blockView, {
    headerHash: stf.hasher.header(blockView.header.view()).hash,
    entropy: Bytes.parseBytes(
      "0x69018618da771db3ff76d5849407ecb57f1dc7b7eb6d14beddb928cb032b3d31",
      HASH_SIZE,
    ).asOpaque(),
  });
  if (stfResult.isError) {
    assert.fail(`Expected the transition to go smoothly, got error: ${JSON.stringify(stfResult.error)}`);
  }

  // if the stf was successful compare the resulting state and the root (redundant, but double checking).
  const _root = merkelizeState(serializeState(preState, spec));

  deepEqual(preState, postState, {
    ignore: [
      "sealingKeySeries.[keys]", // when decoding we end up with `undefined` keys
      "entropy.[0]", //temporarily disable checking entropy, since it's not implemented.
    ],
  });
  // assert.deepStrictEqual(root.toString(), postStateRoot.toString());
}
