import assert from "node:assert";

import type { Extrinsic, TimeSlot, ValidatorData, ValidatorIndex } from "@typeberry/block";
import { fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import type { U32 } from "@typeberry/numbers";
import { ActivityRecord, Statistics, StatisticsState } from "@typeberry/statistics";
import { getExtrinsicFromJson } from "./codec/extrinsic";
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
  static fromJson: FromJson<TestActivityRecord> = {
    blocks: "number",
    tickets: "number",
    pre_images: "number",
    pre_images_size: "number",
    guarantees: "number",
    assurances: "number",
  };

  blocks!: U32;
  tickets!: U32;
  pre_images!: U32;
  pre_images_size!: U32;
  guarantees!: U32;
  assurances!: U32;

  static toActivityRecords(ars: TestActivityRecord[]): ActivityRecord[] {
    return ars.map(TestActivityRecord.toActivityRecord);
  }

  static toActivityRecord(ar: TestActivityRecord): ActivityRecord {
    return new ActivityRecord(ar.blocks, ar.tickets, ar.pre_images, ar.pre_images_size, ar.guarantees, ar.assurances);
  }
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
    current: TestActivityRecord[];
    last: TestActivityRecord[];
  };
  tau!: TimeSlot;
  kappa_prime!: ValidatorData[];

  static toStatisticsState(state: TestState): StatisticsState {
    return new StatisticsState(
      {
        current: TestActivityRecord.toActivityRecords(state.pi.current),
        last: TestActivityRecord.toActivityRecords(state.pi.last),
      },
      state.tau,
      state.kappa_prime,
    );
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
  const statistics = new Statistics(TestState.toStatisticsState(pre_state), tinyChainSpec);

  statistics.transition(input.slot, input.author_index, input.extrinsic);

  assert.deepStrictEqual(statistics.state, TestState.toStatisticsState(post_state));
}

export async function runStatisticsTestFull({ input, pre_state, post_state }: StatisticsTestFull) {
  const statistics = new Statistics(TestState.toStatisticsState(pre_state), fullChainSpec);

  statistics.transition(input.slot, input.author_index, input.extrinsic);

  assert.deepStrictEqual(statistics.state, TestState.toStatisticsState(post_state));
}
