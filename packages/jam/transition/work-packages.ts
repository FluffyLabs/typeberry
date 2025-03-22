import { type CodeHash, type HeaderHash, type ServiceId, tryAsCoreIndex } from "@typeberry/block";
import { type WorkPackage, tryAsWorkItemsCount } from "@typeberry/block/work-package";
import { WorkPackageSpec, WorkReport } from "@typeberry/block/work-report";
import { WorkExecResult, WorkExecResultKind, WorkResult } from "@typeberry/block/work-result";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray } from "@typeberry/collections";
import { HASH_SIZE, blake2b } from "@typeberry/hash";
import { type U16, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { HostCalls, PvmHostCallExtension, PvmInstanceManager } from "@typeberry/pvm-host-calls";
import { type Gas, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { Program } from "@typeberry/pvm-program";
import { Result, asOpaqueType } from "@typeberry/utils";
import type { BlocksDb, StateDb } from "../database";
import type { TransitionHasher } from "./hasher";

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

    if (authExec.isError) {
      // TODO [ToDr] most likely shouldn't be throw.
      throw new Error(`Could not get authorization executor: ${authExec.error}`);
    }

    const pvm = authExec.ok;
    const authGas = tryAsGas(15_000n);
    const result = await pvm.run(pack.parametrization, authGas);

    if (!result.isEqualTo(pack.authorization)) {
      throw new Error("Authorization is invalid.");
    }

    const results: WorkResult[] = [];
    for (const item of pack.items) {
      const exec = this.getServiceExecutor(headerHash, item.service, item.codeHash);
      if (exec.isError) {
        throw new Error(`Could not get item executor: ${exec.error}`);
      }
      const pvm = exec.ok;

      const gasRatio = asOpaqueType(tryAsU64(3_000n));
      const ret = await pvm.run(item.payload, tryAsGas(item.refineGasLimit)); // or accumulateGasLimit?
      results.push(
        new WorkResult(
          item.service,
          item.codeHash,
          blake2b.hashBytes(item.payload),
          gasRatio,
          new WorkExecResult(WorkExecResultKind.ok, ret),
        ),
      );
    }

    const workPackage = this.hasher.workPackage(pack);
    const workPackageSpec = new WorkPackageSpec(
      workPackage.hash,
      tryAsU32(workPackage.encoded.length),
      Bytes.zero(HASH_SIZE),
      Bytes.zero(HASH_SIZE).asOpaque(),
      0 as U16,
    );
    const coreIndex = tryAsCoreIndex(0);
    const authorizerHash = Bytes.fill(HASH_SIZE, 5).asOpaque();

    const workResults = FixedSizeArray.new(results, tryAsWorkItemsCount(results.length));

    return Promise.resolve(
      new WorkReport(workPackageSpec, pack.context, coreIndex, authorizerHash, pack.authorization, [], workResults),
    );
  }

  getServiceExecutor(
    lookupAnchor: HeaderHash,
    serviceId: ServiceId,
    expectedCodeHash: CodeHash,
  ): Result<PvmExecutor, ServiceExecutorError> {
    const header = this.blocks.getHeader(lookupAnchor);
    if (header == null) {
      return Result.error(ServiceExecutorError.NoLookup);
    }

    // TODO [ToDr] we should probably store posteriorStateRoots in the blocks db.
    const state = this.state.stateAt(header.priorStateRoot.materialize());
    if (state == null) {
      return Result.error(ServiceExecutorError.NoState);
    }

    const serviceCode = state.getServiceCode(serviceId);
    if (serviceCode == null) {
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

  async run(args: BytesBlob, gas: Gas): Promise<BytesBlob> {
    const program = Program.fromSpi(this.serviceCode.raw, args.raw);

    const result = await this.pvm.runProgram(program.code, 5, gas, program.registers, program.memory);
    if (!(result instanceof Uint8Array)) {
      return BytesBlob.blobFromNumbers([]);
    }
    return BytesBlob.blobFrom(result);
  }
}
