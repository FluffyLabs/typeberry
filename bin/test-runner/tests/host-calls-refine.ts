import assert from "node:assert";
import { type FromJson, json } from "@typeberry/json-parser";

namespace fromJson {
  export const anyArray = (v: unknown) => {
    if (Array.isArray(v)) {
      return v;
    }

    if (v !== null && typeof v === "object") {
      // this is an object that looks like an array
      if (Object.keys(v).every((key) => !Number.isNaN(Number(key)))) {
        return Object.entries(v).map(([_key, value]) => value);
      }
    }

    throw new Error(`Expected an array, got ${typeof v} instead.`);
  };

  export const uint8Array = json.fromAny((v) => {
    return new Uint8Array(anyArray(v).map((x) => Number(x)));
  });

  export const bigUint64Array = json.fromAny((v) => {
    return new BigUint64Array(anyArray(v).map((x) => BigInt(x)));
  });
}

class MemoryPageAccessItem {
  static fromJson: FromJson<MemoryPageAccessItem> = {
    inaccessible: "boolean",
    writable: "boolean",
    readable: "boolean",
  };
  inaccessible!: boolean;
  writable!: boolean;
  readable!: boolean;
}

class MemoryPageItem {
  static fromJson: FromJson<MemoryPageItem> = {
    value: fromJson.uint8Array,
    access: MemoryPageAccessItem.fromJson,
  };
  value!: Uint8Array;
  access!: MemoryPageAccessItem;
}

class MemoryPageIndexItem {
  static fromJson: FromJson<MemoryPageIndexItem> = {
    32: MemoryPageItem.fromJson,
  };
  32!: MemoryPageItem;
}

class MemoryItem {
  static fromJson: FromJson<MemoryItem> = {
    pages: MemoryPageIndexItem.fromJson,
  };
  pages!: MemoryPageIndexItem;
}

class DeltaItem {
  static fromJson: FromJson<DeltaItem> = {
    address: "number",
    length: "number",
    "is-writable": "boolean",
  };
  address!: number;
  length!: number;
  "is-writable": boolean;
}

class XContentItem {
  static fromJson: FromJson<XContentItem> = {
    I: "number",
    S: "number",
    U: "number",
    T: "number",
    Y: "string",
  };
  I!: number;
  S!: number;
  U!: number; // its not a number
  T!: number; // its not a number
  Y!: string;
}

class MapItem {
  static fromJson: FromJson<MapItem> = {
    P: fromJson.uint8Array,
    U: MemoryItem.fromJson,
    I: "number",
  };
  P!: Uint8Array;
  U!: MemoryItem;
  I!: number;
}

class SegmentItem {
  static fromJson: FromJson<SegmentItem> = {
    address: "number",
    length: "number",
    "is-writable": "boolean",
  };
  address!: number;
  length!: number;
  "is-writable": boolean;
}

export class HostCallRefineTest {
  static fromJson: FromJson<HostCallRefineTest> = {
    name: "string",
    "initial-gas": "number",
    "initial-regs": fromJson.bigUint64Array,
    "initial-memory": MemoryItem.fromJson,
    "initial-service-index": json.optional("number"),
    "initial-delta": json.optional(json.array(DeltaItem.fromJson)),
    "initial-xcontent-x": json.optional(XContentItem.fromJson),
    "initial-xcontent-y": json.optional(XContentItem.fromJson),
    "initial-timeslot": json.optional("number"),
    "initial-refine-map": json.optional(json.array(MapItem.fromJson)),
    "initial-export-segment": json.optional(json.array(SegmentItem.fromJson)),
    "initial-import-segment": json.optional(json.array(SegmentItem.fromJson)),
    "initial-export-segment-index": json.optional("number"),
    "expected-gas": "number",
    "expected-regs": fromJson.bigUint64Array,
    "expected-memory": MemoryItem.fromJson,
    "expected-delta": json.optional(json.array(DeltaItem.fromJson)),
    "expected-xcontent-x": json.optional(XContentItem.fromJson),
    "expected-xcontent-y": json.optional(XContentItem.fromJson),
    "expected-refine-map": json.optional(json.array(MapItem.fromJson)),
    "expected-export-segment": json.optional(json.array(SegmentItem.fromJson)),
    "expected-export-segment-index": json.optional("number"),
  };

  name!: string;
  "initial-gas": number;
  "initial-regs": BigUint64Array;
  "initial-memory": MemoryItem;
  "initial-service-index"?: number;
  "initial-delta"?: DeltaItem[];
  "initial-xcontent-x"?: XContentItem;
  "initial-xcontent-y"?: XContentItem;
  "initial-timeslot"?: number;
  "initial-refine-map"?: MapItem[];
  "initial-export-segment"?: SegmentItem[];
  "initial-import-segment"?: SegmentItem[];
  "initial-export-segment-index"?: number;
  "expected-gas": number;
  "expected-regs": BigUint64Array;
  "expected-memory": MemoryItem;
  "expected-delta"?: DeltaItem[];
  "expected-xcontent-x"?: XContentItem;
  "expected-xcontent-y"?: XContentItem;
  "expected-refine-map"?: MapItem[];
  "expected-export-segment"?: SegmentItem[];
  "expected-export-segment-index"?: number;
}

export async function runHostCallRefineTest(testContent: HostCallRefineTest) {
  const name = testContent.name;
  if (name === undefined) {
    assert.fail("name should be defined");
  }
  assert.strictEqual(name.substring(0, 4), "host");
}
