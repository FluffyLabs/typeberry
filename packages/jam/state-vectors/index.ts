/**
 * State test vectors and fixtures.
 *
 * This module provides test vectors and fixtures for validating state
 * operations and ensuring conformance with the JAM specification.
 *
 * @module state-vectors
 */
import { Block, Header, type StateRootHash } from "@typeberry/block";
import { blockFromJson, fromJson, headerFromJson } from "@typeberry/block-json";
import type { BytesBlob } from "@typeberry/bytes";
import { codec } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE, TRUNCATED_HASH_SIZE, type TruncatedHash } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";

export class StateKeyVal {
  static fromJson: FromJson<StateKeyVal> = {
    key: fromJson.bytesN(TRUNCATED_HASH_SIZE),
    value: fromJson.bytesBlob,
  };
  key!: TruncatedHash;
  value!: BytesBlob;
}

export class TestState {
  static fromJson: FromJson<TestState> = {
    state_root: fromJson.bytes32(),
    keyvals: json.array(StateKeyVal.fromJson),
  };

  static Codec = codec.object({
    state_root: codec.bytes(HASH_SIZE).asOpaque<StateRootHash>(),
    keyvals: codec.sequenceVarLen(
      codec.object({
        key: codec.bytes(TRUNCATED_HASH_SIZE),
        value: codec.blob,
      }),
    ),
  });

  state_root!: StateRootHash;
  keyvals!: StateKeyVal[];
}

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

export class StateTransition {
  static fromJson: FromJson<StateTransition> = {
    pre_state: TestState.fromJson,
    post_state: TestState.fromJson,
    block: blockFromJson(tinyChainSpec),
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
