import type { Epoch } from "@typeberry/block";
import { SignedTicket } from "@typeberry/block/tickets.js";
import { type CodecRecord, codec } from "@typeberry/codec";
import { WithDebug } from "@typeberry/utils";

export class TicketsMessage extends WithDebug {
  static Codec = codec.Class(TicketsMessage, {
    epochIndex: codec.u32.asOpaque<Epoch>(),
    tickets: codec.sequenceVarLen(SignedTicket.Codec),
  });

  static create({ epochIndex, tickets }: CodecRecord<TicketsMessage>) {
    return new TicketsMessage(epochIndex, tickets);
  }

  private constructor(
    public readonly epochIndex: Epoch,
    public readonly tickets: SignedTicket[],
  ) {
    super();
  }
}
