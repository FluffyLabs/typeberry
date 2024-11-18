import type { Ed25519Key } from "@typeberry/block";
import type { Result } from "@typeberry/utils";
import type { DisputesErrorCode } from "./disputes-error-code";

export type DisputesResult = Result<Ed25519Key[], DisputesErrorCode>;
