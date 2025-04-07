import assert from "node:assert";
import { type FromJson, json } from "@typeberry/json-parser";
import { fromJson } from "./codec/common";

class MemoryPage {
  static fromJson: FromJson<MemoryPage> = {
    value: fromJson.uint8Array,
    access: {
      inaccessible: "boolean",
      writable: "boolean",
      readable: "boolean",
    },
  };

  value!: Uint8Array;
  access!: {
    inaccessible: boolean;
    writable: boolean;
    readable: boolean;
  };
}

export class Memory {
  static fromJson: FromJson<Memory> = {
    pages: json.record(MemoryPage.fromJson),
  };

  pages!: {
    [key: string]: MemoryPage;
  };
}

export class ServiceAccount {
  static fromJson: FromJson<ServiceAccount> = {
    s_map: json.record(json.array("number")),
    l_map: json.record({
      t: fromJson.uint8Array,
      l: "number",
    }),
    p_map: json.record(json.array("number")),
    code_hash: "string",
    balance: "number",
    g: "number",
    m: "number",
  };

  s_map!: Record<string, number[]>;
  l_map!: Record<string, { t: Uint8Array; l: number }>;
  p_map!: Record<string, number[]>;
  code_hash!: string;
  balance!: number;
  g!: number;
  m!: number;
}

export class HostCallGeneralTest {
  static fromJson: FromJson<HostCallGeneralTest> = {
    name: "string",
    "initial-gas": "number",
    "initial-regs": json.record(fromJson.bigUint64),
    "initial-memory": Memory.fromJson,
    "initial-service-account": ServiceAccount.fromJson,
    "initial-service-index": "number",
    "initial-delta": json.record(ServiceAccount.fromJson),
    "expected-gas": "number",
    "expected-regs": json.record(fromJson.bigUint64),
    "expected-memory": Memory.fromJson,
    "expected-delta": json.record(ServiceAccount.fromJson),
    "expected-service-account": ServiceAccount.fromJson,
  };

  name!: string;
  "initial-gas": number;
  "initial-regs": Record<string, bigint>;
  "initial-memory": Memory;
  "initial-service-account": ServiceAccount;
  "initial-service-index": number;
  "initial-delta": Record<string, ServiceAccount>;
  "expected-gas": number;
  "expected-regs": Record<string, bigint>;
  "expected-memory": Memory;
  "expected-delta": Record<string, ServiceAccount>;
  "expected-service-account": ServiceAccount;
}

export async function runHostCallGeneralTest(testContent: HostCallGeneralTest) {
  const name = testContent.name;
  if (name === undefined) {
    assert.fail("name should be defined");
  }
  assert.strictEqual(name.substring(0, 4), "host");
}
