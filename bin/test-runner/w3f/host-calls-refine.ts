import assert from "node:assert";
import { fromJson } from "@typeberry/block-json";
import { type FromJson, json } from "@typeberry/json-parser";
import { Memory, ServiceAccount } from "./host-calls-general";

class MapItem {
  static fromJson: FromJson<MapItem> = {
    P: fromJson.uint8Array,
    U: Memory.fromJson,
    I: "number",
  };

  P!: Uint8Array;
  U!: Memory;
  I!: number;
}

export class HostCallRefineTest {
  static fromJson: FromJson<HostCallRefineTest> = {
    name: "string",
    "initial-gas": "number",
    "initial-regs": json.record(fromJson.bigUint64),
    "initial-memory": Memory.fromJson,
    "initial-service-index": "number",
    "initial-delta": json.optional(json.record(ServiceAccount.fromJson)),
    "initial-timeslot": "number",
    "initial-refine-map": json.optional(json.record(MapItem.fromJson)),
    "initial-export-segment": json.optional(json.array(fromJson.uint8Array)),
    "initial-import-segment": json.optional(json.array(fromJson.uint8Array)),
    "initial-export-segment-index": "number",
    "expected-gas": "number",
    "expected-regs": json.record(fromJson.bigUint64),
    "expected-memory": Memory.fromJson,
    "expected-refine-map": json.optional(json.record(MapItem.fromJson)),
    "expected-export-segment": json.optional(json.array(fromJson.uint8Array)),
  };

  name!: string;
  "initial-gas": number;
  "initial-regs": Record<string, bigint>;
  "initial-memory": Memory;
  "initial-service-index": number;
  "initial-delta"?: Record<string, ServiceAccount>;
  "initial-timeslot": number;
  "initial-refine-map"?: Record<string, MapItem>;
  "initial-export-segment"?: Uint8Array[];
  "initial-import-segment"?: Uint8Array[];
  "initial-export-segment-index": number;
  "expected-gas": number;
  "expected-regs": Record<string, bigint>;
  "expected-memory": Memory;
  "expected-refine-map"?: Record<string, MapItem>;
  "expected-export-segment"?: Uint8Array[];
}

export async function runHostCallRefineTest(testContent: HostCallRefineTest) {
  const name = testContent.name;
  if (name === undefined) {
    assert.fail("name should be defined");
  }
  assert.strictEqual(name.substring(0, 4), "host");
}
