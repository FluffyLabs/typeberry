import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { U32 } from "@typeberry/numbers";
import type { Ed25519Key, Ed25519Signature } from "./crypto";
import { HASH_SIZE, type HeaderHash } from "./hash";
import type { ValidatorIndex } from "./header";

export class Fault {
  static Codec = codec.Class(Fault, {
    target: codec.bytes(HASH_SIZE).cast(),
    vote: codec.bool,
    key: codec.bytes(32).cast(),
    signature: codec.bytes(64).cast(),
  });

  static fromCodec({ target, vote, key, signature }: CodecRecord<Fault>) {
    return new Fault(target, vote, key, signature);
  }

  constructor(
    public readonly target: HeaderHash,
    public readonly vote: boolean,
    public readonly key: Ed25519Key,
    public readonly signature: Ed25519Signature,
  ) {}
}

export class Culprit {
  static Codec = codec.Class(Culprit, {
    target: codec.bytes(HASH_SIZE).cast(),
    key: codec.bytes(32).cast(),
    signature: codec.bytes(64).cast(),
  });

  static fromCodec({ target, key, signature }: CodecRecord<Culprit>) {
    return new Culprit(target, key, signature);
  }

  constructor(
    public readonly target: HeaderHash,
    public readonly key: Ed25519Key,
    public readonly signature: Ed25519Signature,
  ) {}
}

export class Judgement {
  static Codec = codec.Class(Judgement, {
    vote: codec.bool,
    index: codec.u16.cast(),
    signature: codec.bytes(64).cast(),
  });

  static fromCodec({ vote, index, signature }: CodecRecord<Judgement>) {
    return new Judgement(vote, index, signature);
  }

  constructor(
    public readonly vote: boolean,
    public readonly index: ValidatorIndex,
    public readonly signature: Ed25519Signature,
  ) {}
}

export class Verdict {
  static Codec = codec.Class(Verdict, {
    target: codec.bytes(HASH_SIZE).cast(),
    age: codec.u32,
    votes: codec.sequenceVarLen(Judgement.Codec).cast(),
  });

  static fromCodec({ target, age, votes }: CodecRecord<Verdict>) {
    return new Verdict(target, age, votes);
  }

  constructor(
    public readonly target: HeaderHash,
    public readonly age: U32,
    public readonly votes: KnownSizeArray<Judgement, "Validators super majority">,
  ) {}
}

export class DisputesExtrinsic {
  static Codec = codec.Class(DisputesExtrinsic, {
    verdicts: codec.sequenceVarLen(Verdict.Codec),
    culprits: codec.sequenceVarLen(Culprit.Codec),
    faults: codec.sequenceVarLen(Fault.Codec),
  });

  static fromCodec({ verdicts, culprits, faults }: CodecRecord<DisputesExtrinsic>) {
    return new DisputesExtrinsic(verdicts, culprits, faults);
  }

  constructor(
    public readonly verdicts: Verdict[],
    public readonly culprits: Culprit[],
    public readonly faults: Fault[],
  ) {}
}
