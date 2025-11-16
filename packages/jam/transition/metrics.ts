import { metrics } from "@opentelemetry/api";

/**
 * State transition metrics for JAM implementation.
 *
 * JIP-3 Metrics specification: https://github.com/polkadot-fellows/JIPs/blob/main/JIP-3.md
 */

const meter = metrics.getMeter("@typeberry/transition", "0.4.0");

// State-related metrics
export const stateRootCalculationDuration = meter.createHistogram("jam.state.root_calculation_duration", {
  description: "Time taken to calculate state root",
  unit: "ms",
});

// Database metrics
export const databaseReadDuration = meter.createHistogram("jam.database.read_duration", {
  description: "Time taken for database read operations",
  unit: "ms",
});

export const databaseWriteDuration = meter.createHistogram("jam.database.write_duration", {
  description: "Time taken for database write operations",
  unit: "ms",
});

// Helper functions
export function recordStateRootCalculation(durationMs: number): void {
  stateRootCalculationDuration.record(durationMs);
}

export function recordDatabaseOperation(operation: "read" | "write", durationMs: number): void {
  if (operation === "read") {
    databaseReadDuration.record(durationMs);
  } else {
    databaseWriteDuration.record(durationMs);
  }
}
