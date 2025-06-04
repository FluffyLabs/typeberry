import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import type { AccountsWrite } from "@typeberry/jam-host-calls/write";

export class AccountsWriteExternalities implements AccountsWrite {
  write(_serviceId: ServiceId, _hash: Blake2bHash, _data: BytesBlob | null): Promise<void> {
    throw new Error("Method not implemented.");
  }

  readSnapshotLength(_serviceId: ServiceId, _hash: Blake2bHash): Promise<number | null> {
    throw new Error("Method not implemented.");
  }

  isStorageFull(_serviceId: ServiceId): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}
