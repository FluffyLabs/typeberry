import type { Bytes } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { BANDERSNATCH_PROOF_BYTES, type BandersnatchProof } from "@typeberry/crypto/bandersnatch.js";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU8, tryAsU32, type U8 } from "@typeberry/numbers";
import { asOpaqueType, type Opaque, WithDebug } from "@typeberry/utils";
import { codecKnownSizeArray, codecWithContext } from "./codec-utils.js";

/**
 * The index of a ticket entry per validator.
 *
 * Constrained by `N = 2`:
 * https://graypaper.fluffylabs.dev/#/579bd12/417200417400
 */
export type TicketAttempt = Opaque<U8, "TicketAttempt[0|1|2]">;
export function tryAsTicketAttempt(x: number, chainSpec: ChainSpec): TicketAttempt {
  if (x >= chainSpec.ticketsPerValidator) {
    throw new Error(`Ticket attempt ${x} is out of bounds [0, ${chainSpec.ticketsPerValidator})`);
  }
  return asOpaqueType(tryAsU8(x));
}

const ticketAttemptCodec = codecWithContext((context) => {
  return codec.varU32.convert<TicketAttempt>(
    (x) => {
      tryAsTicketAttempt(x, context);
      return tryAsU32(x);
    },
    (x) => tryAsTicketAttempt(x, context),
  );
});

/* Bandersnatch-signed ticket contest entry. */
export class SignedTicket extends WithDebug {
  static Codec = codec.Class(SignedTicket, {
    attempt: ticketAttemptCodec,
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
    attempt: ticketAttemptCodec,
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
