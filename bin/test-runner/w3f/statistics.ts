import assert from "node:assert";
import {
  type Extrinsic,
  type TimeSlot,
  type ValidatorIndex,
  tryAsPerValidator,
} from "@typeberry/block";
import { getExtrinsicFromJson } from "@typeberry/block-json";
import { ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import { Input, Statistics, type StatisticsState } from "@typeberry/transition/statistics";
import {validatorDataFromJson} from "@typeberry/state-json/validator-data";
import {JsonStatisticsData } from "@typeberry/state-json";
import {ValidatorData} from "@typeberry/state";

class TinyInput {
  static fromJson = json.object<TinyInput, Input>(
    {
      slot: "number",
      author_index: "number",
      extrinsic: getExtrinsicFromJson(tinyChainSpec),
    },
    ({ slot, author_index, extrinsic }) => {
      return {
        slot,
        authorIndex: author_index,
        extrinsic,
        availableReports: [],
      };
    },
  );

  slot!: TimeSlot;
  author_index!: ValidatorIndex;
  extrinsic!: Extrinsic;
}

class FullInput {
  static fromJson = json.object<FullInput, Input>(
    {
      slot: "number",
      author_index: "number",
      extrinsic: getExtrinsicFromJson(fullChainSpec),
    },
    ({ slot, author_index, extrinsic }) => {
      return {
        slot,
        authorIndex: author_index,
        extrinsic,
        availableReports: [],
      };
    },
  );

  slot!: TimeSlot;
  author_index!: ValidatorIndex;
  extrinsic!: Extrinsic;
}

class TestState {
  static fromJson: FromJson<TestState> = {
    statistics: JsonStatisticsData.fromJson,
    slot: "number",
    curr_validators: json.array(validatorDataFromJson),
  };

  statistics!: JsonStatisticsData;
  slot!: TimeSlot;
  curr_validators!: ValidatorData[];

  static toStatisticsState(spec: ChainSpec, state: TestState): StatisticsState {
    return {
      statistics: JsonStatisticsData.toStatisticsData(spec, state.statistics),
      timeslot: state.slot,
      currentValidatorData: tryAsPerValidator(state.curr_validators, spec),
    };
  }
}

export class StatisticsTestTiny {
  static fromJson: FromJson<StatisticsTestTiny> = {
    input: TinyInput.fromJson,
    pre_state: TestState.fromJson,
    output: json.fromAny(() => null),
    post_state: TestState.fromJson,
  };
  input!: Input;
  pre_state!: TestState;
  output!: null;
  post_state!: TestState;
}

export class StatisticsTestFull {
  static fromJson: FromJson<StatisticsTestFull> = {
    input: FullInput.fromJson,
    pre_state: TestState.fromJson,
    output: json.fromAny(() => null),
    post_state: TestState.fromJson,
  };
  input!: Input;
  pre_state!: TestState;
  output!: null;
  post_state!: TestState;
}

export async function runStatisticsTestTiny({ input, pre_state, post_state }: StatisticsTestTiny) {
  const spec = tinyChainSpec;
  const statistics = new Statistics(spec, TestState.toStatisticsState(spec, pre_state));
  assert.deepStrictEqual(statistics.state, TestState.toStatisticsState(spec, pre_state));
  statistics.transition(input);
  assert.deepStrictEqual(statistics.state, TestState.toStatisticsState(spec, post_state));
}

export async function runStatisticsTestFull({ input, pre_state, post_state }: StatisticsTestFull) {
  const spec = fullChainSpec;
  const statistics = new Statistics(spec, TestState.toStatisticsState(spec, pre_state));
  assert.deepStrictEqual(statistics.state, TestState.toStatisticsState(spec, pre_state));
  statistics.transition(input);
  assert.deepStrictEqual(statistics.state, TestState.toStatisticsState(spec, post_state));
}

