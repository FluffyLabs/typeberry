import type { BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { general } from "@typeberry/jam-host-calls";
import type { U64 } from "@typeberry/numbers";
import { getEncodedConstants, u64ToArrayIndex, type WorkPackageFetchData } from "./fetch-externalities.js";

export class IsAuthorizedFetchExternalities implements general.IIsAuthorizedFetch {
  readonly context = general.FetchContext.IsAuthorized;

  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly pkg: WorkPackageFetchData,
  ) {}

  constants(): BytesBlob {
    return getEncodedConstants(this.chainSpec);
  }

  workPackage(): BytesBlob {
    return this.pkg.packageView.encoded();
  }

  authConfiguration(): BytesBlob {
    return this.pkg.packageView.authConfiguration.view();
  }

  authToken(): BytesBlob {
    return this.pkg.packageView.authToken.view();
  }

  refineContext(): BytesBlob {
    return this.pkg.packageView.context.encoded();
  }

  allWorkItems(): BytesBlob {
    return this.pkg.workItemSummaries.encoded();
  }

  oneWorkItem(workItem: U64): BytesBlob | null {
    const idx = u64ToArrayIndex(workItem, this.pkg.workItemSummaries.length);
    return idx === null ? null : (this.pkg.workItemSummaries.get(idx)?.encoded() ?? null);
  }

  workItemPayload(workItem: U64): BytesBlob | null {
    const items = this.pkg.packageView.items.view();
    const idx = u64ToArrayIndex(workItem, items.length);
    if (idx === null) {
      return null;
    }
    return items.get(idx)?.view().payload.view() ?? null;
  }
}
