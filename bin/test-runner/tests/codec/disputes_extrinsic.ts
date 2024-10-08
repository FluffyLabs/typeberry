import type { KnownSizeArray } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import type { U32 } from "@typeberry/numbers";
import type { Ed25519Key } from "@typeberry/safrole/crypto";
import { type Ed25519Signature, type HeaderHash, type ValidatorIndex, bytes32, fromJson, logger } from ".";

class Fault {
  static fromJson = json.object<Fault>(
    {
      target: bytes32(),
      vote: "boolean",
      key: bytes32(),
      signature: fromJson.ed25519Signature,
    },
    (f) => Object.assign(new Fault(), f),
  );

  target!: HeaderHash;
  vote!: boolean;
  key!: Ed25519Key;
  signature!: Ed25519Signature;

  private constructor() {}
}

class Culprit {
  static fromJson = json.object<Culprit>(
    {
      target: bytes32(),
      key: bytes32(),
      signature: fromJson.ed25519Signature,
    },
    (c) => Object.assign(new Culprit(), c),
  );

  target!: HeaderHash;
  key!: Ed25519Key;
  signature!: Ed25519Signature;

  private constructor() {}
}

class Judgement {
  static fromJson = json.object<Judgement>(
    {
      vote: "boolean",
      index: "number",
      signature: fromJson.ed25519Signature,
    },
    (x) => Object.assign(new Judgement(), x),
  );

  vote!: boolean;
  index!: ValidatorIndex;
  signature!: Ed25519Signature;

  private constructor() {}
}

class Verdict {
  static fromJson = json.object<Verdict>(
    {
      target: bytes32(),
      age: "number",
      votes: json.array(Judgement.fromJson),
    },
    (x) => Object.assign(new Verdict(), x),
  );

  target!: HeaderHash;
  age!: U32;
  votes!: KnownSizeArray<Judgement, "Validators super majority">;

  private constructor() {}
}

export class DisputesExtrinsic {
  static fromJson = json.object<DisputesExtrinsic>(
    {
      verdicts: json.array(Verdict.fromJson),
      culprits: json.array(Culprit.fromJson),
      faults: json.array(Fault.fromJson),
    },
    (x) => Object.assign(new DisputesExtrinsic(), x),
  );

  verdicts!: Verdict[];
  culprits!: Culprit[];
  faults!: Fault[];

  private constructor() {}
}

export async function runDisputesExtrinsicTest(test: DisputesExtrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
