import { Extrinsic, type ExtrinsicHash, Header, type HeaderHash, WithHash } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/block/context";
import {WorkPackage} from "@typeberry/block/work-package";
import {WorkReport} from "@typeberry/block/work-report";
import { Encoder } from "@typeberry/codec";
import { type HashAllocator, hashBytes } from "@typeberry/hash";
import {InMemoryBlocks} from "../database";

export class TransitionHasher {
  constructor(
    private readonly context: ChainSpec,
    private readonly allocator: HashAllocator,
  ) {}

  header(header: Header): WithHash<HeaderHash, Header> {
    // TODO [ToDr] Use already allocated encoding destination and hash bytes from some arena.
    const encoded = Encoder.encodeObject(Header.Codec, header, this.context);
    return new WithHash(hashBytes(encoded, this.allocator) as HeaderHash, header);
  }

  extrinsic(extrinsic: Extrinsic): WithHash<ExtrinsicHash, Extrinsic> {
    // TODO [ToDr] Use already allocated encoding destination and hash bytes from some arena.
    const encoded = Encoder.encodeObject(Extrinsic.Codec, extrinsic, this.context);
    return new WithHash(hashBytes(encoded, this.allocator) as ExtrinsicHash, extrinsic);
  }
}

export class WorkPackageExecutor {

  constructor(
    public readonly database: InMemoryBlocks;
  ) {}

  // TODO [ToDr] this while thing should be triple-checked with the GP.
  // I'm currently implementing some dirty version for the demo.
  executeWorkPackage(package: WorkPackage): WorkReport {
    // execute authorisation first or is it already executed and we just need to check it?
    // then validate & execute each work item and generate the report.
  }
}
