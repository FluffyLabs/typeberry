/**
 * Erasure coding implementation for data availability.
 *
 * This module provides erasure coding functionality used in JAM's data availability
 * system, enabling data reconstruction from partial information.
 *
 * @module erasure-coding
 */
import { init } from "@typeberry/native";

export * from "./erasure-coding.js";
export const initEc = async () => {
  await init.reedSolomon();
};
