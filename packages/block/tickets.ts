import type { Bytes } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { Opaque } from "@typeberry/utils";
import { BANDERSNATCH_RING_SIGNATURE_BYTES, type BandersnatchRingSignature } from "./crypto";
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
    signature: codec.bytes(BANDERSNATCH_RING_SIGNATURE_BYTES).cast(),
  });

  static fromCodec({ attempt, signature }: CodecRecord<TicketEnvelope>) {
    return new TicketEnvelope(attempt, signature);
  }

  constructor(
    public readonly attempt: TicketAttempt,
    public readonly signature: BandersnatchRingSignature,
  ) {}
}

export class Ticket {
  static Codec = codec.Class(Ticket, {
    id: codec.bytes(HASH_SIZE),
    attempt: ticketAttemptCodec,
  });

  static fromCodec({ id, attempt }: CodecRecord<Ticket>) {
    return new Ticket(id, attempt);
  }

  constructor(
    /**
     * Ticket identifier - a high-entropy unbiasable 32-octet sequence.
     *
     * Used both as a score in the ticket contest and as input to the on-chain VRF.
     */
    public readonly id: Bytes<32>,
    public readonly attempt: TicketAttempt,
  ) {}
}

/**
 * A sequence of proofs of valid tickets.
 *
 * https://graypaper.fluffylabs.dev/#/387103d/0e90020e9502
 */
export type TicketsExtrinsic = KnownSizeArray<TicketEnvelope, "Size: 0..16">;

export const ticketsExtrinsicCodec = codec.sequenceVarLen(TicketEnvelope.Codec).cast<TicketsExtrinsic>();
