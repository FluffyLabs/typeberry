import type { EntropyHash, Epoch } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import type { ChainSpec } from "@typeberry/config";
import bandersnatchVrf from "@typeberry/safrole/bandersnatch-vrf.js";
import type { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import type { State } from "@typeberry/state";
import { type TicketValidator, ValidationError, type VerifiedTicket } from "@typeberry/ticket-pool";
import { Result } from "@typeberry/utils";

/**
 * {@link TicketValidator} implementation that verifies a ticket against the ring
 * commitment and current epoch entropy using bandersnatch.
 *
 * `getState` is a thunk because state advances continuously while validation is in
 * flight; we want the latest available state for each call.
 */
export class BandersnatchTicketValidator implements TicketValidator {
  static new(chainSpec: ChainSpec, bandersnatch: BandernsatchWasm, getState: () => State) {
    return new BandersnatchTicketValidator(chainSpec, bandersnatch, getState);
  }

  private constructor(
    private readonly chainSpec: ChainSpec,
    private readonly bandersnatch: BandernsatchWasm,
    private readonly getState: () => State,
  ) {}

  async validate(epochIndex: Epoch, inTickets: SignedTicket[]): Promise<Result<VerifiedTicket[], ValidationError>> {
    const state = this.getState();
    // because we use either current or next entropy, tickets
    // from incorrect epochs will fail verification (however that might be expensive)
    // TODO [ToDr] We should early reject tickets from invalid epochs.
    const entropy = this.getTicketEntropy(epochIndex, state);
    // Batch verifier: a single `isValid` covers the whole batch
    // and `tickets` holds the computed id per input ticket.
    const { isValid, tickets } = await bandersnatchVrf.verifyTickets(
      this.bandersnatch,
      state.designatedValidatorData.length,
      state.epochRoot,
      inTickets,
      entropy,
    );

    if (tickets.length !== inTickets.length) {
      return Result.error(
        ValidationError.ValidatorUnavailable,
        () => `io size mismatch got: ${tickets.length}, expected ${inTickets.length}`,
      );
    }

    if (!isValid) {
      return Result.error(ValidationError.InvalidProof, () => "bandersnatch proof rejected");
    }

    return Result.ok(
      inTickets.map((ticket, index) => {
        const id = tickets[index];
        return { ticket, id };
      }),
    );
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
