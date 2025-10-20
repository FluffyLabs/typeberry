import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import type { PVMInterpreter } from "@typeberry/config-node";
import { Assign } from "@typeberry/jam-host-calls/accumulate/assign.js";
import { Bless } from "@typeberry/jam-host-calls/accumulate/bless.js";
import { Checkpoint } from "@typeberry/jam-host-calls/accumulate/checkpoint.js";
import { Designate } from "@typeberry/jam-host-calls/accumulate/designate.js";
import { Eject } from "@typeberry/jam-host-calls/accumulate/eject.js";
import { Forget } from "@typeberry/jam-host-calls/accumulate/forget.js";
import { New } from "@typeberry/jam-host-calls/accumulate/new.js";
import { Provide } from "@typeberry/jam-host-calls/accumulate/provide.js";
import { Query } from "@typeberry/jam-host-calls/accumulate/query.js";
import { Solicit } from "@typeberry/jam-host-calls/accumulate/solicit.js";
import { Transfer } from "@typeberry/jam-host-calls/accumulate/transfer.js";
import { Upgrade } from "@typeberry/jam-host-calls/accumulate/upgrade.js";
import { Yield } from "@typeberry/jam-host-calls/accumulate/yield.js";
import type { PartialState } from "@typeberry/jam-host-calls/externalities/partial-state.js";
import {
  type ProgramCounter,
  tryAsProgramCounter,
} from "@typeberry/jam-host-calls/externalities/refine-externalities.js";
import { Fetch, type IFetchExternalities } from "@typeberry/jam-host-calls/fetch.js";
import { GasHostCall } from "@typeberry/jam-host-calls/gas.js";
import { type AccountsInfo, Info } from "@typeberry/jam-host-calls/info.js";
import { LogHostCall } from "@typeberry/jam-host-calls/log.js";
import { type AccountsLookup, Lookup } from "@typeberry/jam-host-calls/lookup.js";
import { Missing } from "@typeberry/jam-host-calls/missing.js";
import { type AccountsRead, Read } from "@typeberry/jam-host-calls/read.js";
import { type AccountsWrite, Write } from "@typeberry/jam-host-calls/write.js";
import { type HostCallHandler, HostCalls, PvmHostCallExtension, PvmInstanceManager } from "@typeberry/pvm-host-calls";
import type { Gas } from "@typeberry/pvm-interface";

const ACCUMULATE_HOST_CALL_CLASSES = [
  Bless,
  Assign,
  Designate,
  Checkpoint,
  New,
  Upgrade,
  Transfer,
  Eject,
  Query,
  Solicit,
  Forget,
  Yield,
  Provide,
];

type AccumulateHostCallExternalities = {
  partialState: PartialState;
  fetchExternalities: IFetchExternalities;
  serviceExternalities: AccountsInfo & AccountsLookup & AccountsWrite & AccountsRead;
};

type OnTransferHostCallExternalities = {
  partialState: AccountsInfo & AccountsLookup & AccountsWrite & AccountsRead;
  fetchExternalities: IFetchExternalities;
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
  private pvmInstanceManager;

  private constructor(
    private serviceCode: BytesBlob,
    hostCallHandlers: HostCallHandler[],
    private entrypoint: ProgramCounter,
    pvmInterpreter: PVMInterpreter,
  ) {
    this.pvmInstanceManager = new PvmInstanceManager(4, pvmInterpreter);
    this.hostCalls = new HostCalls({
      missing: new Missing(),
      handlers: hostCallHandlers,
    });
    this.pvm = new PvmHostCallExtension(this.pvmInstanceManager, this.hostCalls);
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
      new LogHostCall(serviceId),
      new GasHostCall(serviceId),
      new Read(serviceId, externalities.serviceExternalities),
      new Write(serviceId, externalities.serviceExternalities),
      new Fetch(serviceId, externalities.fetchExternalities),
      new Lookup(serviceId, externalities.serviceExternalities),
      new Info(serviceId, externalities.serviceExternalities),
    ];

    return accumulateHandlers.concat(generalHandlers);
  }

  /** Prepare on transfer host call handlers */
  private static prepareOnTransferHostCalls(serviceId: ServiceId, externalities: OnTransferHostCallExternalities) {
    const generalHandlers: HostCallHandler[] = [
      new LogHostCall(serviceId),
      new GasHostCall(serviceId),
      new Fetch(serviceId, externalities.fetchExternalities),
      new Read(serviceId, externalities.partialState),
      new Write(serviceId, externalities.partialState),
      new Lookup(serviceId, externalities.partialState),
      new Info(serviceId, externalities.partialState),
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
  static createAccumulateExecutor(
    serviceId: ServiceId,
    serviceCode: BytesBlob,
    externalities: AccumulateHostCallExternalities,
    chainSpec: ChainSpec,
    pvm: PVMInterpreter,
  ) {
    const hostCallHandlers = PvmExecutor.prepareAccumulateHostCalls(serviceId, externalities, chainSpec);
    return new PvmExecutor(serviceCode, hostCallHandlers, entrypoint.ACCUMULATE, pvm);
  }

  /** A utility function that can be used to prepare on transfer executor */
  static createOnTransferExecutor(
    serviceId: ServiceId,
    serviceCode: BytesBlob,
    externalities: OnTransferHostCallExternalities,
    pvm: PVMInterpreter,
  ) {
    const hostCallHandlers = PvmExecutor.prepareOnTransferHostCalls(serviceId, externalities);
    return new PvmExecutor(serviceCode, hostCallHandlers, entrypoint.ON_TRANSFER, pvm);
  }
}
