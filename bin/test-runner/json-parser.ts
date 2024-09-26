// biome-ignore format: The type is cleaner when it's formatted manually
export type FromJson<T, From = T> =
  T extends (infer U)[] ? FromJsonArray<U> :
  (
    | FromJsonOptional<T>
    | FromJsonAny<T>
    | FromJsonObject<T>
    | FromJsonBool<T>
    | FromJsonWithParser<T, From>
  );

type FromJsonArray<T> = {
  kind: "array";
  from: FromJson<T>;
};

type FromJsonWithParser<T, From> = {
  kind: FromJsonPrimitive<From>;
  parser?: Parser<From, T>;
};

type FromJsonAny<T> = {
  kind: "any";
  parser: Parser<unknown, T>;
};

type FromJsonBool<T> = T extends boolean
  ? {
      kind: "boolean";
    }
  : never;

type Parser<TFrom, TInto> = (inJson: TFrom, context?: string) => TInto;

type FromJsonPrimitive<T> =
  // string
  T extends string
    ? "string"
    : // or number
      T extends number
      ? "number"
      : // boolean is handled separately, since we don't want a parser for it.
        never;

type FromJsonOptional<U> = {
  kind: "optional";
  from: FromJson<NonNullable<U>>;
};

type FromJsonObject<T> = {
  kind: "object";
  from: ObjectFromJson<T>;
};

export type ObjectFromJson<T> = {
  [K in Extract<keyof T, string>]: FromJson<T[K]>;
};

export const STRING = <T = string>(parser?: Parser<string, T>) =>
  ({
    kind: "string",
    parser,
  }) as FromJson<T>;

export const NUMBER = <T = number>(parser?: Parser<number, T>) =>
  ({
    kind: "number",
    parser,
  }) as FromJson<T>;

export const BOOLEAN = (): FromJson<boolean> => ({
  kind: "boolean",
});

export const ANY = <T>(parser: Parser<unknown, T>) =>
  ({
    kind: "any",
    parser,
  }) as FromJson<T>;

export const OPTIONAL = <T>(from: FromJson<T>) =>
  ({
    kind: "optional",
    from,
  }) as FromJson<T | undefined>;

export const ARRAY = <T>(from: FromJson<T>): FromJson<T[]> => ({
  kind: "array",
  from,
});

export const OBJECT = <T>(from: ObjectFromJson<T>) =>
  ({
    kind: "object",
    from,
  }) as FromJson<T>;

export function parseFromJson<T>(jsonType: unknown, jsonDescription: FromJson<T>, context = "<root>"): T {
  const t = typeof jsonType;
  const kind = jsonDescription.kind;

  if (kind === "object") {
    if (t !== "object") {
      throw new Error(`Expected complex type but got ${t}`);
    }
    const description = jsonDescription as FromJsonObject<T>;

    const result = {} as { [key: string]: unknown };
    const obj = jsonType as { [key: string]: unknown };
    const c = description.from as { [key: string]: FromJson<unknown> };

    for (const key of Object.keys(c)) {
      const inJson = obj[key];
      const descriptor = c[key];
      if (inJson !== undefined || descriptor.kind === "optional") {
        const r = parseFromJson(inJson, descriptor, `${context}.${key}`);
        // note that for optional keys we will populate the object here
        // with undefined, which is what we want for key comparison.
        result[key] = r;
      }
    }

    // now compare if we miss any keys
    const keysDifference = diffKeys(result, c);
    if (keysDifference.length > 0) {
      const e = new Error(
        `[${context}] Unexpected or missing keys: ${keysDifference.join(" | ")}
          Data: ${Object.keys(result)}
          Schema: ${Object.keys(c)}`,
      );
      throw e;
    }

    return result as T;
  }

  // optional
  if (kind === "optional") {
    if (jsonType === undefined || jsonType === null) {
      return jsonType as T;
    }
    const description = jsonDescription as FromJsonOptional<T>;
    return parseFromJson<T>(jsonType, description.from as FromJson<T>, context);
  }

  // array
  if (kind === "array") {
    if (!Array.isArray(jsonType)) {
      throw new Error(`[${context}] Expected array, got ${jsonType}`);
    }
    const result = [] as unknown[];
    const description = jsonDescription as FromJsonArray<T>;
    const arr = jsonType as unknown[];
    for (const [k, v] of arr.entries()) {
      result[k] = parseFromJson(v, description.from, `${context}.${k}`);
    }
    return arr as T;
  }

  // manual parser
  if (kind === "any") {
    const description = jsonDescription as FromJsonAny<T>;
    return description.parser(jsonType, context);
  }

  const parsePrimitive = <TFrom>(
    jsonType: TFrom,
    jsonDescription: FromJsonWithParser<T, TFrom>,
    context?: string,
  ): T => {
    if (jsonDescription.parser) {
      return jsonDescription.parser(jsonType, context);
    }

    return jsonType as unknown as T;
  };

  // primitive type
  if (t === kind && kind === "string") {
    const description = jsonDescription as FromJsonWithParser<T, string>;
    return parsePrimitive<string>(jsonType as string, description, context);
  }

  if (t === kind && kind === "number") {
    const description = jsonDescription as FromJsonWithParser<T, number>;
    return parsePrimitive<number>(jsonType as number, description, context);
  }

  if (t === kind && kind === "boolean") {
    const description = jsonDescription as FromJsonWithParser<T, boolean>;
    return parsePrimitive<boolean>(jsonType as boolean, description, context);
  }

  throw new Error(`[${context}] Expected ${kind} but got ${t}`);
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
