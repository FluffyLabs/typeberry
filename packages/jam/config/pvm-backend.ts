/** Implemented PVM Backends names in THE SAME ORDER as enum. */
export const PvmBackendNames = ["built-in", "ananas", "lite"];

/** Implemented PVM Backends to choose from. */
export enum PvmBackend {
  /** Built-in aka. Typeberry 🫐 interpreter. */
  BuiltIn = 0,
  /** Ananas 🍍 interpreter. */
  Ananas = 1,
  /** Lite interpreter. */
  Lite = 2,
}
