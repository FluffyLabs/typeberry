import { BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { general } from "@typeberry/jam-host-calls";
import type { U64 } from "@typeberry/numbers";
import { getEncodedConstants } from "./fetch-externalities.js";

export class IsAuthorizedFetchExternalities implements general.IIsAuthorizedFetch {
  readonly context = general.FetchContext.IsAuthorized;

  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly params: {
      authToken: BytesBlob;
      authConfiguration: BytesBlob;
    },
  ) {}

  constants(): BytesBlob {
    return getEncodedConstants(this.chainSpec);
  }

  // TODO [ToDr] Return encoded work package E(p)
  workPackage(): BytesBlob {
    return BytesBlob.empty();
  }

  authConfiguration(): BytesBlob {
    return this.params.authConfiguration;
  }

  authToken(): BytesBlob {
    return this.params.authToken;
  }

  // TODO [ToDr] Return encoded refinement context
  refineContext(): BytesBlob {
    return BytesBlob.empty();
  }

  // TODO [ToDr] Return encoded work items
  allWorkItems(): BytesBlob {
    return BytesBlob.empty();
  }

  // TODO [ToDr] Return single work item summary
  oneWorkItem(_workItem: U64): BytesBlob | null {
    return null;
  }

  // TODO [ToDr] Return work item payload
  workItemPayload(_workItem: U64): BytesBlob | null {
    return null;
  }
}
