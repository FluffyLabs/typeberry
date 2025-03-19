import assert from "node:assert";
import { type FromJson, json } from "@typeberry/json-parser";

namespace fromJson {
  export const anyArray = (v: unknown) => {
    if (Array.isArray(v)) {
      return v;
    }

    throw new Error(`Expected an array, got ${typeof v} instead.`);
  };

  export const uint8Array = json.fromAny((v) => {
    if (Array.isArray(v)) {
      return new Uint8Array(v);
    }

    throw new Error(`Expected an array, got ${typeof v} instead.`);
  });

  export const bigUint64Array = json.fromAny((v) => {
    if (Array.isArray(v)) {
      return new BigUint64Array(v.map((x) => BigInt(x)));
    }

    throw new Error(`Expected an array, got ${typeof v} instead.`);
  });

  // Array of 13 elements
  export const registersBigUint64Array = json.fromAny((v) => {
    if (Array.isArray(v)) {
      if (v.length !== 13) {
        throw new Error(`Expected an array of 13 elements, got ${v.length} instead.`);
      }

      return new BigUint64Array(v.map((x) => BigInt(x)));
    }

    if (v !== null && typeof v === "object") {
      if (Object.keys(v).every((key) => !Number.isNaN(Number(key)))) {
        const array = new BigUint64Array(13);
        const elements: [number, bigint][] = Object.entries(v).map(([_key, value]) => [Number(_key), BigInt(value)]);
        for (const [i, value] of elements) {
          array[i] = value;
        }
        return array;
      }

      throw new Error(`Expected an array, got ${typeof v} instead.`);
    }

    throw new Error(`Expected an array, got ${typeof v} instead.`);
  });

  export const bytes32 = json.fromAny((v) => {
    if (typeof v === "string") {
      return new Uint8Array(Buffer.from(v, "hex"));
    }

    throw new Error(`Expected a string, got ${typeof v} instead.`);
  });

  export const map_number = json.fromAny((v) => {
    if (v !== null && typeof v === "object") {
      const result: Record<string, number> = {};
      for (const [key, value] of Object.entries(v)) {
        if (typeof value === "number") {
          result[key] = value;
        } else {
          throw new Error(`Invalid value for map key ${key}`);
        }
      }
      return result;
    }
    throw new Error("Invalid map value {string:number}");
  });

  export const map_numberArray = json.fromAny((v) => {
    if (v !== null && typeof v === "object") {
      const result: Record<string, number[]> = {};
      for (const [key, value] of Object.entries(v)) {
        if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
          result[key] = value;
        } else {
          throw new Error(`Invalid value for map key ${key}`);
        }
      }
      return result;
    }
    throw new Error("Invalid map value hash:[number]");
  });

  export const l_map = json.fromAny((v) => {
    if (v !== null && typeof v === "object") {
      const result: Record<string, { t: number[]; l: number }> = {};
      for (const [key, value] of Object.entries(v)) {
        if (value !== null && typeof value === "object" && "t" in value && "l" in value) {
          const { t, l } = v as { t: number[]; l: number };
          if (Array.isArray(t) && t.every((item) => typeof item === "number") && typeof l === "number") {
            result[key] = { t, l };
          }
        } else {
          throw new Error(`Invalid value for map key ${key}`);
        }
      }
      return result;
    }
    throw new Error("Invalid l_map value");
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
    "code_hash": "string",
    "balance": "number",
    "g": "number",
    "m": "number",
    "s_map": fromJson.map_numberArray,
    "l_map": fromJson.l_map,
    "p_map": fromJson.map_numberArray,
  };
  "code_hash": string;
  "balance": number;
  "g": number;
  "m": number;
  "s_map": Record<string, number[]>;
  "l_map": Record<string, { t: number[]; l: number }>;
  "p_map": Record<string, number[]>;
}

export class HostCallGeneralTest {
  static fromJson: FromJson<HostCallGeneralTest> = {
    name: "string",
    "initial-gas": "number",
    "initial-regs": fromJson.registersBigUint64Array,
    "initial-memory": MemoryItem.fromJson,
    "initial-service-index": "number",
    "initial-service-account": DeltaItem.fromJson,
    "initial-delta": json.array(DeltaItem.fromJson),
    "expected-gas": "number",
    "expected-regs": fromJson.bigUint64Array,
    "expected-memory": MemoryItem.fromJson,
    "expected-delta": json.array(DeltaItem.fromJson),
  };

  name!: string;
  "initial-gas": number;
  "initial-regs": BigUint64Array;
  "initial-memory": MemoryItem;
  "initial-service-account": DeltaItem;
  "initial-service-index": number;
  "initial-delta": DeltaItem[];
  "expected-gas": number;
  "expected-regs": BigUint64Array;
  "expected-memory": MemoryItem;
  "expected-delta": DeltaItem[];
}

export async function runHostCallGeneralTest(testContent: HostCallGeneralTest) {
  const name = testContent.name;
  if (name === undefined) {
    assert.fail("name should be defined");
  }
  assert.strictEqual(name.substring(0, 4), "host");
}
