import assert from "node:assert";
import type { CodeHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import type { ValidatorData } from "@typeberry/state";
import { fromJson } from "./codec/common";
import { commonFromJson } from "./common-types";
import { Memory, ServiceAccount } from "./host-calls-general";

namespace localFromJson {
  export const bytes32 = <T extends Bytes<32>>() =>
    json.fromString<T>((v) => (v.length === 0 ? Bytes.zero(32).asOpaque() : Bytes.parseBytes(v, 32).asOpaque()));
}

class PrivilegesState {
  static fromJson: FromJson<PrivilegesState> = {
    chi_m: "number",
    chi_a: "number",
    chi_v: "number",
    chi_g: json.record("number"),
  };
  chi_m!: number;
  chi_a!: number;
  chi_v!: number;
  chi_g!: Record<string, number>;
}

class PartialState {
  static fromJson: FromJson<PartialState> = {
    D: json.record(ServiceAccount.fromJson),
    I: json.array(commonFromJson.validatorData),
    Q: json.array(json.array("string")),
    X: PrivilegesState.fromJson,
  };
  D!: Record<string, ServiceAccount>;
  I!: ValidatorData[];
  Q!: string[][];
  X!: PrivilegesState;
}

class DeferredTransfer {
  static fromJson: FromJson<DeferredTransfer> = {
    sender_index: "number",
    receiver_index: "number",
    amount: "number",
    memo: fromJson.uint8Array,
    gas_limit: "number",
  };

  sender_index!: number;
  receiver_index!: number;
  amount!: number;
  memo!: Uint8Array;
  gas_limit!: number;
}

class XContent {
  static fromJson: FromJson<XContent> = {
    I: "number",
    S: "number",
    U: json.optional(PartialState.fromJson),
    T: json.optional(json.array(DeferredTransfer.fromJson)),
    Y: json.optional(localFromJson.bytes32()),
  };

  I!: number;
  S!: number;
  U?: PartialState;
  T?: DeferredTransfer[];
  Y?: CodeHash;
}

export class HostCallAccumulateTest {
  static fromJson: FromJson<HostCallAccumulateTest> = {
    name: "string",
    "initial-gas": "number",
    "initial-regs": json.record(fromJson.bigUint64),
    "initial-memory": Memory.fromJson,
    "initial-xcontent-x": XContent.fromJson,
    "initial-xcontent-y": XContent.fromJson,
    "initial-timeslot": "number",
    "expected-gas": "number",
    "expected-regs": json.record(fromJson.bigUint64),
    "expected-memory": Memory.fromJson,
    "expected-xcontent-x": XContent.fromJson,
    "expected-xcontent-y": XContent.fromJson,
  };

  name!: string;
  "initial-gas": number;
  "initial-regs": Record<string, bigint>;
  "initial-memory": Memory;
  "initial-xcontent-x": XContent;
  "initial-xcontent-y": XContent;
  "initial-timeslot": number;
  "expected-gas": number;
  "expected-regs": Record<string, bigint>;
  "expected-memory": Memory;
  "expected-xcontent-x": XContent;
  "expected-xcontent-y": XContent;
}

export async function runHostCallAccumulateTest(testContent: HostCallAccumulateTest) {
  const name = testContent.name;
  if (name === undefined) {
    assert.fail("name should be defined");
  }
  assert.strictEqual(name.substring(0, 4), "host");
}
