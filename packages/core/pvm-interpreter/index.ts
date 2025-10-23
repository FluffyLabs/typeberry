export { gasCounter } from "./gas.js";
export * from "./interpreter.js";
export {
  Memory,
  MemoryBuilder,
  type MemoryIndex,
  type SbrkIndex,
  tryAsMemoryIndex,
  tryAsSbrkIndex,
} from "./memory/index.js";
export { createEmptyRegistersBuffer as emptyRegistersBuffer, Registers } from "./registers.js";
