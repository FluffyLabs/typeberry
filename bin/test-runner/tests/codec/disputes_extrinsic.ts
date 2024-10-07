import type { KnownSizeArray } from "@typeberry/collections";
import { type FromJson, json } from "@typeberry/json-parser";
import type { U32 } from "@typeberry/numbers";
import type { Ed25519Key } from "@typeberry/safrole/crypto";
import { type Ed25519Signature, type HeaderHash, type ValidatorIndex, bytes32, fromJson, logger } from ".";

class Fault {
  static fromJson: FromJson<Fault> = {
    target: bytes32(),
    vote: "boolean",
    key: bytes32(),
    signature: fromJson.ed25519Signature,
  };

  target!: HeaderHash;
  vote!: boolean;
  key!: Ed25519Key;
  signature!: Ed25519Signature;

  private constructor() {}
}

class Culprit {
  static fromJson: FromJson<Culprit> = {
    target: bytes32(),
    key: bytes32(),
    signature: fromJson.ed25519Signature,
  };

  target!: HeaderHash;
  key!: Ed25519Key;
  signature!: Ed25519Signature;

  private constructor() {}
}

class Judgement {
  static fromJson: FromJson<Judgement> = {
    vote: "boolean",
    index: "number",
    signature: fromJson.ed25519Signature,
  };

  vote!: boolean;
  index!: ValidatorIndex;
  signature!: Ed25519Signature;

  private constructor() {}
}

class Verdict {
  static fromJson: FromJson<Verdict> = {
    target: bytes32(),
    age: "number",
    votes: json.array(Judgement.fromJson),
  };

  target!: HeaderHash;
  age!: U32;
  votes!: KnownSizeArray<Judgement, "Validators super majority">;

  private constructor() {}
}

export class DisputesExtrinsic {
  static fromJson: FromJson<DisputesExtrinsic> = {
    verdicts: json.array(Verdict.fromJson),
    culprits: json.array(Culprit.fromJson),
    faults: json.array(Fault.fromJson),
  };

  verdicts!: Verdict[];
  culprits!: Culprit[];
  faults!: Fault[];

  private constructor() {}
}

export async function runDisputesExtrinsicTest(test: DisputesExtrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
