import {
  type CodeHash,
  Extrinsic,
  type ExtrinsicHash,
  Header,
  type HeaderHash,
  type ServiceGas,
  type ServiceId,
} from "@typeberry/block";
import { WorkPackage } from "@typeberry/block/work-package";
import { type CoreIndex, type WorkPackageHash, WorkPackageSpec, WorkReport } from "@typeberry/block/work-report";
import { WorkExecResult, WorkExecResultKind, WorkResult } from "@typeberry/block/work-result";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type Codec, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE, type HashAllocator, WithHashAndBytes, hashBytes } from "@typeberry/hash";
import type { U32, U64 } from "@typeberry/numbers";
import { HostCalls, PvmHostCallExtension, PvmInstanceManager } from "@typeberry/pvm-host-calls";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import { Program } from "@typeberry/pvm-program";
import { Result } from "@typeberry/utils";
import type { BlocksDb, StateDb } from "../database";

export class TransitionHasher {
  constructor(
    private readonly context: ChainSpec,
    private readonly allocator: HashAllocator,
  ) {}

  header(header: Header): WithHashAndBytes<HeaderHash, Header> {
    return this.encode(Header.Codec, header);
  }

  extrinsic(extrinsic: Extrinsic): WithHashAndBytes<ExtrinsicHash, Extrinsic> {
    return this.encode(Extrinsic.Codec, extrinsic);
  }

  workPackage(workPackage: WorkPackage): WithHashAndBytes<WorkPackageHash, WorkPackage> {
    return this.encode(WorkPackage.Codec, workPackage);
  }

  private encode<T, THash extends Bytes<HASH_SIZE>>(codec: Codec<T>, data: T): WithHashAndBytes<THash, T> {
    // TODO [ToDr] Use already allocated encoding destination and hash bytes from some arena.
    const encoded = Encoder.encodeObject(codec, data, this.context);
    return new WithHashAndBytes(hashBytes(encoded, this.allocator) as THash, data, encoded);
  }
}

enum ServiceExecutorError {
  NoLookup = 0,
  NoState = 1,
  NoServiceCode = 2,
  ServiceCodeMismatch = 3,
}

export class WorkPackageExecutor {
  constructor(
    private readonly blocks: BlocksDb,
    private readonly state: StateDb,
    private readonly hasher: TransitionHasher,
  ) {}

  // TODO [ToDr] this while thing should be triple-checked with the GP.
  // I'm currently implementing some dirty version for the demo.
  async executeWorkPackage(pack: WorkPackage): Promise<WorkReport> {
    const headerHash = pack.context.lookupAnchor;
    // execute authorisation first or is it already executed and we just need to check it?
    const authExec = this.getServiceExecutor(
      // TODO [ToDr] should this be anchor or lookupAnchor?
      headerHash,
      pack.authCodeHost,
      pack.authCodeHash,
    );

    if (!authExec.isOk()) {
      // TODO [ToDr] most likely shouldn't be throw.
      throw new Error(`Could not get authorization executor: ${authExec.error}`);
    }

    const pvm = authExec.ok;
    const authGas = 15_000n as ServiceGas;
    const result = await pvm.run(pack.parametrization, authGas);

    if (!result.isEqualTo(pack.authorization)) {
      throw new Error("Authorization is invalid.");
    }

    const results = [] as WorkResult[];
    for (const item of pack.items) {
      const exec = this.getServiceExecutor(headerHash, item.service, item.codeHash);
      if (!exec.isOk()) {
        throw new Error(`Could not get item executor: ${exec.error}`);
      }
      const pvm = exec.ok;

      const gasRatio = 3_000n as ServiceGas;
      const ret = await pvm.run(item.payload, item.gasLimit);
      results.push(
        new WorkResult(
          item.service,
          item.codeHash,
          hashBytes(item.payload),
          gasRatio,
          new WorkExecResult(WorkExecResultKind.ok, ret),
        ),
      );
    }

    const workPackage = this.hasher.workPackage(pack);
    const workPackageSpec = new WorkPackageSpec(
      workPackage.hash,
      workPackage.encoded.length as U32,
      Bytes.zero(HASH_SIZE),
      Bytes.zero(HASH_SIZE),
    );
    const coreIndex = 0 as CoreIndex;
    const authorizerHash = Bytes.fill(HASH_SIZE, 5);

    return Promise.resolve(
      new WorkReport(workPackageSpec, pack.context, coreIndex, authorizerHash, pack.authorization, results),
    );
  }

  getServiceExecutor(
    lookupAnchor: HeaderHash,
    serviceId: ServiceId,
    expectedCodeHash: CodeHash,
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
  private readonly pvm: PvmHostCallExtension;
  private hostCalls = new HostCalls();
  private pvmInstanceManager = new PvmInstanceManager(4);

  constructor(private serviceCode: BytesBlob) {
    this.pvm = new PvmHostCallExtension(this.pvmInstanceManager, this.hostCalls);
  }

  async run(args: BytesBlob, gas: ServiceGas): Promise<BytesBlob> {
    const program = Program.fromSpi(this.serviceCode.buffer, args.buffer);

    const result = await this.pvm.runProgram(program.code, 5, gas as U64 as Gas, program.registers, program.memory);
    if (!result || !(result instanceof Uint8Array)) {
      return BytesBlob.fromNumbers([]);
    }
    return BytesBlob.from(result);
  }
}
