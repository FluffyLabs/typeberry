import assert from "node:assert";
import {
  type Extrinsic,
  type TimeSlot,
  type ValidatorIndex,
  tryAsPerValidator,
  tryAsServiceId,
} from "@typeberry/block";
import { getExtrinsicFromJson } from "@typeberry/block-json";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import { InMemoryState, ServiceStatistics, type ValidatorData } from "@typeberry/state";
import { JsonStatisticsData, validatorDataFromJson } from "@typeberry/state-json";
import { type Input, Statistics, type StatisticsState } from "@typeberry/transition/statistics";

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
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
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
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
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

export async function runStatisticsTest(
  { input, pre_state, post_state }: StatisticsTestTiny | StatisticsTestFull,
  spec: ChainSpec,
) {
  input.incomingReports = input.extrinsic.guarantees.map((g) => g.report);

  const preState = TestState.toStatisticsState(spec, pre_state);
  const postState = TestState.toStatisticsState(spec, post_state);
  const statistics = new Statistics(spec, preState);
  assert.deepStrictEqual(statistics.state, preState);

  // when
  const update = statistics.transition(input);
  const state = InMemoryState.partial(spec, preState);
  state.applyUpdate(update);

  // NOTE [MaSo] This is a workaround for the fact that the test data does not contain any posterior service statistics.
  assert.deepStrictEqual(postState.statistics.services.size, 0, "We expect services are not calculated.");
  if (state.statistics.services.size > 0) {
    const serviceStatistics = state.statistics.services.get(tryAsServiceId(0)) ?? ServiceStatistics.empty();
    postState.statistics.services.set(tryAsServiceId(0), serviceStatistics);
  }

  // then
  assert.deepStrictEqual(state, InMemoryState.partial(spec, postState));
}

export async function runStatisticsTestTiny(test: StatisticsTestTiny) {
  await runStatisticsTest(test, tinyChainSpec);
}

export async function runStatisticsTestFull(test: StatisticsTestFull) {
  await runStatisticsTest(test, fullChainSpec);
}
