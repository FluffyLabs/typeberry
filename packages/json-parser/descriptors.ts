import type { FromJson, FromJsonWithParser, Parser } from "./types";

export namespace json {
  export function fromString<TInto>(parser: Parser<string, TInto>): FromJsonWithParser<TInto, string> {
    return ["string", parser];
  }

  export function fromNumber<TInto>(parser: Parser<number, TInto>): FromJsonWithParser<TInto, number> {
    return ["number", parser];
  }

  export function castNumber<TInto extends number>() {
    return fromNumber((v) => v as TInto);
  }

  export function fromAny<TInto>(parser: Parser<unknown, TInto>): FromJsonWithParser<TInto, unknown> {
    return ["object", parser];
  }

  export function optional<T>(from: FromJson<T>): FromJson<T | undefined> {
    return ["optional", from] as FromJson<T | undefined>;
  }

  export function array<TInto>(from: FromJson<TInto>): FromJson<TInto[]> {
    return ["array", from];
  }
}
