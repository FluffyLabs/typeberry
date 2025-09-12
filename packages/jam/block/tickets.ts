import type { Bytes } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { BANDERSNATCH_PROOF_BYTES, type BandersnatchProof } from "@typeberry/crypto/bandersnatch.js";
import { HASH_SIZE } from "@typeberry/hash";
import { type U8, tryAsU8 } from "@typeberry/numbers";
import { type Opaque, WithDebug, asOpaqueType } from "@typeberry/utils";
import { codecKnownSizeArray, codecWithContext } from "./codec.js";

/**
 * The index of a ticket entry per validator.
 *
 * Constrained by `N = 2`:
 * https://graypaper.fluffylabs.dev/#/579bd12/417200417400
 */
export type TicketAttempt = Opaque<U8, "TicketAttempt[0|1|2]">;
export function tryAsTicketAttempt(x: number): TicketAttempt {
  return asOpaqueType(tryAsU8(x));
}

/* Bandersnatch-signed ticket contest entry. */
export class SignedTicket extends WithDebug {
  static Codec = codec.Class(SignedTicket, {
    // TODO [ToDr] we should verify that attempt is either 0|1|2.
    attempt: codec.u8.asOpaque<TicketAttempt>(),
    signature: codec.bytes(BANDERSNATCH_PROOF_BYTES).asOpaque<BandersnatchProof>(),
  });

  static create({ attempt, signature }: CodecRecord<SignedTicket>) {
    return new SignedTicket(attempt, signature);
  }

  private constructor(
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
    // TODO [ToDr] we should verify that attempt is either 0|1|2.
    attempt: codec.u8.asOpaque<TicketAttempt>(),
  });

  static create({ id, attempt }: CodecRecord<Ticket>) {
    return new Ticket(id, attempt);
  }

  private constructor(
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

  public isEqualTo(other: Ticket) {
    return this.id.isEqualTo(other.id) && this.attempt === other.attempt;
  }
}

/**
 * A sequence of proofs of valid tickets.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/0f13000f1800
 *
 * Constrained by `K = 16`:
 * https://graypaper.fluffylabs.dev/#/579bd12/416c00416e00
 */
const TicketsExtrinsicBounds = "Size: [0..chainSpec.maxTicketsPerExtrinsic)";
export type TicketsExtrinsic = KnownSizeArray<SignedTicket, typeof TicketsExtrinsicBounds>;

export const ticketsExtrinsicCodec = codecWithContext((context) => {
  return codecKnownSizeArray(
    SignedTicket.Codec,
    {
      minLength: 0,
      maxLength: context.maxTicketsPerExtrinsic,
      typicalLength: context.maxTicketsPerExtrinsic,
    },
    TicketsExtrinsicBounds,
  );
});
