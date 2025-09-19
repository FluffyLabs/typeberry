import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec, type DescribedBy } from "@typeberry/codec";
import { FixedSizeArray } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU8, type U8 } from "@typeberry/numbers";
import { Compatibility, check, GpVersion, WithDebug } from "@typeberry/utils";
import type { ServiceId } from "./common.js";
import type { CodeHash } from "./hash.js";
import { RefineContext } from "./refine-context.js";
import { WorkItem } from "./work-item.js";

/** Possible number of work items in the package or results in the report. */
/** Constrained by I=16 https://graypaper.fluffylabs.dev/#/68eaa1f/417a00417a00?v=0.6.4 */
export type WorkItemsCount = U8;

/** Verify the value is within the `WorkItemsCount` bounds. */
export function tryAsWorkItemsCount(len: number): WorkItemsCount {
  check`
    ${len >= MIN_NUMBER_OF_WORK_ITEMS && len <= MAX_NUMBER_OF_WORK_ITEMS}
    WorkItemsCount: Expected '${MIN_NUMBER_OF_WORK_ITEMS} <= count <= ${MAX_NUMBER_OF_WORK_ITEMS}' got ${len}
  `;
  return tryAsU8(len);
}

/** Minimal number of work items in the work package or results in work report. */
export const MIN_NUMBER_OF_WORK_ITEMS = 1;
/** `I`: Maximal number of work items in the work package or results in work report. */
export const MAX_NUMBER_OF_WORK_ITEMS = 16;

/**
 * A piece of work done within a core.
 *
 * `P = (j ∈ Y, h ∈ NS, u ∈ H, p ∈ Y, x ∈ X, w ∈ ⟦I⟧1∶I)
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/197000197200
 */
export class WorkPackage extends WithDebug {
  static Codec = Compatibility.isGreaterOrEqual(GpVersion.V0_7_0)
    ? codec.Class(WorkPackage, {
        authCodeHost: codec.u32.asOpaque<ServiceId>(),
        authCodeHash: codec.bytes(HASH_SIZE).asOpaque<CodeHash>(),
        context: RefineContext.Codec,
        authorization: codec.blob,
        parametrization: codec.blob,
        items: codec.sequenceVarLen(WorkItem.Codec).convert(
          (x) => x,
          (items) => FixedSizeArray.new(items, tryAsWorkItemsCount(items.length)),
        ),
      })
    : codec.Class(WorkPackage, {
        authorization: codec.blob,
        authCodeHost: codec.u32.asOpaque<ServiceId>(),
        authCodeHash: codec.bytes(HASH_SIZE).asOpaque<CodeHash>(),
        parametrization: codec.blob,
        context: RefineContext.Codec,
        items: codec.sequenceVarLen(WorkItem.Codec).convert(
          (x) => x,
          (items) => FixedSizeArray.new(items, tryAsWorkItemsCount(items.length)),
        ),
      });

  static create({
    authorization,
    authCodeHost,
    authCodeHash,
    parametrization,
    context,
    items,
  }: CodecRecord<WorkPackage>) {
    return new WorkPackage(authorization, authCodeHost, authCodeHash, parametrization, context, items);
  }

  private constructor(
    /** `j`: simple blob acting as an authorization token */
    public readonly authorization: BytesBlob,
    /** `h`: index of the service that hosts the authorization code */
    public readonly authCodeHost: ServiceId,
    /** `u`: authorization code hash */
    public readonly authCodeHash: CodeHash,
    /** `p`: authorization parametrization blob */
    public readonly parametrization: BytesBlob,
    /** `x`: context in which the refine function should run */
    public readonly context: RefineContext,
    /**
     * `w`: sequence of work items.
     *
     * Constrained by `I=16`:
     * https://graypaper.fluffylabs.dev/#/579bd12/416600416800
     */
    public readonly items: FixedSizeArray<WorkItem, WorkItemsCount>,
  ) {
    super();
  }
}

export type WorkPackageView = DescribedBy<typeof WorkPackage.Codec.View>;
