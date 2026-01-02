//TODO ToDr merge any changes with the generic executor
import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { ChainSpec, PvmBackend } from "@typeberry/config";
import { accumulate, general } from "@typeberry/jam-host-calls";
import type { PartialState } from "@typeberry/jam-host-calls/externalities/partial-state.js";
import {
  type ProgramCounter,
  tryAsProgramCounter,
} from "@typeberry/jam-host-calls/externalities/refine-externalities.js";
import { type HostCallHandler, HostCalls, PvmHostCallExtension, PvmInstanceManager } from "@typeberry/pvm-host-calls";
import type { Gas } from "@typeberry/pvm-interface";

const ACCUMULATE_HOST_CALL_CLASSES = [
  accumulate.Bless,
  accumulate.Assign,
  accumulate.Designate,
  accumulate.Checkpoint,
  accumulate.New,
  accumulate.Upgrade,
  accumulate.Transfer,
  accumulate.Eject,
  accumulate.Query,
  accumulate.Solicit,
  accumulate.Forget,
  accumulate.Yield,
  accumulate.Provide,
];

type AccumulateHostCallExternalities = {
  partialState: PartialState;
  fetchExternalities: general.IFetchExternalities;
  serviceExternalities: general.AccountsInfo & general.AccountsLookup & general.AccountsWrite & general.AccountsRead;
};

type OnTransferHostCallExternalities = {
  partialState: general.AccountsInfo & general.AccountsLookup & general.AccountsWrite & general.AccountsRead;
  fetchExternalities: general.IFetchExternalities;
};

namespace entrypoint {
  export const IS_AUTHORIZED = tryAsProgramCounter(0);
  export const REFINE = tryAsProgramCounter(0);
  export const ACCUMULATE = tryAsProgramCounter(5);
  export const ON_TRANSFER = tryAsProgramCounter(10);
}

/**
 * PVM exectutor class that prepares PVM together with host call handlers to be run in requested context
 */
export class PvmExecutor {
  private readonly pvm: PvmHostCallExtension;
  private hostCalls: HostCalls;

  private constructor(
    private serviceCode: BytesBlob,
    hostCallHandlers: HostCallHandler[],
    private entrypoint: ProgramCounter,
    pvmInstanceManager: PvmInstanceManager,
  ) {
    this.hostCalls = new HostCalls({
      missing: new general.Missing(),
      handlers: hostCallHandlers,
    });
    this.pvm = new PvmHostCallExtension(pvmInstanceManager, this.hostCalls);
  }

  private static async prepareBackend(pvm: PvmBackend) {
    return PvmInstanceManager.new(pvm);
  }

  /** Prepare accumulation host call handlers */
  private static prepareAccumulateHostCalls(
    serviceId: ServiceId,
    externalities: AccumulateHostCallExternalities,
    chainSpec: ChainSpec,
  ) {
    const accumulateHandlers: HostCallHandler[] = ACCUMULATE_HOST_CALL_CLASSES.map(
      (HandlerClass) => new HandlerClass(serviceId, externalities.partialState, chainSpec),
    );

    const generalHandlers: HostCallHandler[] = [
      new general.LogHostCall(serviceId),
      new general.GasHostCall(serviceId),
      new general.Read(serviceId, externalities.serviceExternalities),
      new general.Write(serviceId, externalities.serviceExternalities),
      new general.Fetch(serviceId, externalities.fetchExternalities),
      new general.Lookup(serviceId, externalities.serviceExternalities),
      new general.Info(serviceId, externalities.serviceExternalities),
    ];

    return accumulateHandlers.concat(generalHandlers);
  }

  /** Prepare on transfer host call handlers */
  private static prepareOnTransferHostCalls(serviceId: ServiceId, externalities: OnTransferHostCallExternalities) {
    const generalHandlers: HostCallHandler[] = [
      new general.LogHostCall(serviceId),
      new general.GasHostCall(serviceId),
      new general.Fetch(serviceId, externalities.fetchExternalities),
      new general.Read(serviceId, externalities.partialState),
      new general.Write(serviceId, externalities.partialState),
      new general.Lookup(serviceId, externalities.partialState),
      new general.Info(serviceId, externalities.partialState),
    ];

    return generalHandlers;
  }
  /**
   * Execute provided program
   *
   * @param args additional arguments that will be placed in PVM memory before execution
   * @param gas gas limit
   * @returns `ReturnValue` object that can be a status or memory slice
   */
  async run(args: BytesBlob, gas: Gas) {
    return this.pvm.runProgram(this.serviceCode.raw, args.raw, Number(this.entrypoint), gas);
  }

  /** A utility function that can be used to prepare accumulate executor */
  static async createAccumulateExecutor(
    serviceId: ServiceId,
    serviceCode: BytesBlob,
    externalities: AccumulateHostCallExternalities,
    chainSpec: ChainSpec,
    pvm: PvmBackend,
  ) {
    const hostCallHandlers = PvmExecutor.prepareAccumulateHostCalls(serviceId, externalities, chainSpec);
    const instances = await PvmExecutor.prepareBackend(pvm);
    return new PvmExecutor(serviceCode, hostCallHandlers, entrypoint.ACCUMULATE, instances);
  }

  /** A utility function that can be used to prepare on transfer executor */
  static async createOnTransferExecutr(
    serviceId: ServiceId,
    serviceCode: BytesBlob,
    externalities: OnTransferHostCallExternalities,
    pvm: PvmBackend,
  ) {
    const hostCallHandlers = PvmExecutor.prepareOnTransferHostCalls(serviceId, externalities);
    const instances = await PvmExecutor.prepareBackend(pvm);
    return new PvmExecutor(serviceCode, hostCallHandlers, entrypoint.ON_TRANSFER, instances);
  }
}
