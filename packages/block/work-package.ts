import type { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { FixedSizeArray } from "@typeberry/collections";
import type { ServiceId } from "./common";
import { HASH_SIZE } from "./hash";
import { RefineContext } from "./refine-context";
import { WorkItem } from "./work-item";

/**
 *
 * `P = (j ∈ Y, h ∈ NS, u ∈ H, p ∈ Y, x ∈ X, w ∈ ⟦I⟧1∶I)
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/193300193500
 */
export class WorkPackage {
  static Codec = codec.Class(WorkPackage, {
    authorization: codec.blob,
    authCodeHost: codec.u32.cast(),
    authorizationCodeHash: codec.bytes(HASH_SIZE),
    parametrization: codec.blob,
    context: RefineContext.Codec,
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
    return new WorkPackage(authorization, authCodeHost, authorizationCodeHash, parametrization, context, items);
  }

  constructor(
    /** `j`: simple blob acting as an authorization token */
    public readonly authorization: BytesBlob,
    /** `h`: index of the service that hosts the authorization code */
    public readonly authCodeHost: ServiceId,
    /** `u`: authorization code hash */
    public readonly authorizationCodeHash: Bytes<typeof HASH_SIZE>,
    /** `p`: authorization parametrization blob */
    public readonly parametrization: BytesBlob,
    /** `x`: context in which the refine function should run */
    public readonly context: RefineContext,
    /**
     * `w`: sequence of work items.
     * TODO [ToDr] most likely the max number of work items should be part of the context?
     */
    public readonly items: FixedSizeArray<WorkItem, 1 | 2 | 3 | 4>,
  ) {}
}
