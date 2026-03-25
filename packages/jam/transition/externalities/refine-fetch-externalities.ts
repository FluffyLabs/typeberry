import type { EntropyHash } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { general } from "@typeberry/jam-host-calls";
import type { U64 } from "@typeberry/numbers";
import { getEncodedConstants } from "./fetch-externalities.js";

export class RefineFetchExternalities implements general.IRefineFetch {
  readonly context = general.FetchContext.Refine;

  constructor(private readonly chainSpec: ChainSpec) {}

  constants(): BytesBlob {
    return getEncodedConstants(this.chainSpec);
  }

  // Returns H₀ (zero hash)
  entropy(): EntropyHash {
    return Bytes.zero(HASH_SIZE).asOpaque();
  }

  authorizerTrace(): BytesBlob | null {
    return null;
  }

  workItemExtrinsic(_workItem: U64 | null, _index: U64): BytesBlob | null {
    return null;
  }

  workItemImport(_workItem: U64 | null, _index: U64): BytesBlob | null {
    return null;
  }

  workPackage(): BytesBlob | null {
    return null;
  }

  authorizer(): BytesBlob | null {
    return null;
  }

  authorizationToken(): BytesBlob | null {
    return null;
  }

  refineContext(): BytesBlob | null {
    return null;
  }

  allWorkItems(): BytesBlob | null {
    return null;
  }

  oneWorkItem(_workItem: U64): BytesBlob | null {
    return null;
  }

  workItemPayload(_workItem: U64): BytesBlob | null {
    return null;
  }
}
