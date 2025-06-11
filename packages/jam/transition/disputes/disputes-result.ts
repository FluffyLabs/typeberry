import type { Ed25519Key } from "@typeberry/crypto";
import type { Result } from "@typeberry/utils";
import type { DisputesErrorCode } from "./disputes-error-code.js";

export type DisputesResult = Result<Ed25519Key[], DisputesErrorCode>;
