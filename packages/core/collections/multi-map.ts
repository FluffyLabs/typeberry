import { check } from "@typeberry/utils";

type NestedMaps<TKeys extends readonly unknown[], TValue> = TKeys extends [infer THead, ...infer TTail]
  ? Map<THead, NestedMaps<TTail, TValue>>
  : TValue;

type KeyMappers<TKeys extends readonly unknown[]> = TKeys extends [infer THead, ...infer TTail]
  ? [KeyMapper<THead> | null, ...KeyMappers<TTail>]
  : [];

/** Key representation that can be stored in a map. */
export type KeyMapper<K> = (key: K) => string | number | bigint | symbol;

/**
 * A multi-key map, implemented as nested maps.
 *
 * Nested maps are created lazily and never removed.
 *
 * Note that the keys which are not primitive values (`string | number | Symbol`)
 * most likely need a function that will convert the key into some primitive
 * representation, otherwise the map will compare only references!
 */
export class MultiMap<TKeys extends readonly unknown[], TValue> {
  public readonly data: NestedMaps<TKeys, TValue>;
  private readonly keyMappers: KeyMappers<TKeys>;

  /**
   * Pass the number of keys and optionally mappers from keys to primitive types
   * if needed.
   */
  constructor(keysLength: TKeys["length"], keyMappers?: KeyMappers<TKeys>) {
    check(keysLength > 0, "Keys cannot be empty.");
    check(keyMappers === undefined || keyMappers.length === keysLength, "Incorrect number of key mappers given!");
    this.data = new Map() as NestedMaps<TKeys, TValue>;
    this.keyMappers = keyMappers === undefined ? (Array(keysLength).fill(null) as KeyMappers<TKeys>) : keyMappers;
  }

  /** Convert input keys into primitive types. */
  private primitiveKeys(keys: TKeys) {
    return keys.map((key, idx) => {
      const mapper = this.keyMappers[idx];
      return mapper !== null ? mapper(key) : key;
    });
  }

  /**
   * Set given `value` at particular location denoted by `inKeys`.
   *
   * The function will create all missing nested maps.
   */
  set(value: TValue, ...inKeys: TKeys) {
    let current = this.data as Map<unknown, unknown>;
    const keys = this.primitiveKeys(inKeys);
    const lastKeyIndex = keys.length - 1;
    const lastKey = keys[lastKeyIndex];

    for (let i = 0; i < lastKeyIndex; i += 1) {
      const key = keys[i];
      const nested = current.get(key);
      if (nested === undefined) {
        const fresh = new Map();
        current.set(key, fresh);
        current = fresh;
      } else {
        current = nested as Map<unknown, unknown>;
      }
    }

    current.set(lastKey, value);
    return this;
  }

  /**
   * Remove the entry under `inKeys`.
   *
   * NOTE: this function does not remove empty maps.
   *
   * Returns `true` if the value was removed or `false` otherwise.
   */
  delete(...inKeys: TKeys): boolean {
    const last = this.findLastMapAndKey(inKeys);
    return last.map?.delete(last.key) ?? false;
  }

  /** Check presence of the value under `inKeys`. */
  has(...inKeys: TKeys): boolean {
    const last = this.findLastMapAndKey(inKeys);
    return last.map?.has(last.key) ?? false;
  }

  /** Get the value under `inKeys` or `undefined` if not present. */
  get(...inKeys: TKeys): TValue | undefined {
    const last = this.findLastMapAndKey(inKeys);
    return last.map?.get(last.key);
  }

  /**
   * Traverse all path except for the last key.
   *
   * Returns the last map `Map<LastKey, TValue>` and the last key.
   */
  private findLastMapAndKey(inKeys: TKeys): {
    map: Map<unknown, TValue> | undefined;
    key: unknown;
  } {
    const keys = this.primitiveKeys(inKeys);
    const lastKeyIndex = keys.length - 1;
    const lastKey = keys[lastKeyIndex];
    let current = this.data as Map<unknown, unknown> | undefined;

    for (let i = 0; i < lastKeyIndex; i += 1) {
      if (current == null) {
        return {
          map: undefined,
          key: lastKey,
        };
      }

      const key = keys[i];
      current = current.get(key) as Map<unknown, unknown> | undefined;
    }

    return {
      map: current as Map<unknown, TValue> | undefined,
      key: lastKey,
    };
  }
}
