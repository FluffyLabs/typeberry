/** A type that can be read from a JSON-parsed object. */
export type FromJson<T> = T extends (infer U)[]
  ? ["array", FromJson<U>]
  : // parse a string from JSON into expected type
      | FromJsonWithParser<string, T>
      // parse a number from JSON into expected type
      | FromJsonWithParser<number, T>
      // manually parse a nested object
      | FromJsonWithParser<unknown, T>
      | FromJsonPrimitive<T>
      | FromJsonOptional<T>;

/** Parsing a JSON primitive value. */
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

/** Conversion from some JSON type into the expected type. */
export type Parser<TFrom, TInto> = (inJson: TFrom, context?: string) => TInto;

/** Parsing a JSON value with given convesion. */
export type FromJsonWithParser<TFrom, TInto> = [FromJsonPrimitive<TFrom>, Parser<TFrom, TInto>];

/** A potentially optional JSON parameter (key/value undefined). */
export type FromJsonOptional<TInto> = ["optional", FromJson<TInto>];

/** A composite JSON object. */
export type ObjectFromJson<T> = {
  [K in keyof T]: FromJson<T[K]>;
};

/** Builder function that converts an object parsed from JSON into some expected type of object. */
export type Builder<TFrom, TInto> = (x: TFrom) => TInto;
