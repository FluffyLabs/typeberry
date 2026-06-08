import type { Transferable } from "node:worker_threads";

/**
 * Parameters for a single ticket-generation shard sent to a worker thread.
 *
 * All fields are raw bytes / typed arrays so they survive structured-clone
 * across the worker boundary without losing class identity. The worker calls
 * `batchGenerateRingVrfForValidators` with exactly these and returns the raw
 * signature bytes.
 */
export class TicketGenShardParams {
  constructor(
    /** Concatenated ring public keys (`ringSize * 32` bytes). */
    readonly ringKeysData: Uint8Array,
    /** Index within the ring for each validator in this shard. */
    readonly proverKeyIndices: Uint32Array,
    /** Concatenated validator secret seeds (`count * secretSeedDataLen` bytes). */
    readonly secretSeedsData: Uint8Array,
    /** Length of each secret seed in `secretSeedsData`. */
    readonly secretSeedDataLen: number,
    /** Concatenated VRF inputs, one per attempt. */
    readonly inputsData: Uint8Array,
    /** Length of each VRF input in `inputsData`. */
    readonly vrfInputDataLen: number,
  ) {}

  /**
   * No transfers: `ringKeysData` and `inputsData` are shared across all shards,
   * so transferring would detach them for the other shards. The buffers are
   * small (tens of KB), so a structured-clone copy is negligible next to the
   * hundreds-of-ms-per-proof generation cost.
   */
  getTransferList(): Transferable[] {
    return [];
  }
}

/** Result of a ticket-generation shard: the raw `batchGenerateRingVrfForValidators` output. */
export class TicketGenShardResult {
  constructor(
    /** Raw output: validator-major, attempt-major records of `status || signature`. */
    readonly signatures: Uint8Array,
  ) {}

  /**
   * No transfers: the native binding returns a view backed by external/WASM
   * memory that cannot be detached, so transferring it throws inside the worker
   * (and the framework's error fallback then also throws on the non-cloneable
   * `details` closure, hanging the task). Letting structured-clone copy the bytes
   * is correct and cheap (tens of KB per shard).
   */
  getTransferList(): Transferable[] {
    return [];
  }
}
