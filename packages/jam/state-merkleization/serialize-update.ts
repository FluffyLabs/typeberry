import {BytesBlob} from "@typeberry/bytes";
import {StateKey} from "./keys";
import {ServicesUpdate, State} from "@typeberry/state";

/** Serialize given state update into a series of key-value pairs. */
export function serializeUpdate(update: Partial<State & ServicesUpdate>): Generator<[StateKey, BytesBlob]>  {
  throw new Error('not implemented yet');
}
