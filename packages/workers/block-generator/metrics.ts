import { metrics } from "@opentelemetry/api";

/**
 * Block authoring metrics for JAM implementation.
 *
 * JIP-3 Events 40-42 (Block Authoring): https://github.com/polkadot-fellows/JIPs/blob/main/JIP-3.md#block-authoring
 */

const meter = metrics.getMeter("@typeberry/block-generator", "0.4.0");

export const blockAuthoringCounter = meter.createCounter("jam.jip3.authoring", {
  description: "Block authoring started",
  unit: "blocks",
});

export const blockAuthoringFailedCounter = meter.createCounter("jam.jip3.authoring_failed", {
  description: "Block authoring failed",
  unit: "errors",
});

export const blockAuthoredCounter = meter.createCounter("jam.jip3.authored", {
  description: "Block authored successfully",
  unit: "blocks",
});

export const blockAuthoringDuration = meter.createHistogram("jam.jip3.authoring_duration", {
  description: "Duration of block authoring process",
  unit: "ms",
});

// Helper functions
export function recordBlockAuthoringStarted(slot: number): void {
  blockAuthoringCounter.add(1, { slot: slot.toString() });
}

export function recordBlockAuthoringFailed(reason: string): void {
  blockAuthoringFailedCounter.add(1, { reason });
}

export function recordBlockAuthored(slot: number, durationMs: number): void {
  blockAuthoredCounter.add(1, { slot: slot.toString() });
  blockAuthoringDuration.record(durationMs);
}
