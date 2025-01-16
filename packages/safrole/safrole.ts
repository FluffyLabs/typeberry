import {
  type BandersnatchKey,
  type BandersnatchRingRoot,
  type Ed25519Key,
  type EntropyHash,
  type TimeSlot,
  ValidatorData,
} from "@typeberry/block";
import type { SignedTicket, Ticket } from "@typeberry/block/tickets";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { Ordering, SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { blake2b } from "@typeberry/hash";
import { Result } from "@typeberry/utils";
import { getRingCommitment, verifyTickets } from "./bandersnatch";

export const VALIDATOR_META_BYTES = 128;
export type VALIDATOR_META_BYTES = typeof VALIDATOR_META_BYTES;

const ticketComparator = (a: Ticket, b: Ticket) => {
  if (a.id.isLessThan(b.id)) {
    return Ordering.Less;
  }

  if (a.id.isEqualTo(b.id)) {
    return Ordering.Equal;
  }

  return Ordering.Greater;
};

export type State = {
  timeslot: number;
  entropy: [EntropyHash, EntropyHash, EntropyHash, EntropyHash];
  prevValidators: ValidatorData[];
  currValidators: ValidatorData[];
  nextValidators: ValidatorData[];
  designedValidators: ValidatorData[];
  ticketsAccumulator: Ticket[];
  sealingKeySeries: {
    keys?: BandersnatchKey[];
    tickets?: Ticket[];
  };
  epochRoot: BandersnatchRingRoot;
  postOffenders: Ed25519Key[];
};

export type StateDiff = {
  timeslot?: number;
  entropy?: [EntropyHash, EntropyHash, EntropyHash, EntropyHash];
  prevValidators?: ValidatorData[];
  currValidators?: ValidatorData[];
  nextValidators?: ValidatorData[];
  designedValidators?: ValidatorData[];
  ticketsAccumulator?: Ticket[];
  sealingKeySeries?: {
    keys?: BandersnatchKey[];
    tickets?: Ticket[];
  };
  epochRoot?: BandersnatchRingRoot;
};

export class EpochMark {
  constructor(
    public entropy: EntropyHash,
    public ticketsEntropy: EntropyHash,
    public validators: BandersnatchKey[],
  ) {}
}

type TicketMark = {
  id: string;
  attempts: number;
};

type TicketsMark = TicketMark[];

type OkResult = {
  epochMark: EpochMark | null;
  ticketsMark: TicketsMark | null;
};

enum SafroleErrorCode {
  IncorrectData = "incorrect_data",
  // Timeslot value must be strictly monotonic.
  BadSlot = "bad_slot",
  // Received a ticket while in epoch's tail.
  UnexpectedTicket = "unexpected_ticket",
  // Tickets must be sorted.
  BadTicketOrder = "bad_ticket_order",
  // Invalid ticket ring proof.
  BadTicketProof = "bad_ticket_proof",
  // Invalid ticket attempt value.
  BadTicketAttempt = "bad_ticket_attempt",
  // Reserved
  Reserved = "reserved", // todo: it is not covered by test vectors
  // Found a ticket duplicate.
  DuplicateTicket = "duplicate_ticket",
}

export class Safrole {
  constructor(
    public state: State,
    private chainSpec: ChainSpec,
  ) {}

  /**
   * e' > e
   */
  private isEpochChanged(timeslot: TimeSlot): boolean {
    const previousEpoch = Math.floor(this.state.timeslot / this.chainSpec.epochLength);
    const currentEpoch = Math.floor(timeslot / this.chainSpec.epochLength);
    return currentEpoch > previousEpoch;
  }

  /**
   * e' === e
   */
  private isSameEpoch(timeslot: TimeSlot): boolean {
    const previousEpoch = Math.floor(this.state.timeslot / this.chainSpec.epochLength);
    const currentEpoch = Math.floor(timeslot / this.chainSpec.epochLength);
    return currentEpoch === previousEpoch;
  }

  /**
   * e' === e + 1
   */
  private isNextEpoch(timeslot: TimeSlot): boolean {
    const previousEpoch = Math.floor(this.state.timeslot / this.chainSpec.epochLength);
    const currentEpoch = Math.floor(timeslot / this.chainSpec.epochLength);
    return currentEpoch === previousEpoch + 1;
  }

  private getPreviousSlotPhaseIndex() {
    return this.state.timeslot % this.chainSpec.epochLength;
  }

  private getCurrentSlotPhaseIndex(timeslot: TimeSlot) {
    return timeslot % this.chainSpec.epochLength;
  }

  private getEntropy(
    timeslot: TimeSlot,
    entropyHash: EntropyHash,
  ): [EntropyHash, EntropyHash, EntropyHash, EntropyHash] {
    const [randomnessAcc, ...rest] = this.state.entropy;

    /**
     * Randomness accumulator - η′ from GP
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/0e17020e1702
     */
    const newRandomnessAcc = blake2b.hashBlobs([randomnessAcc.raw, entropyHash]).asOpaque();

    /**
     * Randomness history
     *
     * It is shifted when epoch is changed
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/0e57020e5702
     */

    if (this.isEpochChanged(timeslot)) {
      return [newRandomnessAcc, randomnessAcc, rest[0], rest[1]];
    }

    return [newRandomnessAcc, ...rest];
  }

  private async getValidatorKeys(
    timeslot: TimeSlot,
  ): Promise<
    Result<
      [ValidatorData[], ValidatorData[], ValidatorData[], BandersnatchRingRoot],
      typeof SafroleErrorCode.IncorrectData
    >
  > {
    if (!this.isEpochChanged(timeslot)) {
      const nextValidators = this.state.nextValidators;
      const currentValidators = this.state.currValidators;
      const previousValidators = this.state.prevValidators;
      const epochRoot = this.state.epochRoot;
      return Result.ok([nextValidators, currentValidators, previousValidators, epochRoot] as const);
    }

    const postOffenders = this.state.postOffenders; // postOffenders should be a dictionary
    const nextValidators = this.state.designedValidators.map((validator) => {
      const isOffender = !!postOffenders.find((x) => x.isEqualTo(validator.ed25519));
      if (isOffender) {
        return new ValidatorData(
          Bytes.zero(32).asOpaque(),
          Bytes.zero(32).asOpaque(),
          validator.bls,
          validator.metadata,
        );
      }

      return validator;
    });

    const currentValidators = this.state.nextValidators;
    const previousValidators = this.state.currValidators;
    const keys = nextValidators.reduce(
      (acc, validator, i) => {
        acc.set(validator.bandersnatch.raw, i * 32);
        return acc;
      },
      new Uint8Array(32 * nextValidators.length),
    );

    const epochRootResult = await getRingCommitment(keys);

    if (epochRootResult.isOk) {
      return Result.ok([nextValidators, currentValidators, previousValidators, epochRootResult.ok] as const);
    }

    return Result.error(SafroleErrorCode.IncorrectData);
  }

  private outsideInSequencer(tickets: Ticket[]) {
    const ticketsLength = tickets.length;
    const reorderedTickets = new Array<Ticket>(ticketsLength);

    if (ticketsLength % 2 === 1) {
      reorderedTickets[ticketsLength / 2] = tickets[ticketsLength / 2];
    }

    for (let i = 0; i < ticketsLength / 2; i += 1) {
      reorderedTickets[2 * i] = tickets[i];
      reorderedTickets[2 * i + 1] = tickets[ticketsLength - i - 1];
    }

    return reorderedTickets;
  }

  private fallbackKeySequencer(entropy: EntropyHash, newValidators: ValidatorData[]) {
    const epochLength = this.chainSpec.epochLength;
    const result: BandersnatchKey[] = [];
    const validatorsCount = newValidators.length;
    for (let i = 0; i < epochLength; i++) {
      const encoder = Encoder.create();
      encoder.i32(i);
      const iAsBytes = encoder.viewResult().raw;
      const bytes = blake2b.hashBlobs([entropy.raw, iAsBytes]).raw;
      const decoder = Decoder.fromBlob(bytes);
      const validatorIndex = decoder.u32() % validatorsCount;
      result.push(newValidators[validatorIndex].bandersnatch);
    }

    return result;
  }

  private getSlotSealerSeries(timeslot: TimeSlot, newValidators: ValidatorData[], newEntropy: EntropyHash) {
    const m = this.getPreviousSlotPhaseIndex();
    if (
      this.isNextEpoch(timeslot) &&
      m >= this.chainSpec.contestLength &&
      this.state.ticketsAccumulator.length === this.chainSpec.epochLength
    ) {
      return {
        tickets: this.outsideInSequencer(this.state.ticketsAccumulator),
      };
    }

    if (this.isSameEpoch(timeslot)) {
      return this.state.sealingKeySeries;
    }

    return {
      keys: this.fallbackKeySequencer(newEntropy, newValidators),
    };
  }

  applyStateChanges(diff: StateDiff): void {
    this.state = Object.assign(this.state, diff);
  }

  private getEpochMark(timeslot: TimeSlot, nextValidators: ValidatorData[]): EpochMark | null {
    if (!this.isEpochChanged(timeslot)) {
      return null;
    }

    const entropy = this.state.entropy;
    return new EpochMark(
      entropy[0],
      entropy[1],
      nextValidators.map((x) => x.bandersnatch),
    );
  }

  private areTicketsSorted(tickets: Ticket[]) {
    const ticketsLength = tickets.length;

    for (let i = 1; i < ticketsLength; i++) {
      if (!tickets[i - 1].id.isLessThan(tickets[i].id)) {
        return false;
      }
    }

    return true;
  }

  private areTicketsUnique(tickets: Ticket[]) {
    const ticketsLength = tickets.length;

    for (let i = 1; i < ticketsLength; i++) {
      if (tickets[i - 1].id.isEqualTo(tickets[i].id)) {
        return false;
      }
    }

    return true;
  }

  private async getNewTicketAccumulator(
    timeslot: TimeSlot,
    extrinsic: SignedTicket[],
    validators: ValidatorData[],
    entropy: EntropyHash,
  ): Promise<Result<Ticket[], SafroleErrorCode>> {
    const keys = validators
      .map((validator) => validator.bandersnatch)
      .reduce(
        (acc, item, i) => {
          acc.set(item.raw, i * 32);
          return acc;
        },
        new Uint8Array(32 * validators.length),
      );
    const verificationResult = await verifyTickets(keys, extrinsic, entropy);
    const tickets = extrinsic.map((ticket, i) => ({ attempt: ticket.attempt, id: verificationResult[i].entropyHash }));

    if (!verificationResult.every((x) => x.isValid)) {
      return Result.error(SafroleErrorCode.BadTicketProof);
    }

    if (!this.areTicketsUnique(tickets)) {
      return Result.error(SafroleErrorCode.DuplicateTicket);
    }

    if (!this.areTicketsSorted(tickets)) {
      return Result.error(SafroleErrorCode.BadTicketOrder);
    }

    if (this.isEpochChanged(timeslot)) {
      return Result.ok(tickets);
    }

    const ticketsFromState = SortedSet.fromSortedArray(ticketComparator, this.state.ticketsAccumulator);
    const ticketsFromExtrinsic = SortedSet.fromSortedArray(ticketComparator, tickets);
    const mergedTickets = SortedSet.fromTwoSortedCollections(ticketsFromState, ticketsFromExtrinsic);

    if (ticketsFromState.length + ticketsFromExtrinsic.length !== mergedTickets.length) {
      return Result.error(SafroleErrorCode.DuplicateTicket);
    }

    if (mergedTickets.length > this.chainSpec.epochLength) {
      return Result.ok(mergedTickets.array.slice(0, this.chainSpec.epochLength));
    }

    return Result.ok(mergedTickets.array);
  }

  private getTicketsMark(timeslot: TimeSlot) {
    const m = this.getPreviousSlotPhaseIndex();
    const mPrime = this.getCurrentSlotPhaseIndex(timeslot);
    if (
      this.isSameEpoch(timeslot) &&
      m < this.chainSpec.contestLength &&
      this.chainSpec.contestLength <= mPrime &&
      this.state.ticketsAccumulator.length === this.chainSpec.epochLength
    ) {
      return this.outsideInSequencer(this.state.ticketsAccumulator);
    }

    return null;
  }

  private isExitricLengthIncorrect(timeslot: TimeSlot, extrinsic: SignedTicket[]) {
    const slotPhase = this.getCurrentSlotPhaseIndex(timeslot);

    if (slotPhase < this.chainSpec.contestLength && extrinsic.length <= this.chainSpec.maxTicketsPerExtrinsic) {
      return false;
    }

    return extrinsic.length > 0;
  }

  private areTicketAttemptsIncorrect(tickets: SignedTicket[]) {
    const ticketsLength = tickets.length;
    for (let i = 0; i < ticketsLength; i++) {
      if (tickets[i].attempt < 0 || tickets[i].attempt >= this.chainSpec.ticketsPerValidator) {
        return true;
      }
    }

    return false;
  }

  async transition(input: {
    slot: TimeSlot;
    entropy: EntropyHash;
    extrinsic: SignedTicket[];
  }): Promise<Result<OkResult, SafroleErrorCode>> {
    const newState: StateDiff = {};

    if (this.state.timeslot >= input.slot) {
      return Result.error(SafroleErrorCode.BadSlot);
    }

    if (this.isExitricLengthIncorrect(input.slot, input.extrinsic)) {
      return Result.error(SafroleErrorCode.UnexpectedTicket);
    }

    if (this.areTicketAttemptsIncorrect(input.extrinsic)) {
      return Result.error(SafroleErrorCode.BadTicketAttempt);
    }

    const validatorKeysResult = await this.getValidatorKeys(input.slot);
    if (validatorKeysResult.isError) {
      return Result.error(validatorKeysResult.error);
    }
    const validatorKeys = validatorKeysResult.ok;
    newState.nextValidators = validatorKeys[0];
    newState.currValidators = validatorKeys[1];
    newState.prevValidators = validatorKeys[2];
    newState.epochRoot = validatorKeys[3];

    newState.timeslot = input.slot;
    newState.entropy = this.getEntropy(input.slot, input.entropy);
    newState.sealingKeySeries = this.getSlotSealerSeries(input.slot, validatorKeys[1], newState.entropy[2]);
    const newTicketsAccumulatoResult = await this.getNewTicketAccumulator(
      input.slot,
      input.extrinsic,
      this.state.nextValidators,
      newState.entropy[2],
    );

    if (newTicketsAccumulatoResult.isError) {
      return Result.error(newTicketsAccumulatoResult.error);
    }

    newState.ticketsAccumulator = newTicketsAccumulatoResult.ok;

    const result = Result.ok({
      epochMark: this.getEpochMark(input.slot, validatorKeys[0]),
      ticketsMark: this.getTicketsMark(input.slot),
    });

    this.applyStateChanges(newState);

    return result as Result<OkResult, SafroleErrorCode>;
  }
}
