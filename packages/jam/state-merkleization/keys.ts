import type { ServiceId } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE, type OpaqueHash, blake2b } from "@typeberry/hash";
import { type U32, tryAsU32, u32AsLeBytes } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";
import { StateEntry } from "./entries.js";

export type StateKey = Opaque<OpaqueHash, "stateKey">;

const U32_BYTES = 4;

export namespace keys {
  /** https://graypaper.fluffylabs.dev/#/85129da/38e50038e500?v=0.6.3 */
  export function index(index: StateEntry): StateKey {
    const key = Bytes.zero(HASH_SIZE);
    key.raw[0] = index;
    return key.asOpaque();
  }

  /** https://graypaper.fluffylabs.dev/#/85129da/382b03382b03?v=0.6.3 */
  export function serviceInfo(serviceId: ServiceId): StateKey {
    const key = Bytes.zero(HASH_SIZE);
    key.raw[0] = StateEntry.Delta;
    let i = 1;
    for (const byte of u32AsLeBytes(serviceId)) {
      key.raw[i] = byte;
      i += 2;
    }
    return key.asOpaque();
  }

  /** https://graypaper.fluffylabs.dev/#/85129da/384103384103?v=0.6.3 */
  export function serviceStorage(serviceId: ServiceId, key: StateKey): StateKey {
    const out = Bytes.zero(HASH_SIZE);
    out.raw.set(u32AsLeBytes(tryAsU32(2 ** 32 - 1)), 0);
    out.raw.set(key.raw.subarray(0, HASH_SIZE - U32_BYTES), U32_BYTES);
    return serviceNested(serviceId, out);
  }

  /** https://graypaper.fluffylabs.dev/#/85129da/385403385403?v=0.6.3 */
  export function servicePreimage(serviceId: ServiceId, hash: PreimageHash): StateKey {
    const out = Bytes.zero(HASH_SIZE);
    out.raw.set(u32AsLeBytes(tryAsU32(2 ** 32 - 2)), 0);
    out.raw.set(hash.raw.subarray(1, HASH_SIZE - U32_BYTES + 1), U32_BYTES);
    return serviceNested(serviceId, out);
  }

  /** https://graypaper.fluffylabs.dev/#/85129da/386703386703?v=0.6.3 */
  export function serviceLookupHistory(serviceId: ServiceId, hash: PreimageHash, preimageLength: U32): StateKey {
    const doubleHash = blake2b.hashBytes(hash);
    const out = Bytes.zero(HASH_SIZE);
    out.raw.set(u32AsLeBytes(preimageLength), 0);
    out.raw.set(doubleHash.raw.subarray(2, HASH_SIZE - U32_BYTES + 2), U32_BYTES);
    return serviceNested(serviceId, out);
  }

  /** https://graypaper.fluffylabs.dev/#/85129da/380101380101?v=0.6.3 */
  export function serviceNested(serviceId: ServiceId, hash: OpaqueHash): StateKey {
    const key = Bytes.zero(HASH_SIZE);
    let i = 0;
    for (const byte of u32AsLeBytes(serviceId)) {
      key.raw[i] = byte;
      key.raw[i + 1] = hash.raw[i / 2];
      i += 2;
    }
    // no need to floor, since we know it's divisible (adding +2 every iteration).
    const middle = i / 2;
    key.raw.set(hash.raw.subarray(middle, HASH_SIZE - middle), i);
    return key.asOpaque();
  }
}
