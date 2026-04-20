import type { EntropyHash } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { general } from "@typeberry/jam-host-calls";
import type { U64 } from "@typeberry/numbers";
import { getEncodedConstants } from "./fetch-externalities.js";

export class RefineFetchExternalities implements general.IRefineFetch {
  readonly context = general.FetchContext.Refine;

  static new(chainSpec: ChainSpec) {
    return new RefineFetchExternalities(chainSpec);
  }

  private constructor(private readonly chainSpec: ChainSpec) {}

  constants(): BytesBlob {
    return getEncodedConstants(this.chainSpec);
  }

  // Returns H₀ (zero hash)
  entropy(): EntropyHash {
    return Bytes.zero(HASH_SIZE).asOpaque();
  }

  // TODO [ToDr] implement
  authorizerTrace(): BytesBlob {
    return BytesBlob.empty();
  }

  // TODO [ToDr] implement
  workItemExtrinsic(_workItem: U64 | null, _index: U64): BytesBlob | null {
    return null;
  }

  // TODO [ToDr] implement
  workItemImport(_workItem: U64 | null, _index: U64): BytesBlob | null {
    return null;
  }

  // TODO [ToDr] implement
  workPackage(): BytesBlob {
    return BytesBlob.empty();
  }

  // TODO [ToDr] implement
  authConfiguration(): BytesBlob {
    return BytesBlob.empty();
  }

  // TODO [ToDr] implement
  authToken(): BytesBlob {
    return BytesBlob.empty();
  }

  // TODO [ToDr] implement
  refineContext(): BytesBlob {
    return BytesBlob.empty();
  }

  // TODO [ToDr] implement
  allWorkItems(): BytesBlob {
    return BytesBlob.empty();
  }

  oneWorkItem(_workItem: U64): BytesBlob | null {
    return null;
  }

  workItemPayload(_workItem: U64): BytesBlob | null {
    return null;
  }
}
