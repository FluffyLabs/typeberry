import { type FromJson, json } from "@typeberry/json-parser";
import type { U16, U32 } from "@typeberry/numbers";
import {CoreStatistics, ServiceStatistics, StatisticsData, tryAsPerCore, ValidatorStatistics} from "@typeberry/state";
import {ServiceGas, ServiceId, tryAsPerValidator, tryAsServiceGas} from "@typeberry/block";
import {ChainSpec} from "@typeberry/config";

export class JsonValidatorStatistics {
  static fromJson = json.object<JsonValidatorStatistics, ValidatorStatistics>(
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

export class JsonCoreStatistics {
  static fromJson = json.object<JsonCoreStatistics, CoreStatistics>(
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

class JsonServiceStatistics {
  static fromJson = json.object<JsonServiceStatistics, ServiceStatistics>(
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

export type ServiceStatiticsEntry = {
  id: ServiceId,
  record: ServiceStatistics,
};

export const serviceStatisticsEntryFromJson: FromJson<ServiceStatiticsEntry> = {
  id: "number",
  record: JsonServiceStatistics.fromJson,
};

export class JsonStatisticsData {
  vals_current!: ValidatorStatistics[];
  vals_last!: ValidatorStatistics[];
  cores!: CoreStatistics[];
  services!: ServiceStatiticsEntry[];

  static fromJson: FromJson<JsonStatisticsData> = {
    vals_current: json.array(JsonValidatorStatistics.fromJson),
    vals_last: json.array(JsonValidatorStatistics.fromJson),
    cores: json.array(JsonCoreStatistics.fromJson),
    services: json.array(serviceStatisticsEntryFromJson),
  };

  static toStatisticsData(spec: ChainSpec, statistics: JsonStatisticsData) {
    return StatisticsData.fromCodec({
      current: tryAsPerValidator(statistics.vals_current, spec),
      previous: tryAsPerValidator(statistics.vals_last, spec),
      cores: tryAsPerCore(statistics.cores, spec),
      services: new Map(statistics.services.map(x => [x.id, x.record])),
    })
  }
};
