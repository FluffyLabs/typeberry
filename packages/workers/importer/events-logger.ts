import type { HeaderHash, TimeSlot } from "@typeberry/block";
import type { LeafDb } from "@typeberry/database";
import type { Logger } from "@typeberry/logger";
import type { SerializedState } from "@typeberry/state-merkleization";
import { memoryTracker, now } from "@typeberry/utils";

/** Events happening during block imports. */
export interface ImporterEventsListener {
  /**
   * Invoked when we start importing a block.
   *
   * Must return a callback that will be triggered at the end of block import.
   * The callback is expected to return duration between start and end events.
   */
  onBlockImportingStarted(timeSlot: TimeSlot): (isOk: boolean) => number;

  /** Initial state of the importer. */
  onStart(currentBestHeaderHash: HeaderHash, currentBestState: SerializedState<LeafDb>): void;
}

export class ImporterStats implements ImporterEventsListener {
  private readonly memory = memoryTracker();
  private totalTimePrev = 0;
  private totalTime = 0;
  private totalBlocksPrev = 0;
  private totalBlocks = 0;

  static new(logger: Logger) {
    return new ImporterStats(logger);
  }

  private constructor(
    private readonly logger: Logger,
    /** How often we are going to print the stats (i.e. every `maxBlocks` blocks) */
    private readonly maxBlocks: number = 100,
    /** Alternatively print stats when we reach `${maxTimeMs}` of total block execution. */
    private readonly maxTimeMs: number = 5000,
  ) {}

  onStart(currentBestHeaderHash: HeaderHash, currentBestState: SerializedState<LeafDb>) {
    this.logger.info`😎 Best time slot: ${currentBestState.timeslot} (header hash: ${currentBestHeaderHash})`;
  }

  onBlockImportingStarted(timeSlot: TimeSlot) {
    const start = now();

    return (isOk: boolean) => {
      const duration = now() - start;
      const label = isOk ? "import" : "reject";
      this.logger.log`⏱️ ${label} #${timeSlot} took ${duration.toFixed(2)}ms`;

      this.totalTime += duration;
      this.totalBlocks += 1;

      if (this.totalBlocks >= this.maxBlocks || this.totalTime >= this.maxTimeMs) {
        this.logger.info`📊 mem at #${timeSlot}: ${this.memory()}`;

        // compute block statistics (rolling window of last two rounds)
        const importedBlocks = this.totalBlocks + this.totalBlocksPrev;
        const importTime = this.totalTime + this.totalTimePrev;
        const blocksPerSecond = (importedBlocks / importTime) * 1000;
        // carry over current round
        this.totalBlocksPrev = this.totalBlocks;
        this.totalTimePrev = this.totalTime;
        this.totalBlocks = 0;
        this.totalTime = 0;
        this.logger.info`⏱️ time at #${timeSlot}: ${blocksPerSecond.toFixed(2)}bps`;
      }

      return duration;
    };
  }
}
