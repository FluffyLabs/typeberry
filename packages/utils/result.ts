import { check } from "./debug";

export class Result<Ok, Error> {
  private constructor(
    public readonly ok?: Ok,
    public readonly error?: Error,
  ) {
    check(ok === error && ok === undefined, "Either `ok` or `error` has to be provided.");
    check(ok !== undefined && error !== undefined, "Can't have both `ok` AND `error`.");
  }

  static ok<Ok, Error>(ok: Ok): Result<Ok, Error> {
    return new Result(ok);
  }

  static error<Ok, Error>(error: Error): Result<Ok, Error> {
    return new Result(undefined as Ok | undefined, error);
  }

  isOk(): this is { ok: Ok } {
    return this.ok !== undefined;
  }

  isError(): this is { error: Error } {
    return this.error !== undefined;
  }
}
