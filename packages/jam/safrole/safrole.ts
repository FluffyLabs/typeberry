import {
  type EntropyHash,
  EpochMarker,
  type EpochMarkerView,
  type PerValidator,
  TicketsMarker,
  type TicketsMarkerView,
  type TimeSlot,
  tryAsPerEpochBlock,
  tryAsTimeSlot,
  ValidatorKeys,
} from "@typeberry/block";
import type { SignedTicket, Ticket, TicketsExtrinsic } from "@typeberry/block/tickets.js";
import { Bytes, bytesBlobComparator } from "@typeberry/bytes";
import { type Codec, Decoder, type DescriptorRecord, Encoder, type ViewOf } from "@typeberry/codec";
import { asKnownSize, FixedSizeArray, type ImmutableSortedSet, SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import {
  BANDERSNATCH_KEY_BYTES,
  type BandersnatchKey,
  type BandersnatchRingRoot,
  BLS_KEY_BYTES,
  ED25519_KEY_BYTES,
  type Ed25519Key,
} from "@typeberry/crypto";
import type { Blake2b } from "@typeberry/hash";
import { tryAsU32, u32AsLeBytes } from "@typeberry/numbers";
import { type State, ValidatorData } from "@typeberry/state";
import { type SafroleSealingKeys, SafroleSealingKeysData } from "@typeberry/state/safrole-data.js";
import { asOpaqueType, OK, Result } from "@typeberry/utils";
import bandersnatchVrf from "./bandersnatch-vrf.js";
import { BandernsatchWasm } from "./bandersnatch-wasm.js";
import type { SafroleSealState } from "./safrole-seal.js";

export const VALIDATOR_META_BYTES = 128;
export type VALIDATOR_META_BYTES = typeof VALIDATOR_META_BYTES;

const ticketComparator = (a: Ticket, b: Ticket) => bytesBlobComparator(a.id, b.id);

export type SafroleState = Pick<
  State,
  | "designatedValidatorData"
  | "timeslot"
  | "previousValidatorData"
  | "currentValidatorData"
  | "nextValidatorData"
  | "entropy"
  | "ticketsAccumulator"
  | "sealingKeySeries"
  | "epochRoot"
>;

export type SafroleStateUpdate = Pick<
  SafroleState,
  | "nextValidatorData"
  | "currentValidatorData"
  | "previousValidatorData"
  | "epochRoot"
  | "timeslot"
  | "entropy"
  | "sealingKeySeries"
  | "ticketsAccumulator"
>;

export type OkResult = {
  epochMark: EpochMarker | null;
  ticketsMark: TicketsMarker | null;
  stateUpdate: SafroleStateUpdate;
};

export type Input = {
  /** Current block time slot. */
  slot: TimeSlot;
  /** Y(H_v): a high-entropy hash yielded from bandersnatch block seal. */
  entropy: EntropyHash;
  /** Current block tickets extrinsic. */
  extrinsic: TicketsExtrinsic;
  /** Punish set from disputes */
  punishSet: ImmutableSortedSet<Ed25519Key>;
  /** Epoch marker from header */
  epochMarker: EpochMarkerView | null;
  /** Tickets marker from header */
  ticketsMarker: TicketsMarkerView | null;
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
  // Epoch marker missing, unexpected or invalid
  EpochMarkerInvalid = 8,
  // Tickets marker missing, unexpected or invalid
  TicketsMarkerInvalid = 9,
}

type EpochValidators = Pick<
  SafroleState,
  "nextValidatorData" | "currentValidatorData" | "previousValidatorData" | "epochRoot"
>;

export class Safrole {
  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly blake2b: Blake2b,
    public readonly state: SafroleState,
    private readonly bandersnatch: Promise<BandernsatchWasm> = BandernsatchWasm.new(),
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
    const newRandomnessAcc = this.blake2b.hashBlobs([randomnessAcc.raw, entropyHash]).asOpaque();

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

  /**
   * Pre-populate cache for validator keys, and especially the ring commitment.
   *
   * NOTE the function is still doing quite some work, so it should only be used
   *  once per epoch. The optimisation relies on the fact that the `bandersnatch.getRingCommitment`
   * call will be cached.
   */
  public async prepareValidatorKeysForNextEpoch(postOffenders: ImmutableSortedSet<Ed25519Key>) {
    const stateEpoch = Math.floor(this.state.timeslot / this.chainSpec.epochLength);
    const nextEpochStart = (stateEpoch + 1) * this.chainSpec.epochLength;
    return await this.getValidatorKeys(tryAsTimeSlot(nextEpochStart), postOffenders);
  }

  private async getValidatorKeys(
    timeslot: TimeSlot,
    postOffenders: ImmutableSortedSet<Ed25519Key>,
  ): Promise<Result<EpochValidators, typeof SafroleErrorCode.IncorrectData>> {
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
    const newNextValidators: PerValidator<ValidatorData> = asOpaqueType(
      this.state.designatedValidatorData.map((validator) => {
        const isOffender = postOffenders.has(validator.ed25519) !== false;

        /**
         * Bandersnatch, ed25519 and bls keys of validators that belongs to offenders are replaced with null keys
         *
         * https://graypaper.fluffylabs.dev/#/5f542d7/0ea2000ea200
         */
        if (isOffender) {
          return ValidatorData.create({
            bandersnatch: Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
            ed25519: Bytes.zero(ED25519_KEY_BYTES).asOpaque(),
            bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
            metadata: validator.metadata,
          });
        }

        return validator;
      }),
    );

    const { nextValidatorData, currentValidatorData } = this.state;
    const epochRootResult = await bandersnatchVrf.getRingCommitment(
      await this.bandersnatch,
      newNextValidators.map((x) => x.bandersnatch),
    );

    if (epochRootResult.isOk) {
      return Result.ok({
        nextValidatorData: newNextValidators,
        currentValidatorData: nextValidatorData,
        previousValidatorData: currentValidatorData,
        epochRoot: epochRootResult.ok,
      });
    }

    return Result.error(SafroleErrorCode.IncorrectData, () => "Safrole: failed to get epoch root for validator keys");
  }

  /**
   * Ticket sequencer that is used in standard mode
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0ea7020ea702
   */
  private outsideInSequencer(tickets: readonly Ticket[]) {
    const ticketsLength = tickets.length;
    const reorderedTickets = new Array<Ticket>(ticketsLength);

    const middle = Math.floor(ticketsLength / 2);
    for (let i = 0; i < middle; i += 1) {
      reorderedTickets[2 * i] = tickets[i];
      reorderedTickets[2 * i + 1] = tickets[ticketsLength - i - 1];
    }

    // handle potential edge case for odd number of elements
    //
    // eg. ticketsLength = 7, middle = floor(7/2) = 3;
    // 2 * middle = 6, which is less than 7
    // sets reorderedTickets[2 * middle = 6], with tickets[middle = 3]
    if (2 * middle < ticketsLength) {
      reorderedTickets[2 * middle] = tickets[middle];
    }

    return TicketsMarker.create({
      tickets: tryAsPerEpochBlock(reorderedTickets, this.chainSpec),
    });
  }

  /**
   * Ticket sequencer that is used in fallback mode
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0ea7020ea702
   */
  private fallbackKeySequencer(entropy: EntropyHash, newValidators: readonly ValidatorData[]) {
    const epochLength = this.chainSpec.epochLength;
    const result: BandersnatchKey[] = [];
    const validatorsCount = newValidators.length;
    for (let i = tryAsU32(0); i < epochLength; i++) {
      const iAsBytes = u32AsLeBytes(i);
      const bytes = this.blake2b.hashBlobs([entropy.raw, iAsBytes]).raw;
      const decoder = Decoder.fromBlob(bytes);
      const validatorIndex = decoder.u32() % validatorsCount;
      result.push(newValidators[validatorIndex].bandersnatch);
    }

    return tryAsPerEpochBlock(result, this.chainSpec);
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
  private getSlotKeySequence(
    timeslot: TimeSlot,
    newValidators: readonly ValidatorData[],
    newEntropy: EntropyHash,
  ): SafroleSealingKeys {
    const m = this.getSlotPhaseIndex(this.state.timeslot);
    if (
      this.isNextEpoch(timeslot) &&
      m >= this.chainSpec.contestLength &&
      this.state.ticketsAccumulator.length === this.chainSpec.epochLength
    ) {
      return SafroleSealingKeysData.tickets(this.outsideInSequencer(this.state.ticketsAccumulator).tickets);
    }

    if (this.isSameEpoch(timeslot)) {
      return this.state.sealingKeySeries;
    }

    // TODO [MaSi]: the result of fallback sequencer should be cached
    return SafroleSealingKeysData.keys(this.fallbackKeySequencer(newEntropy, newValidators));
  }

  /**
   * Returns epoch markers if the epoch is changed and null otherwise
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0e6e030e6e03
   */
  private getEpochMark(timeslot: TimeSlot, nextValidators: PerValidator<ValidatorData>): EpochMarker | null {
    if (!this.isEpochChanged(timeslot)) {
      return null;
    }

    const entropy = this.state.entropy;
    return EpochMarker.create({
      entropy: entropy[0],
      ticketsEntropy: entropy[1],
      validators: asKnownSize(nextValidators.map((validator) => ValidatorKeys.create(validator))),
    });
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
      if (order.isEqual()) {
        return Result.error(SafroleErrorCode.DuplicateTicket, () => `Safrole: duplicate ticket found at index ${i}`);
      }

      if (order.isGreater()) {
        return Result.error(SafroleErrorCode.BadTicketOrder, () => `Safrole: bad ticket order at index ${i}`);
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
    extrinsic: readonly SignedTicket[],
    validators: readonly ValidatorData[],
    epochRoot: BandersnatchRingRoot,
    entropy: EntropyHash,
  ): Promise<Result<Ticket[], SafroleErrorCode>> {
    /**
     * Verify ticket proof of validity
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/0f59000f5900
     */
    // TODO [ToDr] Verify that ticket attempt is in correct range.
    const verificationResult =
      extrinsic.length === 0
        ? []
        : await bandersnatchVrf.verifyTickets(
            await this.bandersnatch,
            validators.length,
            epochRoot,
            extrinsic,
            entropy,
          );

    const tickets: Ticket[] = extrinsic.map((ticket, i) => ({
      id: verificationResult[i].entropyHash,
      attempt: ticket.attempt,
    }));

    if (!verificationResult.every((x) => x.isValid)) {
      return Result.error(SafroleErrorCode.BadTicketProof, () => "Safrole: invalid ticket proof in extrinsic");
    }

    /**
     * Verify if tickets are sorted and unique
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/0fe4000fe400
     */
    const ticketsVerifcationResult = this.verifyTickets(tickets);
    if (ticketsVerifcationResult.isError) {
      return Result.error(ticketsVerifcationResult.error, ticketsVerifcationResult.details);
    }

    if (this.isEpochChanged(timeslot)) {
      return Result.ok(tickets);
    }

    const ticketsFromState = SortedSet.fromSortedArray(ticketComparator, this.state.ticketsAccumulator);
    const ticketsFromExtrinsic = SortedSet.fromSortedArray(ticketComparator, tickets);
    const mergedTickets = SortedSet.fromTwoSortedCollections(ticketsFromState, ticketsFromExtrinsic);

    if (ticketsFromState.length + ticketsFromExtrinsic.length !== mergedTickets.length) {
      return Result.error(
        SafroleErrorCode.DuplicateTicket,
        () => "Safrole: duplicate ticket when merging state and extrinsic tickets",
      );
    }

    /**
     * Remove tickets if size of accumulator exceeds E (epoch length).
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/0f89010f8901
     */
    return Result.ok(mergedTickets.array.slice(0, this.chainSpec.epochLength));
  }

  private shouldIncludeTicketsMarker(timeslot: TimeSlot): boolean {
    const m = this.getSlotPhaseIndex(this.state.timeslot);
    const mPrime = this.getSlotPhaseIndex(timeslot);
    return (
      this.isSameEpoch(timeslot) &&
      m < this.chainSpec.contestLength &&
      this.chainSpec.contestLength <= mPrime &&
      this.state.ticketsAccumulator.length === this.chainSpec.epochLength
    );
  }

  /**
   * Returns winning-tickets markers if the block is the first after the end of the submission period
   * for tickets and if the ticket accumulator is saturated and null otherwise
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0ea0030ea003
   */
  private getTicketsMarker(timeslot: TimeSlot): TicketsMarker | null {
    if (this.shouldIncludeTicketsMarker(timeslot)) {
      return this.outsideInSequencer(this.state.ticketsAccumulator);
    }

    return null;
  }

  /**
   * Verify correctness of the ticket extrinsic length.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0f83000f8300
   */
  private isExtrinsicLengthValid(timeslot: TimeSlot, extrinsic: readonly SignedTicket[]) {
    const slotPhase = this.getSlotPhaseIndex(timeslot);

    if (slotPhase < this.chainSpec.contestLength) {
      return extrinsic.length <= this.chainSpec.maxTicketsPerExtrinsic;
    }

    return extrinsic.length === 0;
  }

  /**
   * Verify if attempt values are correct
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/0f23000f2400
   */
  private areTicketAttemptsValid(tickets: readonly SignedTicket[]) {
    const ticketsLength = tickets.length;
    for (let i = 0; i < ticketsLength; i++) {
      if (tickets[i].attempt >= this.chainSpec.ticketsPerValidator) {
        return false;
      }
    }

    return true;
  }

  getSafroleSealState(timeslot: TimeSlot): SafroleSealState {
    const isFirstInNewEpoch = this.isEpochChanged(timeslot);
    const currentValidatorData = isFirstInNewEpoch ? this.state.nextValidatorData : this.state.currentValidatorData;
    const newEntropy = this.state.entropy[isFirstInNewEpoch ? 1 : 2];
    const currentEntropy = this.state.entropy[isFirstInNewEpoch ? 2 : 3];
    const sealingKeySeries = this.getSlotKeySequence(timeslot, currentValidatorData, newEntropy);

    return {
      currentValidatorData,
      currentEntropy,
      sealingKeySeries,
    };
  }

  async getSealingKeySeries(input: Omit<Input, "epochMarker" | "ticketsMarker" | "extrinsic">) {
    const validatorKeysResult = await this.getValidatorKeys(input.slot, input.punishSet);
    if (validatorKeysResult.isError) {
      return Result.error(validatorKeysResult.error, validatorKeysResult.details);
    }
    const { currentValidatorData } = validatorKeysResult.ok;
    return Result.ok(this.getSlotKeySequence(input.slot, currentValidatorData, input.entropy));
  }

  async blockAuthorshipTransition(
    input: Omit<Input, "epochMarker" | "ticketsMarker">,
  ): Promise<Result<Omit<OkResult, "stateUpdate"> & { sealingKeySeries: SafroleSealingKeys }, SafroleErrorCode>> {
    const validatorKeysResult = await this.getValidatorKeys(input.slot, input.punishSet);

    if (validatorKeysResult.isError) {
      return Result.error(validatorKeysResult.error, validatorKeysResult.details);
    }
    const { currentValidatorData } = validatorKeysResult.ok;
    const entropy = this.getEntropy(input.slot, input.entropy);
    const sealingKeySeries = this.getSlotKeySequence(input.slot, currentValidatorData, entropy[2]);

    const epochMark = this.getEpochMark(input.slot, validatorKeysResult.ok.nextValidatorData);
    const ticketsMark = this.getTicketsMarker(input.slot);
    return Result.ok({ epochMark, ticketsMark, sealingKeySeries });
  }

  async transition(input: Input): Promise<Result<OkResult, SafroleErrorCode>> {
    if (this.state.timeslot >= input.slot) {
      return Result.error(
        SafroleErrorCode.BadSlot,
        () => `Safrole: bad slot, state timeslot ${this.state.timeslot} >= input slot ${input.slot}`,
      );
    }

    if (!this.isExtrinsicLengthValid(input.slot, input.extrinsic)) {
      return Result.error(
        SafroleErrorCode.UnexpectedTicket,
        () => `Safrole: unexpected ticket, invalid extrinsic length ${input.extrinsic.length}`,
      );
    }

    if (!this.areTicketAttemptsValid(input.extrinsic)) {
      return Result.error(SafroleErrorCode.BadTicketAttempt, () => "Safrole: bad ticket attempt value in extrinsic");
    }

    const validatorKeysResult = await this.getValidatorKeys(input.slot, input.punishSet);

    if (validatorKeysResult.isError) {
      return Result.error(validatorKeysResult.error, validatorKeysResult.details);
    }

    const { nextValidatorData, currentValidatorData, previousValidatorData, epochRoot } = validatorKeysResult.ok;
    const entropy = this.getEntropy(input.slot, input.entropy);
    const sealingKeySeries = this.getSlotKeySequence(input.slot, currentValidatorData, entropy[2]);
    const newTicketsAccumulatorResult = await this.getNewTicketAccumulator(
      input.slot,
      input.extrinsic,
      this.state.nextValidatorData,
      epochRoot,
      entropy[2],
    );

    if (newTicketsAccumulatorResult.isError) {
      return Result.error(newTicketsAccumulatorResult.error, newTicketsAccumulatorResult.details);
    }

    const stateUpdate = {
      nextValidatorData,
      currentValidatorData,
      previousValidatorData,
      epochRoot,
      timeslot: input.slot,
      entropy,
      sealingKeySeries,
      ticketsAccumulator: asKnownSize(newTicketsAccumulatorResult.ok),
    };

    const epochMarker = this.getEpochMark(input.slot, nextValidatorData);
    const epochMarkerRes = compareWithEncoding(
      this.chainSpec,
      SafroleErrorCode.EpochMarkerInvalid,
      epochMarker,
      input.epochMarker,
      EpochMarker.Codec,
    );

    if (epochMarkerRes.isError) {
      return epochMarkerRes;
    }

    const ticketsMarker = this.getTicketsMarker(input.slot);
    const ticketsMarkerRes = compareWithEncoding(
      this.chainSpec,
      SafroleErrorCode.TicketsMarkerInvalid,
      ticketsMarker,
      input.ticketsMarker,
      TicketsMarker.Codec,
    );
    if (ticketsMarkerRes.isError) {
      return ticketsMarkerRes;
    }

    const result = {
      epochMark: epochMarker,
      ticketsMark: ticketsMarker,
      stateUpdate,
    };

    return Result.ok(result);
  }
}

function compareWithEncoding<T, D extends DescriptorRecord<T>>(
  chainSpec: ChainSpec,
  error: SafroleErrorCode,
  actual: T | null,
  expected: ViewOf<T, D> | null,
  codec: Codec<T>,
): Result<OK, SafroleErrorCode> {
  if (actual === null || expected === null) {
    // if one of them is `null`, both need to be.
    if (actual !== expected) {
      return Result.error(error, () => `${SafroleErrorCode[error]} Expected: ${expected}, got: ${actual}`);
    }
    return Result.ok(OK);
  }

  // compare the literal encoding.
  const encoded = Encoder.encodeObject(codec, actual, chainSpec);
  if (!encoded.isEqualTo(expected.encoded())) {
    return Result.error(error, () => `${SafroleErrorCode[error]} Expected: ${expected.encoded()}, got: ${encoded}`);
  }

  return Result.ok(OK);
}
