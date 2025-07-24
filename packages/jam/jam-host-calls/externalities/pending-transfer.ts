import type { ServiceGas, ServiceId } from "@typeberry/block";
import type { Bytes } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { U64 } from "@typeberry/numbers";
import { TRANSFER_MEMO_BYTES } from "./partial-state.js";

/**
 * Deferred Transfer.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/173900173900?v=0.6.6
 */
export class PendingTransfer {
  static Codec = codec.Class(PendingTransfer, {
    source: codec.u32.asOpaque<ServiceId>(),
    destination: codec.u32.asOpaque<ServiceId>(),
    amount: codec.u64,
    memo: codec.bytes(TRANSFER_MEMO_BYTES),
    gas: codec.u64.asOpaque<ServiceGas>(),
  });

  private constructor(
    /** `s`: sending service */
    public readonly source: ServiceId,
    /** `d`: receiving service */
    public readonly destination: ServiceId,
    /** `a`: transfer amount */
    public readonly amount: U64,
    /** `m`: arbitrary bytes sent alongside the transfer (memo) */
    public readonly memo: Bytes<TRANSFER_MEMO_BYTES>,
    /** `g`: gas allowance for the transfer */
    public readonly gas: ServiceGas,
  ) {}

  static create({ source, destination, amount, memo, gas }: CodecRecord<PendingTransfer>) {
    return new PendingTransfer(source, destination, amount, memo, gas);
  }
}
