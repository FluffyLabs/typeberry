/**
 * `Opaque<Type, Token>` constructs a unique type which is a subset of Type with a
 * specified unique token Token. It means that base type cannot be assigned to unique type by accident.
 * Good examples of opaque types include:
 * - JWTs or other tokens - these are special kinds of string used for authorization purposes.
 *   If your app uses multiple types of tokens each should be a separate opaque type to avoid confusion
 * - Specific currencies - amount of different currencies shouldn't be mixed
 * - Bitcoin address - special kind of string
 *
 * `type GithubAccessToken = Opaque<string, "GithubAccessToken">;`
 * `type USD = Opaque<number, "USD">;`
 * `type PositiveNumber = Opaque<number, "PositiveNumber">;
 *
 * More: https://github.com/ts-essentials/ts-essentials/blob/master/lib/opaque/README.md
 *
 * Copyright (c) 2018-2019 Chris Kaczor (github.com/krzkaczor)
 */

// biome-ignore lint/suspicious/noConfusingVoidType: We want the type to be impossible to instantiate.
type Uninstantiable = void & { __brand: "uninstantiable" };

type StringLiteral<Type> = Type extends string ? (string extends Type ? never : Type) : never;

export declare const __OPAQUE_TYPE__: unique symbol;

export type WithOpaque<Token extends string> = {
  readonly [__OPAQUE_TYPE__]: Token;
};

export type TokenOf<OpaqueType, Type> = OpaqueType extends Opaque<Type, infer Token> ? Token : never;

export type Opaque<Type, Token extends string> = Token extends StringLiteral<Token>
  ? Type & WithOpaque<Token>
  : Uninstantiable;

export function asOpaqueType<T, Token extends string>(v: T): Opaque<T, Token> {
  return v as Opaque<T, Token>;
}
export function seeThrough<T, Token extends string>(v: Opaque<T, Token>): T {
  return v as T;
}
