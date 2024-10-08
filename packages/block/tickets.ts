import type { Bytes } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { Opaque } from "@typeberry/utils";
import type { BandersnatchRingSignature } from "./crypto";
import { HASH_SIZE } from "./hash";

export type TicketAttempt = Opaque<0 | 1, "TicketAttempt[0|1]">;
export const ticketAttemptCodec = codec.bool.convert<TicketAttempt>(
  (i) => i > 0,
  (o) => {
    return (o ? 1 : 0) as TicketAttempt;
  },
);

export class TicketEnvelope {
  static Codec = codec.Class(TicketEnvelope, {
    attempt: ticketAttemptCodec,
    signature: codec.bytes(784).cast(),
  });

  static fromCodec({ attempt, signature }: CodecRecord<TicketEnvelope>) {
    return new TicketEnvelope(attempt, signature);
  }

  constructor(
    public readonly attempt: TicketAttempt,
    public readonly signature: BandersnatchRingSignature,
  ) {}
}

export class TicketsMark {
  static Codec = codec.Class(TicketsMark, {
    id: codec.bytes(HASH_SIZE),
    attempt: ticketAttemptCodec,
  });

  static fromCodec({ id, attempt }: CodecRecord<TicketsMark>) {
    return new TicketsMark(id, attempt);
  }

  constructor(
    public readonly id: Bytes<32>,
    public readonly attempt: TicketAttempt,
  ) {}
}

export type TicketsExtrinsic = KnownSizeArray<TicketEnvelope, "Size: 0..16">;
export const ticketsExtrinsicCodec = codec.sequenceVarLen(TicketEnvelope.Codec).cast();
