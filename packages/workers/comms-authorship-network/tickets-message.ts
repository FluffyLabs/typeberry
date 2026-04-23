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

/** Single-ticket message sent from jam-network to block-authorship (one ticket per peer relay). */
export class ReceivedTicketMessage extends WithDebug {
  static Codec = codec.Class(ReceivedTicketMessage, {
    epochIndex: codec.u32.asOpaque<Epoch>(),
    ticket: SignedTicket.Codec,
  });

  static create({ epochIndex, ticket }: CodecRecord<ReceivedTicketMessage>) {
    return new ReceivedTicketMessage(epochIndex, ticket);
  }

  private constructor(
    public readonly epochIndex: Epoch,
    public readonly ticket: SignedTicket,
  ) {
    super();
  }
}
