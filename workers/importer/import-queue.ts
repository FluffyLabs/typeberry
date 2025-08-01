import {
  type BlockView,
  type EntropyHash,
  type Epoch,
  type HeaderHash,
  type TimeSlot,
  tryAsEpoch,
} from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { HashSet, SortedArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { WithHash, blake2b } from "@typeberry/hash";
import { Ordering } from "@typeberry/ordering";
import { OK, Result } from "@typeberry/utils";
import type { Importer } from "./importer.js";

export type ImportingQueueEntry = {
  headerHash: HeaderHash;
  timeSlot: TimeSlot;
  block: BlockView;
  seal: Promise<EntropyHash | null>;
};

export class ImportQueue {
  private readonly toImport: SortedArray<ImportingQueueEntry> = SortedArray.fromSortedArray((a, b) => {
    const diff = a.timeSlot - b.timeSlot;
    if (diff < 0) {
      return Ordering.Greater;
    }
    if (diff > 0) {
      return Ordering.Less;
    }
    return Ordering.Equal;
  });
  private readonly queuedBlocks: HashSet<HeaderHash> = HashSet.new();

  private lastEpoch: Epoch = tryAsEpoch(2 ** 32 - 1);

  constructor(
    private readonly spec: ChainSpec,
    private readonly importer: Importer,
  ) {}

  private isCurrentEpoch(timeSlot: TimeSlot) {
    const epoch = Math.floor(timeSlot / this.spec.epochLength);
    return this.lastEpoch === epoch;
  }

  private startPreverification() {
    for (const entry of this.toImport) {
      if (this.isCurrentEpoch(entry.timeSlot)) {
        entry.seal = this.importer.preverifySeal(entry.timeSlot, entry.block);
      }
    }
  }

  static getBlockDetails(
    block: BlockView,
  ): Result<WithHash<HeaderHash, { block: BlockView; timeSlot: TimeSlot }>, "invalid"> {
    let encodedHeader: BytesBlob;
    let timeSlot: TimeSlot;
    try {
      encodedHeader = block.header.encoded();
      timeSlot = block.header.view().timeSlotIndex.materialize();
    } catch {
      return Result.error("invalid");
    }

    const headerHash = blake2b.hashBytes(encodedHeader).asOpaque<HeaderHash>();
    return Result.ok(new WithHash(headerHash, { block, timeSlot }));
  }

  push(details: WithHash<HeaderHash, { block: BlockView; timeSlot: TimeSlot }>): Result<OK, "already queued"> {
    const headerHash = details.hash;
    if (this.queuedBlocks.has(headerHash)) {
      return Result.error("already queued");
    }

    const { timeSlot, block } = details.data;
    const entry: ImportingQueueEntry = {
      headerHash,
      timeSlot,
      block,
      seal: this.isCurrentEpoch(timeSlot) ? this.importer.preverifySeal(timeSlot, block) : Promise.resolve(null),
    };
    this.toImport.insert(entry);
    this.queuedBlocks.insert(headerHash);

    return Result.ok(OK);
  }

  shift(): ImportingQueueEntry | undefined {
    const entry = this.toImport.pop();
    if (entry !== undefined) {
      this.queuedBlocks.delete(entry.headerHash);
      const blockEpoch = Math.floor(entry.timeSlot / this.spec.epochLength);
      const hasEpochChanged = this.lastEpoch !== blockEpoch;
      this.lastEpoch = tryAsEpoch(blockEpoch);
      // currently removed block is changing the epoch, so fire up
      // preverifcation for the following blocks.
      if (hasEpochChanged) {
        this.startPreverification();
      }
    }

    return entry;
  }
}
