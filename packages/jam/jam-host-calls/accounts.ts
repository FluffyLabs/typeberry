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
  lookup(serviceId: ServiceId, hash: Blake2bHash): Promise<BytesBlob | null>;
  /** Read service storage. */
  read(serviceId: ServiceId, hash: Blake2bHash): Promise<BytesBlob | null>;
}
