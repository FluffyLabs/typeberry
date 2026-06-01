import type { HeaderHash, TimeSlot } from "@typeberry/block";
import type { LeafDb } from "@typeberry/database";
import type { Logger } from "@typeberry/logger";
import type { SerializedState } from "@typeberry/state-merkleization";
import { memoryTracker, now } from "@typeberry/utils";

/** Reports the current on-disk database size in bytes, or `null` when unknown. */
export type DbSizeProvider = () => number | null;

/** Format a database size for the stats line, e.g. ` db=12.34GB`. Empty when unknown. */
function formatDbSize(bytes: number | null): string {
  if (bytes === null) {
    return "";
  }
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? ` db=${(mb / 1024).toFixed(2)}GB` : ` db=${mb.toFixed(1)}MB`;
}

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
  private showDiskStats = true;
  private totalTimePrev = 0;
  private totalTime = 0;
  private totalBlocksPrev = 0;
  private totalBlocks = 0;

  static new(logger: Logger, dbSizeInBytes: DbSizeProvider = () => null) {
    return new ImporterStats(logger, dbSizeInBytes);
  }

  private constructor(
    private readonly logger: Logger,
    /** Reports the current on-disk database size in bytes, or `null` if unknown. */
    private readonly dbSizeInBytes: DbSizeProvider = () => null,
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
        // disk data (every second output)
        if (this.showDiskStats) {
          this.logger.info`💾 disk at #${timeSlot}: ${formatDbSize(this.dbSizeInBytes())}`;
        }
        this.showDiskStats = !this.showDiskStats;

        // memory
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
