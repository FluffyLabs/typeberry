import type { State } from "@typeberry/state";

/**
 * A rather test-only function to copy some fields from the state,
 * apply an update to them (excluding services) and return a new plain object.
 *
 * NOTE: if looking something more sophisticated try `InMemoryState` representation.
 */
export function copyAndUpdateState<T extends Partial<State>>(
  preState: T,
  stateUpdate: Partial<T>,
): { [K in keyof T]: T[K] } {
  return {
    ...preState,
    ...stateUpdate,
  };
}
