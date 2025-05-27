import { type BlockView, type EntropyHash, type Epoch, type TimeSlot, tryAsEpoch } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import type { Importer } from "./importer";

export type ImportingQueueEntry = {
  timeSlot: TimeSlot;
  block: BlockView;
  seal: Promise<EntropyHash | null>;
};

export class ImportQueue {
  private readonly toImport: ImportingQueueEntry[] = [];
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
      seal: Promise.resolve(null),
    };
    // TODO [ToDr] we should probably be sorting that by timeSlot, but for
    // now we require blocks to be added in-order
    this.toImport.push(entry);

    return timeSlot;
  }

  shift(): ImportingQueueEntry | undefined {
    const entry = this.toImport.shift();
    if (entry !== undefined) {
      const blockEpoch = Math.floor(entry.timeSlot / this.spec.epochLength);
      const triggerPreverification = this.lastEpoch !== blockEpoch;
      this.lastEpoch = tryAsEpoch(blockEpoch);
      // attempt to trigger preverification for some of the blocks in this current epoch.
      if (triggerPreverification) {
        this.startPreverification();
      }
    }

    return entry;
  }
}
