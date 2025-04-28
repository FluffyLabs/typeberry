import assert from "node:assert";
import {
  type Extrinsic,
  type ServiceGas,
  type TimeSlot,
  type ValidatorIndex,
  tryAsPerValidator,
  tryAsServiceGas,
  tryAsServiceId,
} from "@typeberry/block";
import { getExtrinsicFromJson } from "@typeberry/block-json";
import { fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import type { U16, U32 } from "@typeberry/numbers";
import {
  CoreStatistics,
  ServiceStatistics,
  type ValidatorData,
  ValidatorStatistics,
  tryAsPerCore,
} from "@typeberry/state";
import { type Input, Statistics, type StatisticsState } from "@typeberry/transition/statistics";
import { validatorDataFromJson } from "./common-types";

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

class TestValidatorStatistics {
  static fromJson = json.object<TestValidatorStatistics, ValidatorStatistics>(
    {
      blocks: "number",
      tickets: "number",
      pre_images: "number",
      pre_images_size: "number",
      guarantees: "number",
      assurances: "number",
    },
    ({ blocks, tickets, pre_images, pre_images_size, guarantees, assurances }) => {
      return ValidatorStatistics.fromCodec({
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
  static fromJson = json.object<TestCoreStatistics, CoreStatistics>(
    {
      da_load: "number",
      popularity: "number",
      imports: "number",
      exports: "number",
      extrinsic_size: "number",
      extrinsic_count: "number",
      bundle_size: "number",
      gas_used: json.fromNumber(tryAsServiceGas),
    },
    ({ da_load, popularity, imports, exports, extrinsic_size, extrinsic_count, bundle_size, gas_used }) => {
      return CoreStatistics.fromCodec({
        dataAvailabilityLoad: da_load,
        popularity,
        imports,
        exports,
        extrinsicSize: extrinsic_size,
        extrinsicCount: extrinsic_count,
        bundleSize: bundle_size,
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
  gas_used!: ServiceGas;
}

class TestServiceStatistics {
  static fromJson = json.object<TestServiceStatistics, ServiceStatistics>(
    {
      provided_count: "number",
      provided_size: "number",
      refinement_count: "number",
      refinement_gas_used: json.fromNumber(tryAsServiceGas),
      imports: "number",
      exports: "number",
      extrinsic_size: "number",
      extrinsic_count: "number",
      accumulate_count: "number",
      accumulate_gas_used: json.fromNumber(tryAsServiceGas),
      on_transfers_count: "number",
      on_transfers_gas_used: json.fromNumber(tryAsServiceGas),
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
      return ServiceStatistics.fromCodec({
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
  refinement_gas_used!: ServiceGas;
  imports!: U16;
  exports!: U16;
  extrinsic_size!: U32;
  extrinsic_count!: U16;
  accumulate_count!: U32;
  accumulate_gas_used!: ServiceGas;
  on_transfers_count!: U32;
  on_transfers_gas_used!: ServiceGas;
}

class TestServicesStatistics {
  static fromJson: FromJson<TestServicesStatistics> = {
    id: "number",
    record: TestServiceStatistics.fromJson,
  };

  id!: number;
  record!: ServiceStatistics;
}

class TestStatisticsState {
  static fromJson: FromJson<TestStatisticsState> = {
    vals_current: json.array(TestValidatorStatistics.fromJson),
    vals_last: json.array(TestValidatorStatistics.fromJson),
    cores: json.array(TestCoreStatistics.fromJson),
    services: json.array(TestServicesStatistics.fromJson),
  };

  vals_current!: ValidatorStatistics[];
  vals_last!: ValidatorStatistics[];
  cores!: CoreStatistics[];
  services!: TestServicesStatistics[];
}

class TestState {
  static fromJson: FromJson<TestState> = {
    statistics: TestStatisticsState.fromJson,
    slot: "number",
    curr_validators: json.array(validatorDataFromJson),
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
        services: new Map(state.statistics.services.map((service) => [tryAsServiceId(service.id), service.record])),
      },
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
  input.incomingReports = input.extrinsic.guarantees.map((g) => g.report);

  const spec = tinyChainSpec;
  const preState = TestState.toStatisticsState(spec, pre_state);
  const postState = TestState.toStatisticsState(spec, post_state);
  const statistics = new Statistics(spec, preState);
  assert.deepStrictEqual(statistics.state, preState);
  statistics.transition(input);

  // NOTE [MaSo] This is a workaround for the fact that the test data does not contain any posterior service statistics.
  assert.deepStrictEqual(postState.statistics.services.size, 0);
  if (statistics.state.statistics.services.size > 0) {
    const serviceStatistics = statistics.state.statistics.services.get(tryAsServiceId(0)) ?? ServiceStatistics.empty();
    postState.statistics.services.set(tryAsServiceId(0), serviceStatistics);
  }
  assert.deepStrictEqual(statistics.state, postState);
}

export async function runStatisticsTestFull({ input, pre_state, post_state }: StatisticsTestFull) {
  input.incomingReports = input.extrinsic.guarantees.map((g) => g.report);

  const spec = fullChainSpec;
  const preState = TestState.toStatisticsState(spec, pre_state);
  const postState = TestState.toStatisticsState(spec, post_state);
  const statistics = new Statistics(spec, preState);
  assert.deepStrictEqual(statistics.state, preState);
  statistics.transition(input);

  // NOTE [MaSo] This is a workaround for the fact that the test data does not contain any posterior service statistics.
  assert.deepStrictEqual(postState.statistics.services.size, 0);
  if (statistics.state.statistics.services.size > 0) {
    const serviceStatistics = statistics.state.statistics.services.get(tryAsServiceId(0)) ?? ServiceStatistics.empty();
    postState.statistics.services.set(tryAsServiceId(0), serviceStatistics);
  }
  assert.deepStrictEqual(statistics.state, postState);
}
