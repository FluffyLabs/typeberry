import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import type { AccountsLookup } from "@typeberry/jam-host-calls/lookup.js";
import type { State } from "@typeberry/state";

export class AccountsLookupExternalities implements AccountsLookup {
  constructor(private state: Pick<State, "getService">) {}

  async lookup(serviceId: ServiceId | null, hash: Blake2bHash): Promise<BytesBlob | null> {
    if (serviceId === null) {
      return null;
    }

    const service = this.state.getService(serviceId);

    if (service === null) {
      return null;
    }

    return service.getPreimage(hash.asOpaque());
  }
}
