/// Extract an element type of an array type.
export type FromJson<T> = T extends (infer U)[]
  ? ["array", FromJson<U>]
  : // parse a string from JSON into expected type
      | FromJsonWithParser<T, string>
      // parse a number from JSON into expected type
      | FromJsonWithParser<T, number>
      // manually parse a nested object
      | FromJsonWithParser<T, unknown>
      | FromJsonPrimitive<T>
      | FromJsonOptional<T>;

export type FromJsonPrimitive<T> = T extends string
  ? "string"
  : T extends number
    ? "number"
    : T extends boolean
      ? "boolean"
      : T extends object
        ? ObjectFromJson<T>
        : T extends unknown
          ? "object"
          : never;

export type Parser<TFrom, TInto> = (inJson: TFrom, context?: string) => TInto;

export type FromJsonWithParser<TInto, TFrom> = [FromJsonPrimitive<TFrom>, Parser<TFrom, TInto>];

export type FromJsonOptional<TInto> = ["optional", FromJson<TInto>];

export type ObjectFromJson<T> = {
  [K in keyof T]: FromJson<T[K]>;
};

export const FROM_STRING = <TInto>(parser: Parser<string, TInto>): FromJsonWithParser<TInto, string> => {
  return ["string", parser];
};

export const FROM_NUMBER = <TInto>(parser: Parser<number, TInto>): FromJsonWithParser<TInto, number> => {
  return ["number", parser];
};

export const CAST_NUMBER = <TInto extends number>() => {
  return FROM_NUMBER((v) => v as TInto);
}

export const FROM_ANY = <TInto>(parser: Parser<unknown, TInto>): FromJsonWithParser<TInto, unknown> => {
  return ["object", parser];
};

export const OPTIONAL = <T>(from: FromJson<T>): FromJson<T | undefined> => {
  return ["optional", from] as FromJson<T | undefined>;
};

export const ARRAY = <TInto>(from: FromJson<TInto>): FromJson<TInto[]> => {
  return ["array", from];
};

export function parseFromJson<T>(jsonType: unknown, jsonDescription: FromJson<T>, context = "<root>"): T {
  const t = typeof jsonType;

  if (jsonDescription === "string") {
    if (t === "string") {
      return jsonType as T;
    }
    throw new Error(`[${context}] Expected ${jsonDescription} but got ${t}`);
  }

  if (jsonDescription === "number") {
    if (t === "number") {
      return jsonType as T;
    }
    throw new Error(`[${context}] Expected ${jsonDescription} but got ${t}`);
  }

  if (jsonDescription === "boolean") {
    if (t === "boolean") {
      return jsonType as T;
    }
    throw new Error(`[${context}] Expected ${jsonDescription} but got ${t}`);
  }

  if (Array.isArray(jsonDescription)) {
    const type = jsonDescription[0];

    // an array type
    if (type === "array") {
      const expectedType = jsonDescription[1];
      if (!Array.isArray(jsonType)) {
        throw new Error(`[${context}] Expected array, got ${jsonType}`);
      }

      const arr = jsonType as unknown[];
      const result = [] as unknown[];
      for (const [k, v] of arr.entries()) {
        result[k] = parseFromJson(v, expectedType, `${context}.${k}`);
      }
      return result as T;
    }

    // optional type
    if (type === "optional") {
      if (jsonType === undefined || jsonType === null) {
        return jsonType as T;
      }

      const expectedType = jsonDescription[1];
      return parseFromJson(jsonType, expectedType, context);
    }

    // a manual parser for nested object
    if (type === "object") {
      const parser = jsonDescription[1];
      const obj = jsonType as object;
      return parser(obj, context);
    }

    // An expected in-json type and the parser to the destination type.
    if (type === "string") {
      const parser = jsonDescription[1];
      const value = parseFromJson<string>(jsonType, type, context);
      return parser(value, context);
    }

    if (type === "number") {
      const type = jsonDescription[0];
      const parser = jsonDescription[1];
      const value = parseFromJson<number>(jsonType, type, context);
      return parser(value, context);
    }

    throw new Error(`[${context}] Invalid parser type: ${type}`);
  }

  if (t !== "object") {
    throw new Error(`Expected complex type but got ${t}`);
  }

  if (typeof jsonDescription !== "object") {
    throw new Error(`[${context}] Unhandled type ${jsonDescription}`);
  }

  if (jsonType === null) {
    throw new Error(`[${context}] Unexpected 'null'`);
  }

  const result = {} as { [key: string]: unknown };
  const obj = jsonType as { [key: string]: unknown };
  const c = jsonDescription as { [key: string]: FromJson<unknown> };

  // add all keys so that they are in the same order.
  for (const key of Object.keys(obj)) {
    result[key] = undefined;
  }

  // now parse the ones that we need (some might be optional, but that's fine).
  for (const key of Object.keys(jsonDescription)) {
    // we intentionally skip missing keys, to have them detected
    // during key diffing. But for optional keys we put undefined value.
    if (key in obj) {
      const v = obj[key];
      result[key] = parseFromJson(v, c[key], `${context}.${key}`);
    } else if (Array.isArray(c[key]) && c[key][0] === "optional") {
      result[key] = undefined;
    }
  }

  // compute the key difference
  const keysDifference = diffKeys(result, jsonDescription);
  if (keysDifference.length > 0) {
    const e = new Error(
      `[${context}] Unexpected or missing keys: ${keysDifference.join(" | ")}
          Data: ${Object.keys(result)}
          Schema: ${Object.keys(jsonDescription)}`,
    );
    throw e;
  }

  return result as T;
}

function diffKeys(obj1: object, obj2: object): [string, string][] {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  keys1.sort();
  keys2.sort();

  const keysCounter: { [key: string]: number } = {};
  const max = Math.max(keys2.length, keys2.length);

  const KEY1_SET = 1;
  const KEY2_SET = 2;

  for (let i = 0; i < max; i++) {
    keysCounter[keys1[i]] = (keysCounter[keys1[i]] || 0) + KEY1_SET;
    keysCounter[keys2[i]] = (keysCounter[keys2[i]] || 0) + KEY2_SET;
  }

  const diff: [string, string][] = [];
  const id = (v?: string) => (v ? `"${v}"` : "<missing>");
  for (const [k, v] of Object.entries(keysCounter)) {
    if (v !== KEY1_SET + KEY2_SET && k !== "undefined") {
      diff.push(v === KEY1_SET ? [id(k), id(undefined)] : [id(undefined), id(k)]);
    }
  }

  return diff;
}
