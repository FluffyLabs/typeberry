import type { Ed25519Key } from "@typeberry/safrole/crypto";
import {
  type Ed25519Signature,
  type HeaderHash,
  type ValidatorIndex,
  bytes32,
  ed25519SignatureFromJson,
  logger,
} from ".";
import { ARRAY, FROM_NUMBER, type FromJson } from "../../json-parser";

// TODO [ToDr] can the JSON parser produce actual classes? So that we can check stuff with instanceof?

class Fault {
  static fromJson: FromJson<Fault> = {
    target: bytes32<HeaderHash>(),
    vote: "boolean",
    key: bytes32<Ed25519Key>(),
    signature: ed25519SignatureFromJson,
  };

  target!: HeaderHash;
  vote!: boolean;
  key!: Ed25519Key;
  signature!: Ed25519Signature;

  private constructor() {}
}

class Culprit {
  static fromJson: FromJson<Culprit> = {
    target: bytes32<HeaderHash>(),
    key: bytes32<Ed25519Key>(),
    signature: ed25519SignatureFromJson,
  };

  target!: HeaderHash;
  key!: Ed25519Key;
  signature!: Ed25519Signature;

  private constructor() {}
}

class Judgement {
  static fromJson: FromJson<Judgement> = {
    vote: "boolean",
    index: FROM_NUMBER((n) => n as ValidatorIndex),
  };

  vote!: boolean;
  index!: ValidatorIndex;

  private constructor() {}
}

class Verdict {
  static fromJson: FromJson<Verdict> = {
    target: bytes32<HeaderHash>(),
    age: "number",
    votes: ARRAY(Judgement.fromJson),
  };

  target!: HeaderHash;
  age!: number; // u32
  votes!: Judgement[]; // size of validators super majority

  private constructor() {}
}

export class DisputesExtrinsic {
  static fromJson: FromJson<DisputesExtrinsic> = {
    verdicts: ARRAY(Verdict.fromJson),
    culprits: ARRAY(Culprit.fromJson),
    faults: ARRAY(Fault.fromJson),
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
