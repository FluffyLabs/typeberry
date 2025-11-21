import { metrics } from "@opentelemetry/api";
import packageJson from "./package.json" with { type: "json" };

/**
 * Block importer metrics for JAM implementation.
 *
 * https://github.com/polkadot-fellows/JIPs/blob/main/JIP-3.md#block-authoringimporting-events
 */

const meter = metrics.getMeter(packageJson.name, packageJson.version);

const blockVerificationDuration = meter.createHistogram("jam.blockVerificationTime", {
  description: "Duration of block verification",
  unit: "ms",
});

const blockExecutionDuration = meter.createHistogram("jam.blockExecutionTime", {
  description: "Duration of block execution",
  unit: "ms",
});

const blockExecutionCost = meter.createHistogram("jam.blockExecutionGas", {
  description: "Block execution cost (gas)",
  unit: "gas",
});

const blockImportDuration = meter.createHistogram("jam.blockImportTime", {
  description: "Total duration of block import (verification + execution)",
  unit: "ms",
});

export function recordBlockImportComplete(totalDurationMs: number, success: boolean): void {
  blockImportDuration.record(totalDurationMs, { success: success.toString() });
}

// JIP-3

// 43
const blockImportingCounter = meter.createCounter("jam.jip3.importing", {
  description: "Block importing started",
  unit: "blocks",
});

export function recordBlockImportingStarted(slot: number): void {
  blockImportingCounter.add(1, { slot: slot.toString() });
}

// 44
const blockVerificationFailedCounter = meter.createCounter("jam.jip3.verification_failed", {
  description: "Block verification failed",
  unit: "errors",
});

export function recordBlockVerificationFailed(reason: string): void {
  blockVerificationFailedCounter.add(1, { reason });
}

// 45
const blockVerifiedCounter = meter.createCounter("jam.jip3.verified", {
  description: "Block verified successfully",
  unit: "blocks",
});

export function recordBlockVerified(durationMs: number): void {
  blockVerifiedCounter.add(1);
  blockVerificationDuration.record(durationMs);
}

// 46
const blockExecutionFailedCounter = meter.createCounter("jam.jip3.execution_failed", {
  description: "Block execution failed",
  unit: "errors",
});

export function recordBlockExecutionFailed(reason: string): void {
  blockExecutionFailedCounter.add(1, { reason });
}

// 47
const blockExecutedCounter = meter.createCounter("jam.jip3.executed", {
  description: "Block executed successfully",
  unit: "blocks",
});

export function recordBlockExecuted(durationMs: number, cost: number): void {
  blockExecutedCounter.add(1);
  blockExecutionDuration.record(durationMs);
  blockExecutionCost.record(cost);
}
