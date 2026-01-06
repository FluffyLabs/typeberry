/**
 * JAM/GP codec implementation for encoding and decoding data.
 *
 * This module provides the JAM/GP codec used throughout the
 * JAM protocol for efficient binary serialization.
 *
 * @module codec
 */
export * from "./decoder.js";
export * from "./descriptor.js";
export * from "./descriptors.js";
export * from "./encoder.js";
export * from "./validation.js";
export * from "./view.js";

// additional re-export of descriptors namespace under `codec`
// note we export descriptors in top level as well,
// because writing `codec.codec.u32` when using the library looks weird
import * as descriptors from "./descriptors.js";
export const codec = descriptors;
