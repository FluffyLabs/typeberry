import type { Extrinsic, TimeSlot, ValidatorIndex } from "@typeberry/block";
import { fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import type { U32 } from "@typeberry/numbers";
import { ActivityRecord, type ValidatorData } from "@typeberry/state";
import { logger } from "../common";
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

class TestCoreStatistics {
  static fromJson: FromJson<TestCoreStatistics> = {
    da_load: "number",
    popularity: "number",
    imports: "number",
    exports: "number",
    extrinsic_size: "number",
    extrinsic_count: "number",
    bundle_size: "number",
    gas_used: "number",
  };

  da_load!: number;
  popularity!: number;
  imports!: number;
  exports!: number;
  extrinsic_size!: number;
  extrinsic_count!: number;
  bundle_size!: number;
  gas_used!: number;
}

class TestServiceRecord {
  static fromJson: FromJson<TestServiceRecord> = {
    provided_count: "number",
    provided_size: "number",
    refinement_count: "number",
    refinement_gas_used: "number",
    imports: "number",
    exports: "number",
    extrinsic_size: "number",
    extrinsic_count: "number",
    accumulate_count: "number",
    accumulate_gas_used: "number",
    on_transfers_count: "number",
    on_transfers_gas_used: "number",
  };
  provided_count!: number;
  provided_size!: number;
  refinement_count!: number;
  refinement_gas_used!: number;
  imports!: number;
  exports!: number;
  extrinsic_size!: number;
  extrinsic_count!: number;
  accumulate_count!: number;
  accumulate_gas_used!: number;
  on_transfers_count!: number;
  on_transfers_gas_used!: number;
}

class TestServiceStatistics {
  static fromJson: FromJson<TestServiceStatistics> = {
    id: "number",
    record: TestServiceRecord.fromJson,
  };

  id!: number;
  record!: TestServiceRecord;
}

class TestStatisticsState {
  static fromJson: FromJson<TestStatisticsState> = {
    vals_current: json.array(TestActivityRecord.fromJson),
    vals_last: json.array(TestActivityRecord.fromJson),
    cores: json.array(TestCoreStatistics.fromJson),
    services: json.array(TestServiceStatistics.fromJson),
  };

  vals_current!: ActivityRecord[];
  vals_last!: ActivityRecord[];
  cores!: TestCoreStatistics[];
  services!: TestServiceStatistics[];
}

class TestState {
  static fromJson: FromJson<TestState> = {
    statistics: TestStatisticsState.fromJson,
    slot: "number",
    curr_validators: json.array(commonFromJson.validatorData),
  };

  statistics!: TestStatisticsState;
  slot!: TimeSlot;
  curr_validators!: ValidatorData[];
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
  logger.log(`StatisticsTestFull { ${input}, ${pre_state}, ${post_state} }`);
  //const spec = tinyChainSpec;
  //const statistics = new Statistics(spec, TestState.toStatisticsState(pre_state, spec));
  //statistics.transition(input.slot, input.author_index, input.extrinsic);
  // TODO [MaSo] Update to GP 0.6.4
  // assert.deepStrictEqual(statistics.state, TestState.toStatisticsState(post_state, spec));
}

export async function runStatisticsTestFull({ input, pre_state, post_state }: StatisticsTestFull) {
  logger.log(`StatisticsTestFull { ${input}, ${pre_state}, ${post_state} }`);
  // const spec = fullChainSpec;
  //const statistics = new Statistics(spec, TestState.toStatisticsState(pre_state, spec));
  //statistics.transition(input.slot, input.author_index, input.extrinsic);
  // TODO [MaSo] Update to GP 0.6.4
  // assert.deepStrictEqual(statistics.state, TestState.toStatisticsState(post_state, spec));
}
