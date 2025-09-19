import { check } from "./debug.js";

/** An indication of two possible outcomes returned from a function. */
export type Result<Ok, Error> = OkResult<Ok> | ErrorResult<Error>;

export type OkResult<Ok> = {
  isOk: true;
  isError: false;
  ok: Ok;
};

export type ErrorResult<Error> = {
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
 * A standardized tagged union for nested error types.
 */
export type TaggedError<Kind, Nested> = {
  kind: Kind;
  error: Nested;
};

type EnumMapping = Record<string, string | number>;

class RichTaggedError<Kind extends string | number, Nested> implements TaggedError<Kind, Nested> {
  constructor(
    public readonly kind: Kind,
    public readonly error: Nested,
    public readonly enumMapping: EnumMapping,
  ) {}

  toString() {
    const readableKind = Object.keys(this.enumMapping).find((key) => this.enumMapping[key] === this.kind) ?? "?";
    return `${readableKind} (${this.kind}) - ${maybeTaggedErrorToString(this.error)}`;
  }
}

const isTaggedError = (e: unknown): e is TaggedError<unknown, unknown> => {
  if (e !== null && typeof e === "object") {
    if ("kind" in e && "error" in e) {
      return true;
    }
  }
  return false;
};

const maybeTaggedErrorToString = (err: unknown): string => {
  if (isTaggedError(err)) {
    if (err instanceof RichTaggedError) {
      return err.toString();
    }
    return `${err.kind} - ${maybeTaggedErrorToString(err.error)}`;
  }
  if (typeof err === "symbol") {
    return err.toString();
  }
  return `${err}`;
};

export function resultToString<Ok, Error>(res: Result<Ok, Error>) {
  if (res.isOk) {
    return `OK: ${typeof res.ok === "symbol" ? res.ok.toString() : res.ok}`;
  }
  return `${res.details}\nError: ${maybeTaggedErrorToString(res.error)}`;
}

/** An indication of two possible outcomes returned from a function. */
export const Result = {
  /** Create new [`Result`] with `Ok` status. */
  ok: <Ok>(ok: Ok): OkResult<Ok> => {
    check`${ok !== undefined} 'ok' type cannot be undefined.`;
    return {
      isOk: true,
      isError: false,
      ok,
    };
  },

  /** Create new [`Result`] with `Error` status. */
  error: <Error>(error: Error, details = ""): ErrorResult<Error> => {
    check`${error !== undefined} 'Error' type cannot be undefined.`;
    return {
      isOk: false,
      isError: true,
      error,
      details,
    };
  },

  /** Create new [`Result`] with `Error` coming from a nested error type. */
  taggedError: <Ok, Kind extends string | number, Nested>(
    enumMapping: EnumMapping,
    kind: Kind,
    nested: ErrorResult<Nested>,
  ): Result<Ok, RichTaggedError<Kind, Nested>> => {
    return Result.error(new RichTaggedError(kind, nested.error, enumMapping), nested.details);
  },
};
