import assert from "node:assert";

import { type Extrinsic, type TimeSlot, type ValidatorIndex, tryAsPerValidator } from "@typeberry/block";
import { getExtrinsicFromJson } from "@typeberry/block-json";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import type { U32 } from "@typeberry/numbers";
import { ActivityRecord, type ValidatorData } from "@typeberry/state";
import { Statistics, type StatisticsState } from "@typeberry/transition/statistics";
import { commonFromJson } from "./common-types";

class TinyInput {
  static fromJson: FromJson<TinyInput> = {
    slot: "number",
    author_index: "number",
    extrinsic: getExtrinsicFromJson(tinyChainSpec),
  };

  slot!: TimeSlot;
  author_index!: ValidatorIndex;
  extrinsic!: Extrinsic;
}

class FullInput {
  static fromJson: FromJson<FullInput> = {
    slot: "number",
    author_index: "number",
    extrinsic: getExtrinsicFromJson(fullChainSpec),
  };

  slot!: TimeSlot;
  author_index!: ValidatorIndex;
  extrinsic!: Extrinsic;
}

class TestActivityRecord {
  static fromJson = json.object<TestActivityRecord, ActivityRecord>(
    {
      blocks: "number",
      tickets: "number",
      pre_images: "number",
      pre_images_size: "number",
      guarantees: "number",
      assurances: "number",
    },
    ({ blocks, tickets, pre_images, pre_images_size, guarantees, assurances }) => {
      return ActivityRecord.fromCodec({
        blocks,
        tickets,
        preImages: pre_images,
        preImagesSize: pre_images_size,
        guarantees,
        assurances,
      });
    },
  );

  blocks!: U32;
  tickets!: U32;
  pre_images!: U32;
  pre_images_size!: U32;
  guarantees!: U32;
  assurances!: U32;
}

class TestState {
  static fromJson: FromJson<TestState> = {
    pi: {
      current: json.array(TestActivityRecord.fromJson),
      last: json.array(TestActivityRecord.fromJson),
    },
    tau: "number",
    kappa_prime: json.array(commonFromJson.validatorData),
  };

  pi!: {
    current: ActivityRecord[];
    last: ActivityRecord[];
  };
  tau!: TimeSlot;
  kappa_prime!: ValidatorData[];

  static toStatisticsState(state: TestState, spec: ChainSpec): StatisticsState {
    return {
      statisticsPerValidator: {
        current: tryAsPerValidator(state.pi.current, spec),
        previous: tryAsPerValidator(state.pi.last, spec),
      },
      timeSlot: state.tau,
      posteriorActiveValidators: tryAsPerValidator(state.kappa_prime, spec),
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
  input!: TinyInput;
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
  input!: FullInput;
  pre_state!: TestState;
  output!: null;
  post_state!: TestState;
}

export async function runStatisticsTestTiny({ input, pre_state, post_state }: StatisticsTestTiny) {
  const spec = tinyChainSpec;
  const statistics = new Statistics(TestState.toStatisticsState(pre_state, spec), spec);

  statistics.transition(input.slot, input.author_index, input.extrinsic);

  assert.deepStrictEqual(statistics.state, TestState.toStatisticsState(post_state, spec));
}

export async function runStatisticsTestFull({ input, pre_state, post_state }: StatisticsTestFull) {
  const spec = fullChainSpec;
  const statistics = new Statistics(TestState.toStatisticsState(pre_state, spec), spec);

  statistics.transition(input.slot, input.author_index, input.extrinsic);

  assert.deepStrictEqual(statistics.state, TestState.toStatisticsState(post_state, spec));
}
