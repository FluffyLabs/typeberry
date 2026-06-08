import type { EntropyHash, Epoch } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import type { ChainSpec } from "@typeberry/config";
import { Logger } from "@typeberry/logger";
import bandersnatchVrf from "@typeberry/safrole/bandersnatch-vrf.js";
import type { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import type { State } from "@typeberry/state";
import {
  type TicketValidator,
  type ValidatedTicket,
  ValidationError,
  type VerifiedTicket,
  type VerifiedTicketPool,
} from "@typeberry/ticket-pool";
import { Result } from "@typeberry/utils";

const logger = Logger.new(import.meta.filename, "ticket-validator");

/**
 * Real {@link TicketValidator} implementation that verifies a ticket against the ring
 * commitment and current epoch entropy using bandersnatch, then stores the verified
 * ticket (with its computed id) into the supplied {@link VerifiedTicketPool}.
 *
 * `getState` is a thunk because state advances continuously while validation is in
 * flight; we want the latest available state for each call.
 */
export class BandersnatchTicketValidator implements TicketValidator {
  constructor(
    private readonly bandersnatch: BandernsatchWasm,
    private readonly chainSpec: ChainSpec,
    private readonly pool: VerifiedTicketPool,
    private readonly getState: () => State | null,
  ) {}

  async validate(epochIndex: Epoch, ticket: SignedTicket): Promise<Result<ValidatedTicket, ValidationError>> {
    const state = this.getState();
    if (state === null) {
      return Result.error(ValidationError.ValidatorUnavailable, () => "no state available");
    }

    const entropy = this.getTicketEntropy(epochIndex, state);
    // Batch verifier: a single `isValid` covers the whole batch and `tickets` holds the
    // computed id per input ticket. We only ever pass one ticket here.
    const { isValid, tickets } = await bandersnatchVrf.verifyTickets(
      this.bandersnatch,
      state.designatedValidatorData.length,
      state.epochRoot,
      [ticket],
      entropy,
    );

    if (tickets.length !== 1) {
      logger.error`verifyTickets returned ${tickets.length} results for 1 ticket`;
      return Result.error(ValidationError.ValidatorUnavailable, () => "verifier returned unexpected result count");
    }

    if (!isValid) {
      return Result.error(ValidationError.InvalidProof, () => "bandersnatch proof rejected");
    }

    const verified: VerifiedTicket = { ticket, id: tickets[0] };
    this.pool.add(epochIndex, [verified]);
    return Result.ok({ id: tickets[0] });
  }

  /**
   * Returns the correct tickets entropy for verification given the current state.
   *
   * When `state` is from epoch E-1 (i.e. we haven't produced epoch E's first block yet),
   * the ticket entropy for epoch E is at index 1 (not yet shifted). After the epoch
   * transition it moves to index 2.
   */
  private getTicketEntropy(epochIndex: Epoch, state: State): EntropyHash {
    const stateEpoch = Math.floor(state.timeslot / this.chainSpec.epochLength);
    return epochIndex > stateEpoch ? state.entropy[1] : state.entropy[2];
  }
}
