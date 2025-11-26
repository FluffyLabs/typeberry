import { metrics } from "@opentelemetry/api";
import packageJson from "./package.json" with { type: "json" };

/**
 * Node-level metrics for JAM implementation.
 *
 * https://github.com/polkadot-fellows/JIPs/blob/main/JIP-3.md#status-events
 */

export function createMetrics() {
  const meter = metrics.getMeter(packageJson.name, packageJson.version);

  // JIP-3

  // 11
  const bestBlockChangedCounter = meter.createCounter("jam.jip3.best_block_changed", {
    description: "Best block changed events",
    unit: "events",
  });

  // 12
  const finalizedBlockChangedCounter = meter.createCounter("jam.jip3.finalized_block_changed", {
    description: "Finalized block changed events",
    unit: "events",
  });

  // 13
  const syncStatusChangedCounter = meter.createCounter("jam.jip3.sync_status_changed", {
    description: "Sync status changed events",
    unit: "events",
  });

  return {
    recordBestBlockChanged(slot: number, headerHash: string): void {
      bestBlockChangedCounter.add(1, { slot, header_hash: headerHash });
    },

    recordFinalizedBlockChanged(slot: number, headerHash: string): void {
      finalizedBlockChangedCounter.add(1, { slot, header_hash: headerHash });
    },

    recordSyncStatusChanged(synced: boolean): void {
      syncStatusChangedCounter.add(1, { synced });
    },
  };
}
