import type { ServiceId } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE, type OpaqueHash, blake2b } from "@typeberry/hash";
import { type U32, tryAsU32, u32AsLeBytes } from "@typeberry/numbers";
import { Compatibility, GpVersion, type Opaque } from "@typeberry/utils";

export type StateKey = Opaque<OpaqueHash, "stateKey">;

const U32_BYTES = 4;

/** Numeric mapping for state entries. */
export enum StateKeyIdx {
  Unused = 0,
  /**Authorizer Pool */
  Alpha = 1,
  /** Authorizer Queue */
  Phi = 2,
  /** Recent History */
  Beta = 3,
  /** Safrole */
  Gamma = 4,
  /** Disputes Records (Judgements) */
  Psi = 5,
  /** Entropy */
  Eta = 6,
  /** Next Validators */
  Iota = 7,
  /** Current Validators */
  Kappa = 8,
  /** Previous Validators */
  Lambda = 9,
  /** Availability Assignment */
  Rho = 10,
  /** Current time slot */
  Tau = 11,
  /** Privileged Services */
  Chi = 12,
  /** Statistics */
  Pi = 13,
  /** Work Packages ready to be accumulated. NOTE: Pre 0.7.0 was called `Theta` */
  Omega = 14,
  /** Work Packages recently accumulated */
  Xi = 15,
  /** Recent Merkle mountain belts */
  Theta = 16,
  /** Services data */
  Delta = 255,
}

export namespace stateKeys {
  /** https://graypaper.fluffylabs.dev/#/85129da/38e50038e500?v=0.6.3 */
  export function index(index: StateKeyIdx): StateKey {
    const key = Bytes.zero(HASH_SIZE);
    key.raw[0] = index;
    return key.asOpaque();
  }

  /** https://graypaper.fluffylabs.dev/#/85129da/382b03382b03?v=0.6.3 */
  export function serviceInfo(serviceId: ServiceId): StateKey {
    const key = Bytes.zero(HASH_SIZE);
    key.raw[0] = StateKeyIdx.Delta;
    let i = 1;
    for (const byte of u32AsLeBytes(serviceId)) {
      key.raw[i] = byte;
      i += 2;
    }
    return key.asOpaque();
  }

  /** https://graypaper.fluffylabs.dev/#/1c979cb/3bba033bba03?v=0.7.1 */
  export function serviceStorage(serviceId: ServiceId, key: StateKey): StateKey {
    if (Compatibility.isLessThan(GpVersion.V0_6_7)) {
      const out = Bytes.zero(HASH_SIZE);
      out.raw.set(u32AsLeBytes(tryAsU32(2 ** 32 - 1)), 0);
      out.raw.set(key.raw.subarray(0, HASH_SIZE - U32_BYTES), U32_BYTES);
      return legacyServiceNested(serviceId, out);
    }

    return serviceNested(serviceId, tryAsU32(2 ** 32 - 1), key);
  }

  /** https://graypaper.fluffylabs.dev/#/1c979cb/3bd7033bd703?v=0.7.1 */
  export function servicePreimage(serviceId: ServiceId, hash: PreimageHash): StateKey {
    if (Compatibility.isLessThan(GpVersion.V0_6_7)) {
      const out = Bytes.zero(HASH_SIZE);
      out.raw.set(u32AsLeBytes(tryAsU32(2 ** 32 - 2)), 0);
      out.raw.set(hash.raw.subarray(1, HASH_SIZE - U32_BYTES + 1), U32_BYTES);
      return legacyServiceNested(serviceId, out);
    }

    return serviceNested(serviceId, tryAsU32(2 ** 32 - 2), hash);
  }

  /** https://graypaper.fluffylabs.dev/#/1c979cb/3b0a043b0a04?v=0.7.1 */
  export function serviceLookupHistory(serviceId: ServiceId, hash: PreimageHash, preimageLength: U32): StateKey {
    if (Compatibility.isLessThan(GpVersion.V0_6_7)) {
      const doubleHash = blake2b.hashBytes(hash);
      const out = Bytes.zero(HASH_SIZE);
      out.raw.set(u32AsLeBytes(preimageLength), 0);
      out.raw.set(doubleHash.raw.subarray(2, HASH_SIZE - U32_BYTES + 2), U32_BYTES);
      return legacyServiceNested(serviceId, out);
    }

    return serviceNested(serviceId, preimageLength, hash);
  }

  /** https://graypaper.fluffylabs.dev/#/1c979cb/3b88003b8800?v=0.7.1 */
  export function serviceNested(serviceId: ServiceId, numberPrefix: U32, hash: OpaqueHash): StateKey {
    const inputToHash = BytesBlob.blobFromParts(u32AsLeBytes(numberPrefix), hash.raw);
    const newHash = blake2b.hashBytes(inputToHash).raw.subarray(0, 28);
    const key = Bytes.zero(HASH_SIZE);
    let i = 0;
    for (const byte of u32AsLeBytes(serviceId)) {
      key.raw[i] = byte;
      key.raw[i + 1] = newHash[i / 2];
      i += 2;
    }
    // no need to floor, since we know it's divisible (adding +2 every iteration).
    const middle = i / 2;
    key.raw.set(newHash.subarray(middle), i);
    return key.asOpaque();
  }
}

/** https://graypaper.fluffylabs.dev/#/85129da/380101380101?v=0.6.3 */
export function legacyServiceNested(serviceId: ServiceId, hash: OpaqueHash): StateKey {
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
