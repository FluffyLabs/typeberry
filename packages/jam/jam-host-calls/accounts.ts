import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";

/**
 * Account data interface for host calls.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/106001106001?v=0.6.6
 */
export interface Accounts {
  /** Lookup a preimage. */
  lookup(serviceId: ServiceId | null, hash: Blake2bHash): Promise<BytesBlob | null>;
  /** Read service storage. */
  read(serviceId: ServiceId | null, hash: Blake2bHash): Promise<BytesBlob | null>;
  /**
   * Alter the account storage. Put `data` under given key hash.
   * `null` indicates the storage entry should be removed.
   */
  write(serviceId: ServiceId, hash: Blake2bHash, data: BytesBlob | null): Promise<void>;
  /**
   * Read the length of some value from account snapshot state.
   * Returns `null` if the storage entry was empty.
   */
  readSnapshotLength(serviceId: ServiceId, hash: Blake2bHash): Promise<number | null>;
  /**
   * Returns true if the storage is already full.
   *
   * It means that the threshold balance `a_t` is greater than current account balance `a_b`.
   * TODO [ToDr] Can be computed from `AccountInfo` - might need to be merged later.
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/331002331402?v=0.6.6
   */
  isStorageFull(serviceId: ServiceId): Promise<boolean>;
}
