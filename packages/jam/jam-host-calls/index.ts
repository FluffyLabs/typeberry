/**
 * JAM-specific host call implementations.
 *
 * This module provides the host call interface implementations specific to JAM,
 * enabling communication between the host and guest environments.
 *
 * @module jam-host-calls
 */
export * as accumulate from "./accumulate/index.js";
export * from "./externalities/partial-state.js";
export * from "./externalities/pending-transfer.js";
export * from "./externalities/refine-externalities.js";
export * from "./externalities/state-update.js";
export * as general from "./general/index.js";
export { codecServiceAccountInfoWithThresholdBalance as hostCallInfoAccount } from "./general/info.js";
export * from "./general/results.js";
export * as refine from "./refine/index.js";
export * from "./utils.js";
