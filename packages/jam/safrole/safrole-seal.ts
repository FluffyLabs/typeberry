import {
  type EntropyHash,
  encodeUnsealedHeader,
  type HeaderView,
  type PerEpochBlock,
  type PerValidator,
  type TimeSlot,
  type ValidatorIndex,
} from "@typeberry/block";
import type { Ticket } from "@typeberry/block/tickets.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { BANDERSNATCH_KEY_BYTES, type BandersnatchKey } from "@typeberry/crypto";
import type { State, ValidatorData } from "@typeberry/state";
import { SafroleSealingKeysKind } from "@typeberry/state/safrole-data.js";
import { Result } from "@typeberry/utils";
import bandersnatchVrf from "./bandersnatch-vrf.js";
import { BandernsatchWasm } from "./bandersnatch-wasm.js";
import { JAM_ENTROPY, JAM_FALLBACK_SEAL, JAM_TICKET_SEAL } from "./constants.js";

export enum SafroleSealError {
  InvalidValidatorIndex = 0,
  InvalidValidator = 1,
  InvalidTicket = 2,
  IncorrectSeal = 3,
  IncorrectEntropySource = 4,
}

export type SafroleSealState = Pick<State, "currentValidatorData" | "sealingKeySeries"> & {
  currentEntropy: EntropyHash;
};

const BANDERSNATCH_ZERO_KEY = Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque<BandersnatchKey>();

export class SafroleSeal {
  constructor(private readonly bandersnatch: Promise<BandernsatchWasm> = BandernsatchWasm.new()) {}
  /**
   * Note the verification needs to be done AFTER the state transition,
   * hence the state is passed as an argument for more control.
   */
  async verifyHeaderSeal(
    headerView: HeaderView,
    state: SafroleSealState,
  ): Promise<Result<EntropyHash, SafroleSealError>> {
    const sealResult = await this.verifySeal(headerView, state);
    if (sealResult.isError) {
      return sealResult;
    }

    // verify entropySource
    const payload = BytesBlob.blobFromParts(JAM_ENTROPY, sealResult.ok.raw);
    const blockAuthorIndex = headerView.bandersnatchBlockAuthorIndex.materialize();
    const blockAuthorKey = state.currentValidatorData.at(blockAuthorIndex)?.bandersnatch;

    const entropySourceResult = await bandersnatchVrf.verifySeal(
      await this.bandersnatch,
      blockAuthorKey ?? BANDERSNATCH_ZERO_KEY,
      headerView.entropySource.materialize(),
      payload,
      BytesBlob.blobFromNumbers([]),
    );

    if (entropySourceResult.isError) {
      return Result.error(SafroleSealError.IncorrectEntropySource);
    }

    return Result.ok(entropySourceResult.ok);
  }

  private async verifySeal(
    headerView: HeaderView,
    state: SafroleSealState,
  ): Promise<Result<EntropyHash, SafroleSealError>> {
    // we use transitioned keys already
    const validators = state.currentValidatorData;
    const validatorIndex = headerView.bandersnatchBlockAuthorIndex.materialize();

    const authorKey = validators[validatorIndex];
    if (authorKey === undefined) {
      return Result.error(SafroleSealError.InvalidValidatorIndex);
    }

    const timeSlot = headerView.timeSlotIndex.materialize();
    const sealingKeys = state.sealingKeySeries;
    const entropy = state.currentEntropy;

    if (sealingKeys.kind === SafroleSealingKeysKind.Tickets) {
      return await this.verifySealWithTicket(
        sealingKeys.tickets,
        timeSlot,
        entropy,
        validators,
        validatorIndex,
        headerView,
      );
    }

    return await this.verifySealWithKeys(
      sealingKeys.keys,
      authorKey,
      timeSlot,
      entropy,
      validators,
      validatorIndex,
      headerView,
    );
  }

  /** Regular (non-fallback) mode of Safrole. */
  async verifySealWithTicket(
    tickets: PerEpochBlock<Ticket>,
    timeSlot: TimeSlot,
    entropy: EntropyHash,
    validators: PerValidator<ValidatorData>,
    validatorIndex: ValidatorIndex,
    headerView: HeaderView,
  ): Promise<Result<EntropyHash, SafroleSealError>> {
    const index = timeSlot % tickets.length;
    const { id, attempt } = tickets[index];
    const payload = BytesBlob.blobFromParts(JAM_TICKET_SEAL, entropy.raw, new Uint8Array([attempt]));
    // verify seal correctness
    const authorKey = validators.at(validatorIndex)?.bandersnatch;
    const result = await bandersnatchVrf.verifySeal(
      await this.bandersnatch,
      authorKey ?? BANDERSNATCH_ZERO_KEY,
      headerView.seal.materialize(),
      payload,
      encodeUnsealedHeader(headerView),
    );

    if (result.isError) {
      return Result.error(SafroleSealError.IncorrectSeal);
    }

    if (!id.isEqualTo(result.ok)) {
      return Result.error(SafroleSealError.InvalidTicket);
    }

    return Result.ok(result.ok);
  }

  /** Fallback mode of Safrole. */
  async verifySealWithKeys(
    keys: PerEpochBlock<BandersnatchKey>,
    authorKey: ValidatorData,
    timeSlot: TimeSlot,
    entropy: EntropyHash,
    validators: PerValidator<ValidatorData>,
    validatorIndex: ValidatorIndex,
    headerView: HeaderView,
  ): Promise<Result<EntropyHash, SafroleSealError>> {
    const index = timeSlot % keys.length;
    const sealingKey = keys[index];
    if (!sealingKey.isEqualTo(authorKey.bandersnatch)) {
      return Result.error(
        SafroleSealError.InvalidValidator,
        `Invalid Validator. Expected: ${sealingKey}, got: ${authorKey.bandersnatch}`,
      );
    }

    // verify seal correctness
    const payload = BytesBlob.blobFromParts(JAM_FALLBACK_SEAL, entropy.raw);
    const blockAuthorKey = validators.at(validatorIndex)?.bandersnatch;
    const result = await bandersnatchVrf.verifySeal(
      await this.bandersnatch,
      blockAuthorKey ?? BANDERSNATCH_ZERO_KEY,
      headerView.seal.materialize(),
      payload,
      encodeUnsealedHeader(headerView),
    );

    if (result.isError) {
      return Result.error(SafroleSealError.IncorrectSeal);
    }

    return Result.ok(result.ok);
  }
}
