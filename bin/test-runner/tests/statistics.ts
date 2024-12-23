import type { Extrinsic, TimeSlot, ValidatorData, ValidatorIndex } from "@typeberry/block";
import { fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import type { U32 } from "@typeberry/numbers";
import { getExtrinsicFromJson } from "./codec/extrinsic";
import { fromJson } from "./safrole";

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
}

class StatisticsState {
  static fromJson: FromJson<StatisticsState> = {
    pi: {
      current: json.array(TestActivityRecord.fromJson),
      last: json.array(TestActivityRecord.fromJson),
    },
    tau: "number",
    kappa_prime: json.array(fromJson.validatorData),
  };

  pi!: {
    current: TestActivityRecord[];
    last: TestActivityRecord[];
  };
  tau!: TimeSlot;
  kappa_prime!: ValidatorData[];
}

export class StatisticsTestTiny {
  static fromJson: FromJson<StatisticsTestTiny> = {
    input: TinyInput.fromJson,
    pre_state: StatisticsState.fromJson,
    output: json.fromAny(() => null),
    post_state: StatisticsState.fromJson,
  };
  input!: TinyInput;
  pre_state!: StatisticsState;
  output!: null;
  post_state!: StatisticsState;
}

export class StatisticsTestFull {
  static fromJson: FromJson<StatisticsTestFull> = {
    input: FullInput.fromJson,
    pre_state: StatisticsState.fromJson,
    output: json.fromAny(() => null),
    post_state: StatisticsState.fromJson,
  };
  input!: FullInput;
  pre_state!: StatisticsState;
  output!: null;
  post_state!: StatisticsState;
}

export async function runStatisticsTestTiny(_testContent: StatisticsTestTiny) {
  // TODO [MaSi] Implement
}

export async function runStatisticsTestFull(_testContent: StatisticsTestFull) {
  // TODO [MaSi] Implement
}
