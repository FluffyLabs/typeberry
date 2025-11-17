export { gasCounter } from "./gas.js";
export * from "./interpreter.js";
export * from "./debugger-adapter.js";
export {
  Memory,
  MemoryBuilder,
  type MemoryIndex,
  type SbrkIndex,
  tryAsMemoryIndex,
  tryAsSbrkIndex,
} from "./memory/index.js";
export { Registers } from "./registers.js";
