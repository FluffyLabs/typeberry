export * from "./chain-spec.js";
export * from "./network.js";

/** Implemented PVM Backends to choose from. */
export enum PVMBackend {
  /** Built-in aka. Typeberry 🫐 interpreter. */
  BuiltIn = "built-in",
  /** Ananas 🍍 interpreter. */
  Ananas = "ananas",
}
