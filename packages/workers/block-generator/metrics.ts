import { metrics } from "@opentelemetry/api";
import packageJson from "./package.json" with { type: "json" };

/**
 * Block authoring metrics for JAM implementation.
 *
 * https://github.com/polkadot-fellows/JIPs/blob/main/JIP-3.md#block-authoringimporting-events
 */

const meter = metrics.getMeter(packageJson.name, packageJson.version);

const blockAuthoringDuration = meter.createHistogram("jam.blockAuthoringTime", {
  description: "Duration of block authoring process",
  unit: "ms",
});

// JIP-3

// 40
const blockAuthoringCounter = meter.createCounter("jam.jip3.authoring", {
  description: "Block authoring started",
  unit: "blocks",
});

export function recordBlockAuthoringStarted(slot: number): void {
  blockAuthoringCounter.add(1, { slot: slot.toString() });
}

// 41
const blockAuthoringFailedCounter = meter.createCounter("jam.jip3.authoring_failed", {
  description: "Block authoring failed",
  unit: "errors",
});

export function recordBlockAuthoringFailed(reason: string): void {
  blockAuthoringFailedCounter.add(1, { reason });
}

// 42
const blockAuthoredCounter = meter.createCounter("jam.jip3.authored", {
  description: "Block authored successfully",
  unit: "blocks",
});

export function recordBlockAuthored(slot: number, durationMs: number): void {
  blockAuthoredCounter.add(1, { slot: slot.toString() });
  blockAuthoringDuration.record(durationMs);
}
