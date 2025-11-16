import { metrics } from "@opentelemetry/api";

/**
 * Node-level metrics for JAM implementation.
 *
 * JIP-3 Events 11-13 (Node): https://github.com/polkadot-fellows/JIPs/blob/main/JIP-3.md#node
 */

const meter = metrics.getMeter("@typeberry/node", "0.4.0");

export const bestBlockChangedCounter = meter.createCounter("jam.jip3.best_block_changed", {
  description: "Best block changed events",
  unit: "events",
});

let bestBlockSlot = 0;
export const bestBlockSlotGauge = meter.createObservableGauge("jam.jip3.best_block_slot", {
  description: "Current best block slot",
  unit: "slot",
});
bestBlockSlotGauge.addCallback((observableResult) => {
  observableResult.observe(bestBlockSlot);
});

export const finalizedBlockChangedCounter = meter.createCounter("jam.jip3.finalized_block_changed", {
  description: "Finalized block changed events",
  unit: "events",
});

let finalizedBlockSlot = 0;
export const finalizedBlockSlotGauge = meter.createObservableGauge("jam.jip3.finalized_block_slot", {
  description: "Current finalized block slot",
  unit: "slot",
});
finalizedBlockSlotGauge.addCallback((observableResult) => {
  observableResult.observe(finalizedBlockSlot);
});

export const syncStatusChangedCounter = meter.createCounter("jam.jip3.sync_status_changed", {
  description: "Sync status changed events",
  unit: "events",
});

let isSynced = 0;
export const syncedGauge = meter.createObservableGauge("jam.jip3.is_synced", {
  description: "Whether node is synced (1=synced, 0=not synced)",
  unit: "status",
});
syncedGauge.addCallback((observableResult) => {
  observableResult.observe(isSynced);
});

// Helper functions
export function recordBestBlockChanged(slot: number, headerHash: string): void {
  bestBlockSlot = slot;
  bestBlockChangedCounter.add(1, { header_hash: headerHash });
}

export function recordFinalizedBlockChanged(slot: number, headerHash: string): void {
  finalizedBlockSlot = slot;
  finalizedBlockChangedCounter.add(1, { header_hash: headerHash });
}

export function recordSyncStatusChanged(synced: boolean): void {
  isSynced = synced ? 1 : 0;
  syncStatusChangedCounter.add(1, { synced: synced.toString() });
}
