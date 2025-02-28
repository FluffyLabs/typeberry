import {
  BANDERSNATCH_KEY_BYTES,
  type BandersnatchKey,
  ED25519_KEY_BYTES,
  type EntropyHash,
  type PerValidator,
  type TimeSlot,
} from "@typeberry/block";
import type { SignedTicket, Ticket } from "@typeberry/block/tickets";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { FixedSizeArray, SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { blake2b } from "@typeberry/hash";
import { i32AsLittleEndian } from "@typeberry/numbers";
import { Ordering } from "@typeberry/ordering";
import { type State, ValidatorData } from "@typeberry/state";
import { Result, asOpaqueType } from "@typeberry/utils";
import { getRingCommitment, verifyTickets } from "./bandersnatch";

export const VALIDATOR_META_BYTES = 128;
export type VALIDATOR_META_BYTES = typeof VALIDATOR_META_BYTES;

const ticketComparator = (a: Ticket, b: Ticket) => {
  return a.id.compare(b.id);
};

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

type MutablePick<T, K extends keyof T> = Mutable<Pick<T, K>>;

export type SafroleState = Pick<State, "designatedValidatorData"> &
  Pick<State["disputesRecords"], "punishSet"> &
  MutablePick<
    State,
    | "timeslot"
    | "previousValidatorData"
    | "currentValidatorData"
    | "nextValidatorData"
    | "entropy"
    | "ticketsAccumulator"
    | "sealingKeySeries"
    | "epochRoot"
  >;

export type StateDiff = Partial<SafroleState>;

export class EpochMark {
  constructor(
    public entropy: EntropyHash,
    public ticketsEntropy: EntropyHash,
    public validators: BandersnatchKey[],
  ) {}
}

type TicketMark = {
  id: Bytes<32>;
  attempt: number;
};

type TicketsMark = TicketMark[];

export type OkResult = {
  epochMark: EpochMark | null;
  ticketsMark: TicketsMark | null;
};

export type Input = {
  slot: TimeSlot;
  entropy: EntropyHash;
  extrinsic: SignedTicket[];
};

export enum SafroleErrorCode {
  IncorrectData = 1,
  // Timeslot value must be strictly monotonic.
  BadSlot = 2,
  // Received a ticket while in epoch's tail.
  UnexpectedTicket = 3,
  // Tickets must be sorted.
  BadTicketOrder = 4,
  // Invalid ticket ring proof.
  BadTicketProof = 5,
  // Invalid ticket attempt value.
  BadTicketAttempt = 6,
  // Found a ticket duplicate.
  DuplicateTicket = 7,
}

type ValidatorKeys = Pick<
  SafroleState,
  "nextValidatorData" | "currentValidatorData" | "previousValidatorData" | "epochRoot"
>;

export class Safrole {
  constructor(
    public state: SafroleState,
    private chainSpec: ChainSpec,
  ) {}

  /** `e' > e` */
  private isEpochChanged(timeslot: TimeSlot): boolean {
    const stateEpoch = Math.floor(this.state.timeslot / this.chainSpec.epochLength);
    const blockEpoch = Math.floor(timeslot / this.chainSpec.epochLength);
    return blockEpoch > stateEpoch;
  }

  /** `e' === e` */
  private isSameEpoch(timeslot: TimeSlot): boolean {
    const stateEpoch = Math.floor(this.state.timeslot / this.chainSpec.epochLength);
    const blockEpoch = Math.floor(timeslot / this.chainSpec.epochLength);
    return blockEpoch === stateEpoch;
  }

  /** `e' === e + 1` */
  private isNextEpoch(timeslot: TimeSlot): boolean {
    const stateEpoch = Math.floor(this.state.timeslot / this.chainSpec.epochLength);
    const blockEpoch = Math.floor(timeslot / this.chainSpec.epochLength);
    return blockEpoch === stateEpoch + 1;
  }

  /**
   * Returns slot phase index for given timeslot
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0d87000d8700
   */
  private getSlotPhaseIndex(timeslot: TimeSlot) {
    return timeslot % this.chainSpec.epochLength;
  }

  private getEntropy(timeslot: TimeSlot, entropyHash: EntropyHash): SafroleState["entropy"] {
    const [randomnessAcc, ...rest] = this.state.entropy;

    /**
     * Randomness accumulator - η′ from GP
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/0e17020e1702
     */
    const newRandomnessAcc = blake2b.hashBlobs([randomnessAcc.raw, entropyHash]).asOpaque();

    /**
     * Randomness history is shifted when epoch is changed
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/0e57020e5702
     */

    if (this.isEpochChanged(timeslot)) {
      return FixedSizeArray.new([newRandomnessAcc, randomnessAcc, rest[0], rest[1]], 4);
    }

    return FixedSizeArray.new([newRandomnessAcc, ...rest], 4);
  }

  private async getValidatorKeys(
    timeslot: TimeSlot,
  ): Promise<Result<ValidatorKeys, typeof SafroleErrorCode.IncorrectData>> {
    /**
     * Epoch is not changed so the previous state is returned
     */
    if (!this.isEpochChanged(timeslot)) {
      const { nextValidatorData, currentValidatorData, previousValidatorData, epochRoot } = this.state;
      return Result.ok({ nextValidatorData, currentValidatorData, previousValidatorData, epochRoot });
    }

    /**
     * Epoch is changed so we shift validators and calculate new epoch root commitment
     */
    const postOffenders = this.state.punishSet;
    const newNextValidators: PerValidator<ValidatorData> = asOpaqueType(
      this.state.designatedValidatorData.map((validator) => {
        const isOffender = !!postOffenders.has(validator.ed25519);

        /**
         * Bandersnatch & ed25519 keys of validators that belongs to offenders are replaced with null keys
         *
         * https://graypaper.fluffylabs.dev/#/5f542d7/0ea2000ea200
         */
        if (isOffender) {
          return new ValidatorData(
            Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
            Bytes.zero(ED25519_KEY_BYTES).asOpaque(),
            validator.bls,
            validator.metadata,
          );
        }

        return validator;
      }),
    );

    const { nextValidatorData, currentValidatorData } = this.state;

    const keys = BytesBlob.blobFromParts(newNextValidators.map((x) => x.bandersnatch.raw)).raw;

    const epochRootResult = await getRingCommitment(keys);

    if (epochRootResult.isOk) {
      return Result.ok({
        nextValidatorData: newNextValidators,
        currentValidatorData: nextValidatorData,
        previousValidatorData: currentValidatorData,
        epochRoot: epochRootResult.ok,
      });
    }

    return Result.error(SafroleErrorCode.IncorrectData);
  }

  /**
   * Ticket sequencer that is used in standard mode
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0ea7020ea702
   */
  private outsideInSequencer(tickets: Ticket[]) {
    const ticketsLength = tickets.length;
    const reorderedTickets = new Array<Ticket>(ticketsLength);

    const middle = Math.floor(ticketsLength / 2);
    if (ticketsLength % 2 === 1) {
      reorderedTickets[middle] = tickets[middle];
    }

    for (let i = 0; i < middle; i += 1) {
      reorderedTickets[2 * i] = tickets[i];
      reorderedTickets[2 * i + 1] = tickets[ticketsLength - i - 1];
    }

    return reorderedTickets;
  }

  /**
   * Ticket sequencer that is used in fallback mode
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0ea7020ea702
   */
  private fallbackKeySequencer(entropy: EntropyHash, newValidators: ValidatorData[]) {
    const epochLength = this.chainSpec.epochLength;
    const result: BandersnatchKey[] = [];
    const validatorsCount = newValidators.length;
    for (let i = 0; i < epochLength; i++) {
      const iAsBytes = i32AsLittleEndian(i);
      const bytes = blake2b.hashBlobs([entropy.raw, iAsBytes]).raw;
      const decoder = Decoder.fromBlob(bytes);
      const validatorIndex = decoder.u32() % validatorsCount;
      result.push(newValidators[validatorIndex].bandersnatch);
    }

    return result;
  }

  /**
   * Returns a new slot sealer series that can consist of tickets or keys.
   * In might return 1 of 3 results depends on circumstances:
   * 1. reordered tickets accumulator in case of a new epoch
   * 2. previous state in case of the same epoch
   * 3. fallback keys sequence otherwise
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0ea2020ea202
   */
  private getSlotKeySequence(timeslot: TimeSlot, newValidators: ValidatorData[], newEntropy: EntropyHash) {
    const m = this.getSlotPhaseIndex(this.state.timeslot);
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
      // TODO [MaSi]: the result of fallback sequencer should be cached
      keys: this.fallbackKeySequencer(newEntropy, newValidators),
    };
  }

  /**
   * Apply the state changes
   */
  private applyStateChanges(diff: StateDiff): void {
    this.state = Object.assign(this.state, diff);
  }

  /**
   * Returns epoch markers if the epoch is changed and null otherwise
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0e6e030e6e03
   */
  private getEpochMark(timeslot: TimeSlot, nextValidators: ValidatorData[]): EpochMark | null {
    if (!this.isEpochChanged(timeslot)) {
      return null;
    }

    const entropy = this.state.entropy;
    return new EpochMark(
      entropy[0],
      entropy[1],
      nextValidators.map((validator) => validator.bandersnatch),
    );
  }

  /**
   * Verify if tickets array has no duplicates and is sorted by id
   */
  private verifyTickets(
    tickets: Ticket[],
  ): Result<null, SafroleErrorCode.BadTicketOrder | SafroleErrorCode.DuplicateTicket> {
    const ticketsLength = tickets.length;

    for (let i = 1; i < ticketsLength; i++) {
      const order = tickets[i - 1].id.compare(tickets[i].id);
      if (order === Ordering.Equal) {
        return Result.error(SafroleErrorCode.DuplicateTicket);
      }

      if (order === Ordering.Greater) {
        return Result.error(SafroleErrorCode.BadTicketOrder);
      }
    }

    return Result.ok(null);
  }

  /**
   * Returns a new tickets accumulator.
   * If the epoch is not changed, it extends the accumulator with tickets from the extrinsic.
   * Otherwise, returns a new accumulator consisting only of tickets from the extrinsic.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0f03010f0301
   */
  private async getNewTicketAccumulator(
    timeslot: TimeSlot,
    extrinsic: SignedTicket[],
    validators: ValidatorData[],
    entropy: EntropyHash,
  ): Promise<Result<Ticket[], SafroleErrorCode>> {
    const keys = BytesBlob.blobFromParts(validators.map((x) => x.bandersnatch.raw)).raw;

    /**
     * Verify ticket proof of validity
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/0f59000f5900
     */
    const verificationResult = await verifyTickets(keys, extrinsic, entropy);
    const tickets: Ticket[] = extrinsic.map((ticket, i) => ({
      id: verificationResult[i].entropyHash,
      attempt: ticket.attempt,
    }));

    if (!verificationResult.every((x) => x.isValid)) {
      return Result.error(SafroleErrorCode.BadTicketProof);
    }

    /**
     * Verify if tickets are sorted and unique
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/0fe4000fe400
     */

    const ticketsVerifcationResult = this.verifyTickets(tickets);
    if (ticketsVerifcationResult.isError) {
      return Result.error(ticketsVerifcationResult.error);
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

    /**
     * Remove tickets if size of accumulator exceeds E (epoch length).
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/0f89010f8901
     */
    return Result.ok(mergedTickets.array.slice(0, this.chainSpec.epochLength));
  }

  /**
   * Returns winning-tickets markers if the block is the first after the end of the submission period
   * for tickets and if the ticket accumulator is saturated and null otherwise
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0ea0030ea003
   */
  private getTicketsMark(timeslot: TimeSlot): TicketsMark | null {
    const m = this.getSlotPhaseIndex(this.state.timeslot);
    const mPrime = this.getSlotPhaseIndex(timeslot);
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

  /**
   * Verify correctness of the ticket extrinsic length.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0f83000f8300
   */
  private isExtrinsicLengthValid(timeslot: TimeSlot, extrinsic: SignedTicket[]) {
    const slotPhase = this.getSlotPhaseIndex(timeslot);

    if (slotPhase < this.chainSpec.contestLength && extrinsic.length <= this.chainSpec.maxTicketsPerExtrinsic) {
      return true;
    }

    return extrinsic.length === 0;
  }

  /**
   * Verify if attempt values are correct
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0f23000f2400
   */
  private areTicketAttemptsValid(tickets: SignedTicket[]) {
    const ticketsLength = tickets.length;
    for (let i = 0; i < ticketsLength; i++) {
      if (tickets[i].attempt < 0 || tickets[i].attempt >= this.chainSpec.ticketsPerValidator) {
        return false;
      }
    }

    return true;
  }

  async transition(input: Input): Promise<Result<OkResult, SafroleErrorCode>> {
    const newState: StateDiff = {};

    if (this.state.timeslot >= input.slot) {
      return Result.error(SafroleErrorCode.BadSlot);
    }

    if (!this.isExtrinsicLengthValid(input.slot, input.extrinsic)) {
      return Result.error(SafroleErrorCode.UnexpectedTicket);
    }

    if (!this.areTicketAttemptsValid(input.extrinsic)) {
      return Result.error(SafroleErrorCode.BadTicketAttempt);
    }

    const validatorKeysResult = await this.getValidatorKeys(input.slot);

    if (validatorKeysResult.isError) {
      return Result.error(validatorKeysResult.error);
    }

    const { nextValidatorData, currentValidatorData, previousValidatorData, epochRoot } = validatorKeysResult.ok;
    newState.nextValidatorData = nextValidatorData;
    newState.currentValidatorData = currentValidatorData;
    newState.previousValidatorData = previousValidatorData;
    newState.epochRoot = epochRoot;
    newState.timeslot = input.slot;
    newState.entropy = this.getEntropy(input.slot, input.entropy);

    newState.sealingKeySeries = this.getSlotKeySequence(input.slot, currentValidatorData, newState.entropy[2]);
    const newTicketsAccumulatorResult = await this.getNewTicketAccumulator(
      input.slot,
      input.extrinsic,
      this.state.nextValidatorData,
      newState.entropy[2],
    );

    if (newTicketsAccumulatorResult.isError) {
      return Result.error(newTicketsAccumulatorResult.error);
    }

    newState.ticketsAccumulator = newTicketsAccumulatorResult.ok;

    const result = {
      epochMark: this.getEpochMark(input.slot, nextValidatorData),
      ticketsMark: this.getTicketsMark(input.slot),
    };

    this.applyStateChanges(newState);

    return Result.ok(result);
  }
}
