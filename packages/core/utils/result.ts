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

/**
 * Returns a string representation of a {@link Result}, indicating success or error details.
 *
 * If the result is successful, the string starts with "OK: " followed by the success value.
 * If the result is an error, the string starts with "Error: " followed by the error details and the error value.
 *
 * @param res - The {@link Result} instance to convert to a string.
 * @returns A string summarizing the state and contents of {@link res}.
 */
export function resultToString<Ok, Error>(res: Result<Ok, Error>) {
  if (res.isOk) {
    return `OK: ${res.ok}`;
  }
  return `Error: ${res.details}\n${res.error}`;
}

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
