import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import type { AccountsLookup } from "@typeberry/jam-host-calls/lookup";

export class AccountsLookupExternalities implements AccountsLookup {
  lookup(_serviceId: ServiceId | null, _hash: Blake2bHash): Promise<BytesBlob | null> {
    throw new Error("Method not implemented.");
  }
}
