import type { PropertyKeys } from "@typeberry/codec";

type CamelToSnake<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U> // Check if U is already lowercase
    ? `${T}${CamelToSnake<U>}` // Continue without adding an underscore
    : `${T}_${CamelToSnake<Uncapitalize<U>>}` // Add underscore and continue
  : S;

export type JsonObject<T> = {
  [K in PropertyKeys<T> as CamelToSnake<K & string>]: T[K];
};
