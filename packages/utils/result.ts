import { check } from "./debug";

/** An indication of two possible outcomes returned from a function. */
export type Result<Ok, Error> =
  | {
      isOk: true;
      isError: false;
      ok: Ok;
    }
  | {
      isOk: false;
      isError: true;
      error: Error;
      details: string;
    };

/**
 * A generic `OK` response to be used instead of some empty/null value.
 *
 * NOTE that generic error is not provided to rather have a more
 * descriptive value.
 */
export const OK = Symbol("ok");
export type OK = typeof OK;

/** An indication of two possible outcomes returned from a function. */
export const Result = {
  /** Create new [`Result`] with `Ok` status. */
  ok: <Ok, Error>(ok: Ok): Result<Ok, Error> => {
    check(ok !== undefined, "`Ok` type cannot be undefined.");
    return {
      isOk: true,
      isError: false,
      ok,
    };
  },

  /** Create new [`Result`] with `Error` status. */
  error: <Ok, Error>(error: Error, details = ""): Result<Ok, Error> => {
    check(error !== undefined, "`Error` type cannot be undefined.");
    return {
      isOk: false,
      isError: true,
      error,
      details,
    };
  },
};
