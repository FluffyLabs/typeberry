import { Extrinsic, type ExtrinsicHash, Header, type HeaderHash, WithHash, ServiceId, CodeHash } from "@typeberry/block";
import type { WorkPackage } from "@typeberry/block/work-package";
import type { WorkReport } from "@typeberry/block/work-report";
import { Encoder } from "@typeberry/codec";
import { type HashAllocator, hashBytes } from "@typeberry/hash";
import type { BlocksDb, StateDb } from "../database";
import {Result } from "@typeberry/utils";
import {ChainSpec} from "@typeberry/config";
import {Pvm} from "@typeberry/pvm";
import {BytesBlob} from "@typeberry/bytes";

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

enum ServiceExecutorError {
  NoLookup,
  NoState,
  NoServiceCode,
  ServiceCodeMismatch,
}

export class WorkPackageExecutor {
  constructor(
    private readonly blocks: BlocksDb,
    private readonly state: StateDb,
  ) {}

  // TODO [ToDr] this while thing should be triple-checked with the GP.
  // I'm currently implementing some dirty version for the demo.
  executeWorkPackage(pack: WorkPackage): WorkReport {
    // execute authorisation first or is it already executed and we just need to check it?
    const authExec = this.getServiceExecutor(
      // TODO [ToDr] should this be anchor or lookupAnchor?
      pack.context.lookupAnchor,
      pack.authCodeHost,
      pack.authCodeHash
    );
    if (authExec.isError()) {
      // TODO [ToDr] most likely shouldn't be throw.
      throw new Error(`Error during execution: ${authExec.error}`);
    }
    const pvm = authExec.ok;
    // then validate & execute each work item and generate the report.
    throw new Error(`TODO: implement me: ${pvm}`);
  }

  getServiceExecutor(
    lookupAnchor: HeaderHash,
    serviceId: ServiceId,
    expectedCodeHash: CodeHash
  ): Result<PvmExecutor, ServiceExecutorError> {
    const header = this.blocks.getHeader(lookupAnchor);
    if (!header) {
      return Result.error(ServiceExecutorError.NoLookup);
    }

    // TODO [ToDr] we should probably store posteriorStateRoots in the blocks db.
    const state = this.state.stateAt(header.priorStateRoot());
    if (!state) {
      return Result.error(ServiceExecutorError.NoState);
    }

    const serviceCode = state.getServiceCode(serviceId);
    if (!serviceCode) {
      return Result.error(ServiceExecutorError.NoServiceCode);
    }

    if (!serviceCode.hash.isEqualTo(expectedCodeHash)) {
      return Result.error(ServiceExecutorError.ServiceCodeMismatch);
    }

    return Result.ok(new PvmExecutor(serviceCode.data));
  }
}

class PvmExecutor {
  private readonly pvm: Pvm;

  constructor(serviceCode: BytesBlob) {
    this.pvm = new Pvm(serviceCode.buffer);

  }
}
