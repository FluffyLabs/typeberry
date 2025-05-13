import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import type { ServiceAccountInfo } from "@typeberry/state";

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
   * - aka Not enough balance to pay for the storage.
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/331002331402?v=0.6.6
   */
  isStorageFull(serviceId: ServiceId): Promise<boolean>;
  /** Get account info. */
  getInfo(serviceId: ServiceId | null): Promise<ServiceAccountInfo | null>;
}
