import { type EntropyHash, type HeaderView, encodeUnsealedHeader } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import type { State } from "@typeberry/state";
import { SafroleSealingKeysKind } from "@typeberry/state/safrole-data";
import { Result } from "@typeberry/utils";
import { verifySeal } from "./bandersnatch";

/** `X_E`: https://graypaper.fluffylabs.dev/#/68eaa1f/0e90010e9001?v=0.6.4 */
const JAM_ENTROPY = BytesBlob.blobFromString("jam_entropy").raw;
/** `X_F`: https://graypaper.fluffylabs.dev/#/68eaa1f/0ea5010ea501?v=0.6.4 */
const JAM_FALLBACK_SEAL = BytesBlob.blobFromString("jam_fallback_seal").raw;
/** `X_T`: https://graypaper.fluffylabs.dev/#/68eaa1f/0ebc010ebc01?v=0.6.4 */
const JAM_TICKET_SEAL = BytesBlob.blobFromString("jam_ticket_seal").raw;

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

    // TODO [ToDr] This kind of validation of `validatorIndex` could be done earlier?
    const authorKey = validators[validatorIndex];
    if (authorKey === undefined) {
      return Result.error(SafroleSealError.InvalidValidatorIndex);
    }

    const timeSlot = headerView.timeSlotIndex.materialize();
    const sealingKeys = state.sealingKeySeries;
    const entropy = state.currentEntropy;

    if (sealingKeys.kind === SafroleSealingKeysKind.Tickets) {
      const index = timeSlot % sealingKeys.tickets.length;
      const { id, attempt } = sealingKeys.tickets[index];
      const payload = BytesBlob.blobFromParts(JAM_TICKET_SEAL, entropy.raw, new Uint8Array([attempt]));
      // verify seal correctness
      const result = await verifySeal(
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

    // Fallback mode
    const index = timeSlot % sealingKeys.keys.length;
    const sealingKey = sealingKeys.keys[index];
    if (!sealingKey.isEqualTo(authorKey.bandersnatch)) {
      return Result.error(SafroleSealError.InvalidValidator);
    }

    // verify seal correctness
    const payload = BytesBlob.blobFromParts(JAM_FALLBACK_SEAL, entropy.raw);
    const result = await verifySeal(
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
