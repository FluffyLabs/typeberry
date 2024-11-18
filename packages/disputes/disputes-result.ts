import type { Ed25519Key } from "@typeberry/block";
import type { DisputesErrorCode } from "./disputes-error-code";

type DisputesResult = Result<Ed25519Key[], DisputesErrorCode>;
  private constructor(
    public offendersMarks: Ed25519Key[] | undefined,
    public err: DisputesErrorCode | undefined,
  ) {}

  static ok(offendersMarks: Ed25519Key[]) {
    return new DisputesResult(offendersMarks, undefined);
  }

  static error(error: DisputesErrorCode) {
    return new DisputesResult(undefined, error);
  }
}
