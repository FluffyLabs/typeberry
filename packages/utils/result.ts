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
    };

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
  error: <Ok, Error>(error: Error): Result<Ok, Error> => {
    check(error !== undefined, "`Error` type cannot be undefined.");
    return {
      isOk: false,
      isError: true,
      error,
    };
  },
};
