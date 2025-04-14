import {
  type BandersnatchKey,
  type EntropyHash,
  type HeaderView,
  type PerEpochBlock,
  type PerValidator,
  type TimeSlot,
  type ValidatorIndex,
  encodeUnsealedHeader,
} from "@typeberry/block";
import type { Ticket } from "@typeberry/block/tickets";
import { BytesBlob } from "@typeberry/bytes";
import type { State, ValidatorData } from "@typeberry/state";
import { SafroleSealingKeysKind } from "@typeberry/state/safrole-data";
import { Result } from "@typeberry/utils";
import { verifySeal } from "./bandersnatch";
import { BandernsatchWasm } from "./bandersnatch-wasm";
import { JAM_ENTROPY, JAM_FALLBACK_SEAL, JAM_TICKET_SEAL } from "./constants";

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

export class SafroleSeal {
  constructor(private readonly bandersnatch: Promise<BandernsatchWasm> = BandernsatchWasm.new({ synchronous: true })) {}
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
    const entropySourceResult = await verifySeal(
      await this.bandersnatch,
      state.currentValidatorData.map((x) => x.bandersnatch),
      headerView.bandersnatchBlockAuthorIndex.materialize(),
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
    const result = await verifySeal(
      await this.bandersnatch,
      validators.map((x) => x.bandersnatch),
      validatorIndex,
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
      return Result.error(SafroleSealError.InvalidValidator);
    }

    // verify seal correctness
    const payload = BytesBlob.blobFromParts(JAM_FALLBACK_SEAL, entropy.raw);
    const result = await verifySeal(
      await this.bandersnatch,
      validators.map((x) => x.bandersnatch),
      validatorIndex,
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
