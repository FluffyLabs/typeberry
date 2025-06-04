import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import type { AccountsRead } from "@typeberry/jam-host-calls/read";

export class AccountsReadExternalities implements AccountsRead {
  read(_serviceId: ServiceId | null, _hash: Blake2bHash): Promise<BytesBlob | null> {
    throw new Error("Method not implemented.");
  }
}
