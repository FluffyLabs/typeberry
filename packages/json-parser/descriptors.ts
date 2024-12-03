import { parseFromJson } from "./parse";
import type { Builder, FromJson, FromJsonWithParser, Parser } from "./types";

export namespace json {
  /** Parse a JSON string into the expected type. */
  export function fromString<TInto>(parser: Parser<string, TInto>): FromJsonWithParser<string, TInto> {
    return ["string", parser];
  }

  /** Parse a JSON number into the expected type. */
  export function fromNumber<TInto>(parser: Parser<number, TInto>): FromJsonWithParser<number, TInto> {
    return ["number", parser];
  }

  /** Cast the JSON number into the expected type. */
  export function castNumber<TInto extends number>() {
    return fromNumber((v) => v as TInto);
  }

  /** Parse any (`unknown`) JSON value into the expected type. */
  export function fromAny<TInto>(parser: Parser<unknown, TInto>): FromJsonWithParser<unknown, TInto> {
    return ["object", parser];
  }

  /** Handle a potentially optional value. Can be either `undefined` or `null` in JSON. */
  export function optional<T>(from: FromJson<T>): FromJson<T | undefined> {
    return ["optional", from] as FromJson<T | undefined>;
  }

  /** Handle a potentially optional value that can be `null` in JSON. */
  export function nullable<T>(from: FromJson<T>): FromJson<T | null> {
    return ["optional", from] as FromJson<T | null>;
  }

  /** Expect an array of given type in JSON. */
  export function array<TInto>(from: FromJson<TInto>): FromJson<TInto[]> {
    return ["array", from];
  }

  /** Parse an object and create a class instance of given type using `builder` function. */
  export function object<TFrom, TInto = TFrom>(
    from: FromJson<TFrom>,
    builder: Builder<TFrom, TInto>,
  ): FromJsonWithParser<unknown, TInto> {
    return fromAny<TInto>((inJson, context) => {
      const parsed = parseFromJson(inJson, from, context);
      return builder(parsed);
    });
  }
}
