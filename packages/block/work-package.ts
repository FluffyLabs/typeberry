import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { FixedSizeArray } from "@typeberry/collections";
import type { ServiceId } from "./common";
import { type CodeHash, HASH_SIZE } from "./hash";
import { RefineContext } from "./refine-context";
import { WorkItem } from "./work-item";

/** Possible number of work items in the package or results in the report. */
export type WorkItemsCount = 1 | 2 | 3 | 4;
/** Maximal number of work items in the work package or results in work report. */
export const MAX_NUMBER_OF_WORK_ITEMS = 4;

/**
 * A piece of work done within a core.
 *
 * `P = (j ∈ Y, h ∈ NS, u ∈ H, p ∈ Y, x ∈ X, w ∈ ⟦I⟧1∶I)
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/193300193500
 */
export class WorkPackage {
  static Codec = codec.Class(WorkPackage, {
    authorization: codec.blob,
    authCodeHost: codec.u32.cast(),
    authorizationCodeHash: codec.bytes(HASH_SIZE).cast(),
    parametrization: codec.blob,
    context: RefineContext.Codec,
    // TODO [ToDr] Constrain the size of the sequence during decoding.
    items: codec.sequenceVarLen(WorkItem.Codec),
  });

  static fromCodec({
    authorization,
    authCodeHost,
    authorizationCodeHash,
    parametrization,
    context,
    items,
  }: CodecRecord<WorkPackage>) {
    return new WorkPackage(
      authorization,
      authCodeHost,
      authorizationCodeHash,
      parametrization,
      context,
      new FixedSizeArray(items, items.length),
    );
  }

  constructor(
    /** `j`: simple blob acting as an authorization token */
    public readonly authorization: BytesBlob,
    /** `h`: index of the service that hosts the authorization code */
    public readonly authCodeHost: ServiceId,
    /** `u`: authorization code hash */
    public readonly authorizationCodeHash: CodeHash,
    /** `p`: authorization parametrization blob */
    public readonly parametrization: BytesBlob,
    /** `x`: context in which the refine function should run */
    public readonly context: RefineContext,
    /**
     * `w`: sequence of work items.
     *
     * Constrained by `I=4`:
     * https://graypaper.fluffylabs.dev/#/c71229b/3d56003d5800
     */
    public readonly items: FixedSizeArray<WorkItem, WorkItemsCount>,
  ) {}
}
