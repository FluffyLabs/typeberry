import type { EntropyHash, Epoch } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { Result } from "@typeberry/utils";

/**
 * Outcome of a successful validation.
 *
 * `id` is the entropy hash the validator computed for this ticket. It is `null` when the
 * concrete validator doesn't actually verify (e.g. {@link AcceptTicketsValidator}) or when
 * it delegates to another process that doesn't bother to send the id back over the wire.
 */
export type ValidatedTicket = {
  ticket: SignedTicket;
  id: EntropyHash;
};

/** Reasons a ticket may fail validation. */
export enum ValidationError {
  /** Verifier rejected the signature / proof. */
  InvalidProof = "invalid_proof",
  /** Validator could not run (e.g. state unavailable, transient internal failure). */
  ValidatorUnavailable = "validator_unavailable",
  /** Ticket is for an epoch outside the validator's window of interest. */
  WrongEpoch = "wrong_epoch",
}

/**
 * Strategy for verifying tickets arriving from peers.
 *
 * The concrete implementation may call into the bandersnatch verifier, defer to another
 * worker via IPC, or short-circuit (Accept/Deny defaults for tests).
 */
export interface TicketValidator {
  validate(epochIndex: Epoch, tickets: SignedTicket[]): Promise<Result<ValidatedTicket[], ValidationError>>;
}

/**
 * Accepts every ticket without inspection. Useful for unit tests where the validator
 * isn't the subject under test. Must never be used in production.
 */
export class AcceptTicketsValidator implements TicketValidator {
  async validate(_epochIndex: Epoch, ticket: SignedTicket[]): Promise<Result<ValidatedTicket[], ValidationError>> {
    return Result.ok(
      ticket.map((ticket) => ({
        ticket,
        id: Bytes.zero(HASH_SIZE).asOpaque(),
      })),
    );
  }
}

/**
 * Rejects every ticket. Used as the default for any task that needs an explicit, real
 * validator wired in before it will accept anything from the network.
 */
export class DenyTicketsValidator implements TicketValidator {
  async validate(_epochIndex: Epoch, _tickets: SignedTicket[]): Promise<Result<ValidatedTicket[], ValidationError>> {
    return Result.error(ValidationError.ValidatorUnavailable, () => "no ticket validator wired");
  }
}
