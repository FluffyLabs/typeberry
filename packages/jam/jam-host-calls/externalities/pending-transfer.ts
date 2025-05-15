import type { ServiceGas, ServiceId } from "@typeberry/block";
import type { Bytes } from "@typeberry/bytes";
import type { CodecRecord } from "@typeberry/codec";
import type { U64 } from "@typeberry/numbers";
import type { TRANSFER_MEMO_BYTES } from "./partial-state";

export class PendingTransfer {
  private constructor(
    public readonly source: ServiceId,
    public readonly destination: ServiceId,
    public readonly amount: U64,
    public readonly memo: Bytes<TRANSFER_MEMO_BYTES>,
    public readonly gas: ServiceGas,
  ) {}

  static create(x: CodecRecord<PendingTransfer>) {
    return new PendingTransfer(x.source, x.destination, x.amount, x.memo, x.gas);
  }
}
