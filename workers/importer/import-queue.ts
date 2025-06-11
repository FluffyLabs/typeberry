import { type BlockView, type EntropyHash, type Epoch, type TimeSlot, tryAsEpoch } from "@typeberry/block";
import { SortedArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { Ordering } from "@typeberry/ordering";
import type { Importer } from "./importer.js";

export type ImportingQueueEntry = {
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

  private lastEpoch: Epoch = tryAsEpoch(2 ** 32 - 1);

  constructor(
    private readonly spec: ChainSpec,
    private readonly importer: Importer,
  ) {}

  private tryToReadTimeSlot(block: BlockView) {
    try {
      return block.header.view().timeSlotIndex.materialize();
    } catch {
      return null;
    }
  }

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

  push(block: BlockView): TimeSlot | null {
    const timeSlot = this.tryToReadTimeSlot(block);
    if (timeSlot === null) {
      return null;
    }

    const entry: ImportingQueueEntry = {
      timeSlot,
      block,
      seal: this.isCurrentEpoch(timeSlot) ? this.importer.preverifySeal(timeSlot, block) : Promise.resolve(null),
    };
    this.toImport.insert(entry);

    return timeSlot;
  }

  shift(): ImportingQueueEntry | undefined {
    const entry = this.toImport.pop();
    if (entry !== undefined) {
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
