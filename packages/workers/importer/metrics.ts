import { metrics } from "@opentelemetry/api";

/**
 * Block importer metrics for JAM implementation.
 *
 * JIP-3 Events 43-47 (Block Import): https://github.com/polkadot-fellows/JIPs/blob/main/JIP-3.md#block-import
 */

const meter = metrics.getMeter("@typeberry/importer", "0.4.0");

export const blockImportingCounter = meter.createCounter("jam.jip3.importing", {
  description: "Block importing started",
  unit: "blocks",
});

export const blockVerificationFailedCounter = meter.createCounter("jam.jip3.verification_failed", {
  description: "Block verification failed",
  unit: "errors",
});

export const blockVerifiedCounter = meter.createCounter("jam.jip3.verified", {
  description: "Block verified successfully",
  unit: "blocks",
});

export const blockVerificationDuration = meter.createHistogram("jam.jip3.verification_duration", {
  description: "Duration of block verification",
  unit: "ms",
});

export const blockExecutionFailedCounter = meter.createCounter("jam.jip3.execution_failed", {
  description: "Block execution failed",
  unit: "errors",
});

export const blockExecutedCounter = meter.createCounter("jam.jip3.executed", {
  description: "Block executed successfully",
  unit: "blocks",
});

export const blockExecutionDuration = meter.createHistogram("jam.jip3.execution_duration", {
  description: "Duration of block execution",
  unit: "ms",
});

export const blockExecutionCost = meter.createHistogram("jam.jip3.execution_cost", {
  description: "Block execution cost (gas)",
  unit: "gas",
});

export const blockImportDuration = meter.createHistogram("jam.jip3.import_duration", {
  description: "Total duration of block import (verification + execution)",
  unit: "ms",
});

// Helper functions
export function recordBlockImportingStarted(slot: number): void {
  blockImportingCounter.add(1, { slot: slot.toString() });
}

export function recordBlockVerificationFailed(reason: string): void {
  blockVerificationFailedCounter.add(1, { reason });
}

export function recordBlockVerified(durationMs: number): void {
  blockVerifiedCounter.add(1);
  blockVerificationDuration.record(durationMs);
}

export function recordBlockExecutionFailed(reason: string): void {
  blockExecutionFailedCounter.add(1, { reason });
}

export function recordBlockExecuted(durationMs: number, cost: number): void {
  blockExecutedCounter.add(1);
  blockExecutionDuration.record(durationMs);
  blockExecutionCost.record(cost);
}

export function recordBlockImportComplete(totalDurationMs: number, success: boolean): void {
  blockImportDuration.record(totalDurationMs, { success: success.toString() });
}
