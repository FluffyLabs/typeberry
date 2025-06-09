import type { BytesBlob } from "@typeberry/bytes";
import type { ServicesUpdate, State } from "@typeberry/state";
import type { StateKey } from "./keys";

/** Serialize given state update into a series of key-value pairs. */
export function serializeUpdate(_update: Partial<State & ServicesUpdate>): Generator<[StateKey, BytesBlob]> {
  throw new Error("not implemented yet");
}
