import { RefineContext } from "@typeberry/block/refine-context.js";
import { WorkPackage } from "@typeberry/block/work-package.js";
import type { BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { general } from "@typeberry/jam-host-calls";
import type { U64 } from "@typeberry/numbers";
import {
  encodeAllWorkItemSummaries,
  encodeWorkItemSummary,
  getEncodedConstants,
  u64ToArrayIndex,
} from "./fetch-externalities.js";

export class IsAuthorizedFetchExternalities implements general.IIsAuthorizedFetch {
  readonly context = general.FetchContext.IsAuthorized;

  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly pkg: WorkPackage,
  ) {}

  constants(): BytesBlob {
    return getEncodedConstants(this.chainSpec);
  }

  workPackage(): BytesBlob {
    return Encoder.encodeObject(WorkPackage.Codec, this.pkg, this.chainSpec);
  }

  authConfiguration(): BytesBlob {
    return this.pkg.authConfiguration;
  }

  authToken(): BytesBlob {
    return this.pkg.authToken;
  }

  refineContext(): BytesBlob {
    return Encoder.encodeObject(RefineContext.Codec, this.pkg.context);
  }

  allWorkItems(): BytesBlob {
    return encodeAllWorkItemSummaries(this.pkg.items);
  }

  oneWorkItem(workItem: U64): BytesBlob | null {
    const items = this.pkg.items;
    const idx = u64ToArrayIndex(workItem, items.length);
    if (idx === null) {
      return null;
    }
    return encodeWorkItemSummary(items[idx]);
  }

  workItemPayload(workItem: U64): BytesBlob | null {
    const items = this.pkg.items;
    const idx = u64ToArrayIndex(workItem, items.length);
    if (idx === null) {
      return null;
    }
    return items[idx].payload;
  }
}
