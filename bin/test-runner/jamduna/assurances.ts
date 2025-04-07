import assert from "node:assert";
import type { Block } from "@typeberry/block";
import { tinyChainSpec } from "@typeberry/config";
import type { FromJson } from "@typeberry/json-parser";
import { merkelizeState, serializeState } from "@typeberry/state-merkleization";
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

export async function runAssurancesStateTransition(testContent: AssurancesStateTransition, _path: string) {
  const spec = tinyChainSpec;
  // TODO [ToDr] bring in the hacky parser !!
  const preState = loadState(testContent.pre_state.keyvals);
  const preStateSerialized = serializeState(preState, spec);

  const postState = loadState(testContent.post_state.keyvals);
  const postStateSerialized = serializeState(postState, spec);

  const preStateRoot = merkelizeState(preStateSerialized);
  const postStateRoot = merkelizeState(postStateSerialized);

  // TODO [ToDr] Also run the state transition using testContent.block.

  assert.deepStrictEqual(testContent.pre_state.state_root.toString(), preStateRoot.toString());
  assert.deepStrictEqual(testContent.post_state.state_root.toString(), postStateRoot.toString());
}
