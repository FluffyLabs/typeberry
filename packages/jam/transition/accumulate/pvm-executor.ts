import type { BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { Assign } from "@typeberry/jam-host-calls/accumulate/assign";
import { Bless } from "@typeberry/jam-host-calls/accumulate/bless";
import { Checkpoint } from "@typeberry/jam-host-calls/accumulate/checkpoint";
import { Designate } from "@typeberry/jam-host-calls/accumulate/designate";
import { Eject } from "@typeberry/jam-host-calls/accumulate/eject";
import { Forget } from "@typeberry/jam-host-calls/accumulate/forget";
import { New } from "@typeberry/jam-host-calls/accumulate/new";
import { Provide } from "@typeberry/jam-host-calls/accumulate/provide";
import { Query } from "@typeberry/jam-host-calls/accumulate/query";
import { Solicit } from "@typeberry/jam-host-calls/accumulate/solicit";
import { Transfer } from "@typeberry/jam-host-calls/accumulate/transfer";
import { Upgrade } from "@typeberry/jam-host-calls/accumulate/upgrade";
import { Yield } from "@typeberry/jam-host-calls/accumulate/yield";
import type { PartialState } from "@typeberry/jam-host-calls/externalities/partial-state";
import { type ProgramCounter, tryAsProgramCounter } from "@typeberry/jam-host-calls/externalities/refine-externalities";
import { Fetch, type FetchExternalities } from "@typeberry/jam-host-calls/fetch";
import { GasHostCall } from "@typeberry/jam-host-calls/gas";
import { type AccountsInfo, Info } from "@typeberry/jam-host-calls/info";
import { type AccountsLookup, Lookup } from "@typeberry/jam-host-calls/lookup";
import { type AccountsRead, Read } from "@typeberry/jam-host-calls/read";
import { type AccountsWrite, Write } from "@typeberry/jam-host-calls/write";
import { type HostCallHandler, HostCalls, PvmHostCallExtension, PvmInstanceManager } from "@typeberry/pvm-host-calls";
import type { Gas } from "@typeberry/pvm-interpreter";
import { Program } from "@typeberry/pvm-program";

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
  accountsRead: AccountsRead;
  accountsWrite: AccountsWrite;
  fetchExternalities: FetchExternalities;
  accountsInfo: AccountsInfo;
  accountsLookup: AccountsLookup;
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
  private pvmInstanceManager = new PvmInstanceManager(4);

  private constructor(
    private serviceCode: BytesBlob,
    hostCallHandlers: HostCallHandler[],
    private entrypoint: ProgramCounter,
  ) {
    this.hostCalls = new HostCalls(...hostCallHandlers);
    this.pvm = new PvmHostCallExtension(this.pvmInstanceManager, this.hostCalls);
  }

  /** Prepare accumulation host call handlers */
  private static prepareAccumulateHostCalls(externalities: AccumulateHostCallExternalities, chainSpec: ChainSpec) {
    const accumulateHandlers: HostCallHandler[] = ACCUMULATE_HOST_CALL_CLASSES.map(
      (HandlerClass) => new HandlerClass(externalities.partialState, chainSpec),
    );

    const generalHandlers: HostCallHandler[] = [
      new GasHostCall(),
      new Read(externalities.accountsRead),
      new Write(externalities.accountsWrite),
      new Fetch(externalities.fetchExternalities),
      new Lookup(externalities.accountsLookup),
      new Info(externalities.accountsInfo),
    ];

    return accumulateHandlers.concat(generalHandlers);
  }

  /**
   * Execute provided program
   *
   * @param args additional arguments that will be placed in PVM memory before execution
   * @param gas gas limit
   * @returns `ReturnValue` object that can be a status or memory slice
   */
  async run(args: BytesBlob, gas: Gas) {
    const program = Program.fromSpi(this.serviceCode.raw, args.raw, true);

    return this.pvm.runProgram(program.code, Number(this.entrypoint), gas, program.registers, program.memory);
  }

  /** A utility function that can be used to prepare accumulate executor */
  static createAccumulateExecutor(
    serviceCode: BytesBlob,
    externalities: AccumulateHostCallExternalities,
    chainSpec: ChainSpec,
  ) {
    const hostCallHandlers = PvmExecutor.prepareAccumulateHostCalls(externalities, chainSpec);
    return new PvmExecutor(serviceCode, hostCallHandlers, entrypoint.ACCUMULATE);
  }
}
