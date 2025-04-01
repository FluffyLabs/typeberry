import { BandersnatchKey, encodeUnsealedHeader, HeaderView, TimeSlot, type BlockView, type EntropyHash, type HeaderHash } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { Result, WithOpaque } from "@typeberry/utils";
import type { TransitionHasher } from "./hasher";
import {verifySeal} from "@typeberry/safrole";
import { State } from "@typeberry/state";
import {SafroleSealingKeys, SafroleSealingKeysKind} from "@typeberry/state/safrole-data";
import {Ticket} from "@typeberry/block/tickets";

export enum BlockVerifierError {
  InvalidValidatorIndex,
  InvalidValidator,
  InvalidTicket,
  IncorrectSeal,
  IncorrectEntropySource,
}

export type Output = {
  headerHash: HeaderHash;
  entropy: EntropyHash;
};

export type VerifierState = Pick<
  State,
  "sealingKeySeries" | "currentValidatorData" | "entropy"
>;

/** `X_E`: https://graypaper.fluffylabs.dev/#/68eaa1f/0e90010e9001?v=0.6.4 */
const JAM_ENTROPY = BytesBlob.blobFromString("$jam_entropy");
/** `X_F`: https://graypaper.fluffylabs.dev/#/68eaa1f/0ea5010ea501?v=0.6.4 */
const JAM_FALLBACK_SEAL = BytesBlob.blobFromString("$jam_fallback_seal");
/** `X_T`: https://graypaper.fluffylabs.dev/#/68eaa1f/0ebc010ebc01?v=0.6.4 */
const JAM_TICKET_SEAL = BytesBlob.blobFromString("$jam_ticket_seal");

export class BlockVerifier {
  constructor(public readonly hasher: TransitionHasher) {}

  async verifyBlock(
    block: BlockView,
    state: VerifierState,
  ): Promise<Result<Output, BlockVerifierError>> {
    // TODO [ToDr] verify according to GP:
    // - parent exists,
    // - time slot index consecutive,
    // - seal valid,
    // - state root valid, etc
    const headerView = block.header.view();
    const headerHash = this.hasher.header(headerView);

    const sealResult = await this.verifySeal(headerView, state);
    if (sealResult.isError) {
      return sealResult;
    }

    // verify entropySource
    const payload = BytesBlob.blobFromParts(JAM_ENTROPY.raw, sealResult.ok.raw);
    const entropySourceResult = await verifySeal(
      state.currentValidatorData.map(x => x.bandersnatch),
      headerView.bandersnatchBlockAuthorIndex.materialize(),
      headerView.entropySource.materialize(),
      payload,
      BytesBlob.blobFromNumbers([]),
    );

    if (entropySourceResult.isError) {
      return Result.error(BlockVerifierError.IncorrectEntropySource);
    }

    return Result.ok({
      headerHash: headerHash.hash,
      entropy: entropySourceResult.ok
    });
  }


  async verifySeal(
    headerView: HeaderView,
    state: VerifierState,
  ): Promise<Result<EntropyHash, BlockVerifierError>> {
    const validators = state.currentValidatorData;
    const validatorIndex = headerView.bandersnatchBlockAuthorIndex.materialize();
    const authorKey = validators[validatorIndex];
    if (authorKey === undefined) {
      return Result.error(BlockVerifierError.InvalidValidatorIndex);
    }

    const sealingKey = this.getSealingKey(
      state.sealingKeySeries,
      headerView.timeSlotIndex.materialize()
    );

    const entropy = state.entropy[3];

    if (sealingKey.kind === SafroleSealingKeysKind.Tickets) {
      const { id, attempt } = sealingKey.ticket;
      const payload = BytesBlob.blobFromParts(JAM_TICKET_SEAL.raw, entropy.raw, new Uint8Array([attempt]))
      // verify seal correctness
      const result = await verifySeal(
        validators.map(x => x.bandersnatch),
        validatorIndex,
        headerView.seal.materialize(),
        payload,
        encodeUnsealedHeader(headerView)
      );

      if (result.isError) {
        return Result.error(BlockVerifierError.IncorrectSeal);
      }

      if (!id.isEqualTo(result.ok)) {
        return Result.error(BlockVerifierError.InvalidTicket);
      }

      return Result.ok(result.ok);
    }

    // Fallback mode
    const payload = BytesBlob.blobFromParts(JAM_FALLBACK_SEAL.raw, entropy.raw);
    if (!sealingKey.key.isEqualTo(authorKey.bandersnatch)) {
      return Result.error(BlockVerifierError.InvalidValidator);
    }

    // verify seal correctness
    const result = await verifySeal(
      validators.map(x => x.bandersnatch),
      validatorIndex,
      headerView.seal.materialize(),
      payload,
      encodeUnsealedHeader(headerView)
    );

    if (result.isError) {
      return Result.error(BlockVerifierError.IncorrectSeal);
    }

    return Result.ok(result.ok);
  }

  getSealingKey(
    sealingKeySeries: SafroleSealingKeys,
    timeSlot: TimeSlot
  ): { kind: SafroleSealingKeysKind.Keys, key: BandersnatchKey } | { kind: SafroleSealingKeysKind.Tickets, ticket: Ticket } {
    if (sealingKeySeries.kind === SafroleSealingKeysKind.Keys) {
      const index = timeSlot % sealingKeySeries.keys.length;
      return {
        kind: SafroleSealingKeysKind.Keys,
        key: sealingKeySeries.keys[index],
      };
    }

    const index = timeSlot % sealingKeySeries.tickets.length;
    return {
      kind: SafroleSealingKeysKind.Tickets,
      ticket: sealingKeySeries.tickets[index],
    };
  }
}
