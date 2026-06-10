import { type EntropyHash, type Epoch, type TimeSlot, tryAsEpoch } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import type { Blake2b } from "@typeberry/hash";
import type { Logger } from "@typeberry/logger";
import { Safrole } from "@typeberry/safrole";
import type { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { type SafroleSealingKeys, SafroleSealingKeysKind, type State } from "@typeberry/state";
import { Result } from "@typeberry/utils";
import { EpochAuthoringSlots, type SlotSealData } from "./epoch-authoring-slots.js";
import type { ValidatorSecrets } from "./protocol.js";

/** Per-epoch data computed once when entering (or resuming into) an epoch. */
export type EpochData = {
  epoch: Epoch;
  epochLength: number;
  sealingKeySeries: SafroleSealingKeys;
  entropy: EntropyHash;
  slots: Array<SlotSealData | null>;
};

export class EpochTracker {
  static async new(
    chainSpec: ChainSpec,
    bandersnatch: BandernsatchWasm,
    blake2bHasher: Blake2b,
    keys: readonly ValidatorSecrets[],
  ) {
    const epochSlots = await EpochAuthoringSlots.new(chainSpec, bandersnatch, keys);
    return new EpochTracker(chainSpec, blake2bHasher, epochSlots);
  }

  private constructor(
    private readonly chainSpec: ChainSpec,
    private readonly blake2bHasher: Blake2b,
    public readonly authoring: EpochAuthoringSlots,
  ) {}

  isEpochChanged(stateTimeSlot: TimeSlot, newTimeSlot: TimeSlot): boolean {
    const epochLength = this.chainSpec.epochLength;
    const stateEpoch = Math.floor(stateTimeSlot / epochLength);
    const newEpoch = Math.floor(newTimeSlot / epochLength);
    return newEpoch > stateEpoch;
  }

  async getEpochData(logger: Logger, state: State, newTimeSlot: TimeSlot): Promise<Result<EpochData, string>> {
    const sealingKeySeriesResult = await this.getSealingKeySeries(state, newTimeSlot);
    // Propagate the typed failure instead of crashing — `main` decides whether to
    // retry, skip or terminate, and keeps the real error details.
    if (sealingKeySeriesResult.isError) {
      return Result.error(`${sealingKeySeriesResult.error}`, sealingKeySeriesResult.details);
    }
    const epochLength = this.chainSpec.epochLength;
    const sealingKeySeries = sealingKeySeriesResult.ok;
    // On a new epoch, `state.entropy[2]` is the epoch-E entropy (pre-transition);
    // mid-epoch, it has already shifted to `entropy[3]`. Use the same predicate
    // as `getSealingKeySeries` so the entropy and the key series stay consistent
    // even when the first authored block of an epoch isn't exactly at slot E·L.
    const isNewEpoch = this.isEpochChanged(state.timeslot, newTimeSlot);
    const entropy = isNewEpoch ? state.entropy[2] : state.entropy[3];

    const epoch = tryAsEpoch(Math.floor(newTimeSlot / epochLength));
    logger.log`[E${epoch}] is using ${SafroleSealingKeysKind[sealingKeySeries.kind]}`;
    logger.trace`[E${epoch}] ${sealingKeySeries}`;
    const slots = await this.authoring.getOurSlotsInKeySeries(sealingKeySeries, entropy);
    this.logEpochAuthorshipInfo(logger, epoch, slots);

    return Result.ok({
      epoch,
      epochLength,
      sealingKeySeries,
      entropy,
      slots,
    });
  }

  private async getSealingKeySeries(state: State, newTimeSlot: TimeSlot) {
    // in case we are not changing epoch, just use the state data
    if (!this.isEpochChanged(state.timeslot, newTimeSlot)) {
      return Result.ok(state.sealingKeySeries);
    }

    // otherwise, pick the new sealing key series already
    const safrole = new Safrole(this.chainSpec, this.blake2bHasher, state);
    return await safrole.getSealingKeySeries({
      entropy: state.entropy[1],
      slot: newTimeSlot,
      punishSet: state.disputesRecords.punishSet,
    });
  }

  private logEpochAuthorshipInfo(logger: Logger, epoch: Epoch, slots: Array<SlotSealData | null>) {
    let isCreating = false;
    let slot = epoch * this.chainSpec.epochLength;
    for (const sealData of slots) {
      if (sealData !== null) {
        isCreating = true;
        logger.info`[E${epoch}#${slot}] Validator ${sealData.key.bandersnatchPublic.toStringTruncated()} will author using ${sealData.logId}`;
      }
      slot += 1;
    }

    if (isCreating === false) {
      logger.info`[E${epoch}] No blocks to author for this epoch.`;
    }
  }
}
