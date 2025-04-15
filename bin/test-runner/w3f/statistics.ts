import assert from "node:assert";
import {
  type Extrinsic,
  type TimeSlot,
  type ValidatorIndex,
  tryAsPerValidator,
  tryAsServiceId,
} from "@typeberry/block";
import { fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import type { U16, U32 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import { ActivityRecord, CoreRecord, ServiceRecord, type ValidatorData, tryAsPerCore } from "@typeberry/state";
import { type Input, Statistics, type StatisticsState } from "@typeberry/transition/statistics";
import { logger } from "../common";
import { getExtrinsicFromJson } from "./codec/extrinsic";
import { commonFromJson } from "./common-types";

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
  static fromJson = json.object<TestCoreStatistics, CoreRecord>(
    {
      da_load: "number",
      popularity: "number",
      imports: "number",
      exports: "number",
      extrinsic_size: "number",
      extrinsic_count: "number",
      bundle_size: "number",
      gas_used: "number",
    },
    ({ da_load, popularity, imports, exports, extrinsic_size, extrinsic_count, bundle_size, gas_used }) => {
      return CoreRecord.fromCodec({
        dataAvailabilityLoad: da_load,
        popularity,
        imports,
        exports,
        extrinsicSize: extrinsic_size,
        extrinsicCount: extrinsic_count,
        bandleSize: bundle_size,
        gasUsed: gas_used,
      });
    },
  );

  da_load!: U32;
  popularity!: U16;
  imports!: U16;
  exports!: U16;
  extrinsic_size!: U32;
  extrinsic_count!: U16;
  bundle_size!: U32;
  gas_used!: Gas;
}

class TestServiceRecord {
  static fromJson = json.object<TestServiceRecord, ServiceRecord>(
    {
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
    },
    ({
      provided_count,
      provided_size,
      refinement_count,
      refinement_gas_used,
      imports,
      exports,
      extrinsic_size,
      extrinsic_count,
      accumulate_count,
      accumulate_gas_used,
      on_transfers_count,
      on_transfers_gas_used,
    }) => {
      return ServiceRecord.fromCodec({
        providedCount: provided_count,
        providedSize: provided_size,
        refinementCount: refinement_count,
        refinementGasUsed: refinement_gas_used,
        imports,
        exports,
        extrinsicSize: extrinsic_size,
        extrinsicCount: extrinsic_count,
        accumulateCount: accumulate_count,
        accumulateGasUsed: accumulate_gas_used,
        onTransfersCount: on_transfers_count,
        onTransfersGasUsed: on_transfers_gas_used,
      });
    },
  );

  provided_count!: U16;
  provided_size!: U32;
  refinement_count!: U32;
  refinement_gas_used!: Gas;
  imports!: U16;
  exports!: U16;
  extrinsic_size!: U32;
  extrinsic_count!: U16;
  accumulate_count!: U32;
  accumulate_gas_used!: Gas;
  on_transfers_count!: U32;
  on_transfers_gas_used!: Gas;
}

class TestServiceStatistics {
  static fromJson: FromJson<TestServiceStatistics> = {
    id: "number",
    record: TestServiceRecord.fromJson,
  };

  id!: number;
  record!: ServiceRecord;
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
  cores!: CoreRecord[];
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

  static toStatisticsState(spec: typeof tinyChainSpec | typeof fullChainSpec, state: TestState): StatisticsState {
    return {
      statistics: {
        current: tryAsPerValidator(state.statistics.vals_current, spec),
        previous: tryAsPerValidator(state.statistics.vals_last, spec),
        cores: tryAsPerCore(state.statistics.cores, spec),
        services: new Map(
          state.statistics.services.map((service) => [
            tryAsServiceId(service.id),
            ServiceRecord.fromCodec(service.record),
          ]),
        ),
      },
      slot: state.slot,
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
  logger.log(`StatisticsTestFull { ${input}, ${pre_state}, ${post_state} }`);
  const spec = tinyChainSpec;
  const statistics = new Statistics(spec, TestState.toStatisticsState(spec, pre_state));
  statistics.transition(input);
  assert.deepStrictEqual(statistics.state, TestState.toStatisticsState(spec, post_state));
}

export async function runStatisticsTestFull({ input, pre_state, post_state }: StatisticsTestFull) {
  logger.log(`StatisticsTestFull { ${input}, ${pre_state}, ${post_state} }`);
  const spec = fullChainSpec;
  const statistics = new Statistics(spec, TestState.toStatisticsState(spec, pre_state));
  statistics.transition(input);
  assert.deepStrictEqual(statistics.state, TestState.toStatisticsState(spec, post_state));
}
