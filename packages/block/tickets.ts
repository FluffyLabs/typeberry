import type { Bytes } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import type { Opaque } from "@typeberry/utils";
import { WithDebug } from "./common";
import { BANDERSNATCH_PROOF_BYTES, type BandersnatchProof } from "./crypto";

/**
 * The index of a ticket entry per validator.
 *
 * Constrained by `N = 2`:
 * https://graypaper.fluffylabs.dev/#/c71229b/3d5f003d6100
 */
export type TicketAttempt = Opaque<0 | 1, "TicketAttempt[0|1]">;
export const ticketAttemptCodec = codec.bool.convert<TicketAttempt>(
  (i) => i > 0,
  (o) => {
    return (o ? 1 : 0) as TicketAttempt;
  },
);

/* Bandernsatch-signed ticket contest entry. */
export class SignedTicket extends WithDebug {
  static Codec = codec.Class(SignedTicket, {
    attempt: ticketAttemptCodec,
    signature: codec.bytes(BANDERSNATCH_PROOF_BYTES).cast(),
  });

  static fromCodec({ attempt, signature }: CodecRecord<SignedTicket>) {
    return new SignedTicket(attempt, signature);
  }

  constructor(
    /** Which attempt was it? */
    public readonly attempt: TicketAttempt,
    /** The bandersnatch membership proof of knowledge. */
    public readonly signature: BandersnatchProof,
  ) {
    super();
  }
}

/** Anonymous? entry into the ticket contest. */
export class Ticket extends WithDebug {
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
    /** Which attempt is it? */
    public readonly attempt: TicketAttempt,
  ) {
    super();
  }
}

/**
 * A sequence of proofs of valid tickets.
 *
 * https://graypaper.fluffylabs.dev/#/387103d/0e90020e9502
 *
 * Constrained by `K = 16`:
 * https://graypaper.fluffylabs.dev/#/c71229b/3d59003d5b00
 */
export type TicketsExtrinsic = KnownSizeArray<SignedTicket, "Size: 0..16">;

// TODO [ToDr] constrain the sequence length during decoding.
export const ticketsExtrinsicCodec = codec.sequenceVarLen(SignedTicket.Codec).cast<TicketsExtrinsic>();
