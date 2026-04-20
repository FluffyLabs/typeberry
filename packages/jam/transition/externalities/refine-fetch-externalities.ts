import type { EntropyHash } from "@typeberry/block";
import { RefineContext } from "@typeberry/block/refine-context.js";
import type { WorkItemExtrinsic } from "@typeberry/block/work-item.js";
import { WorkPackage } from "@typeberry/block/work-package.js";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { general } from "@typeberry/jam-host-calls";
import type { U64 } from "@typeberry/numbers";
import type { ImportedSegment, PerWorkItem } from "../../in-core/refine.js";
import {
  encodeAllWorkItemSummaries,
  encodeWorkItemSummary,
  getEncodedConstants,
  u64ToArrayIndex,
} from "./fetch-externalities.js";

export type RefineFetchData = {
  workPackage: WorkPackage;
  /** Index of the work item currently being refined (`i` in GP). */
  currentWorkItemIndex: number;
  /** Imports per work item (`ī`). */
  imports: PerWorkItem<ImportedSegment[]>;
  /** Extrinsics per work item (`x̄`). */
  extrinsics: PerWorkItem<WorkItemExtrinsic[]>;
  /** Authorizer trace produced by Is-Authorized (`r`). */
  authorizerTrace: BytesBlob;
};

export class RefineFetchExternalities implements general.IRefineFetch {
  readonly context = general.FetchContext.Refine;

  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly data: RefineFetchData,
  ) {}

  constants(): BytesBlob {
    return getEncodedConstants(this.chainSpec);
  }

  /**
   * Refine entropy is `H₀` (zero hash) per GP §B.3.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/2fe0012fe201?v=0.7.2
   */
  entropy(): EntropyHash {
    return Bytes.zero(HASH_SIZE).asOpaque();
  }

  authorizerTrace(): BytesBlob {
    return this.data.authorizerTrace;
  }

  workItemExtrinsic(workItem: U64 | null, index: U64): BytesBlob | null {
    const itemIdx =
      workItem === null ? this.data.currentWorkItemIndex : u64ToArrayIndex(workItem, this.data.extrinsics.length);
    if (itemIdx === null) {
      return null;
    }
    const perItem = this.data.extrinsics[itemIdx];
    const xIdx = u64ToArrayIndex(index, perItem.length);
    if (xIdx === null) {
      return null;
    }
    return perItem[xIdx];
  }

  workItemImport(workItem: U64 | null, index: U64): BytesBlob | null {
    const itemIdx =
      workItem === null ? this.data.currentWorkItemIndex : u64ToArrayIndex(workItem, this.data.imports.length);
    if (itemIdx === null) {
      return null;
    }
    const perItem = this.data.imports[itemIdx];
    const segIdx = u64ToArrayIndex(index, perItem.length);
    if (segIdx === null) {
      return null;
    }
    // `Segment` extends `BytesBlob`, so it can be returned directly.
    return perItem[segIdx].data;
  }

  workPackage(): BytesBlob {
    return Encoder.encodeObject(WorkPackage.Codec, this.data.workPackage, this.chainSpec);
  }

  authConfiguration(): BytesBlob {
    return this.data.workPackage.authConfiguration;
  }

  authToken(): BytesBlob {
    return this.data.workPackage.authToken;
  }

  refineContext(): BytesBlob {
    return Encoder.encodeObject(RefineContext.Codec, this.data.workPackage.context);
  }

  /**
   * Kind 11: concatenation of `S(w)` for every work item in the package.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31f40231f402?v=0.7.2
   */
  allWorkItems(): BytesBlob {
    return encodeAllWorkItemSummaries(this.data.workPackage.items);
  }

  oneWorkItem(workItem: U64): BytesBlob | null {
    const items = this.data.workPackage.items;
    const idx = u64ToArrayIndex(workItem, items.length);
    if (idx === null) {
      return null;
    }
    return encodeWorkItemSummary(items[idx]);
  }

  workItemPayload(workItem: U64): BytesBlob | null {
    const items = this.data.workPackage.items;
    const idx = u64ToArrayIndex(workItem, items.length);
    if (idx === null) {
      return null;
    }
    return items[idx].payload;
  }
}
