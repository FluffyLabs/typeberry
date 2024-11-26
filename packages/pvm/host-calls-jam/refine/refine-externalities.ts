import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import type { U32 } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";

/**
 * Running PVM instance identifier.
 *
 * TODO [ToDr] [crit] GP does not specify a limit for this.
 * We need to check practically if it's possible for a `refine` program
 * to keep creating inner PVM instances until this overflows.
 * A `bigint` might be a safer choice here?
 */
export type MachineId = Opaque<U32, "MachineId[u32]">;

/** Host functions external invokations available during refine phase. */
export interface RefineExternalities {
  /** Start an inner PVM instance with given entry point and starting code. */
  startMachine(code: BytesBlob, programCounter: U32): Promise<MachineId>;

  /** Lookup a historical preimage. */
  historicalLookup(serviceId: ServiceId, hash: Blake2bHash): Promise<BytesBlob | null>;
}
