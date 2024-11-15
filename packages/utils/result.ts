import { check } from "./debug";

/** An indication of two possible outcomes returned from a function. */
export class Result<Ok, Error> {
  private constructor(
    public readonly ok?: Ok,
    public readonly error?: Error,
  ) {
    check(ok !== undefined || error !== undefined, "Either `ok` or `error` has to be provided.");
    check(ok === undefined || error === undefined, "Can't have both `ok` AND `error`.");
  }

  /** Create new [`Result`] with `Ok` status. */
  static ok<Ok, Error>(ok: Ok): Result<Ok, Error> {
    return new Result(ok);
  }

  /** Create new [`Result`] with `Error` status. */
  static error<Ok, Error>(error: Error): Result<Ok, Error> {
    return new Result(undefined as Ok | undefined, error);
  }

  /** The result contains `Ok` status. */
  isOk(): this is { ok: Ok } {
    return this.ok !== undefined;
  }

  /** The result contains `Error` status. */
  isError(): this is { error: Error } {
    return this.error !== undefined;
  }
}
