import type { Transferable } from "node:worker_threads";

/**
 * Parameters for a single ticket-generation shard sent to a worker thread.
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
   * so transferring would detach them for the other shards.
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
   * memory that cannot be detached, so transferring it throws inside the worker.
   */
  getTransferList(): Transferable[] {
    return [];
  }
}
