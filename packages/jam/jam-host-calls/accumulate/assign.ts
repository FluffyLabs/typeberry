import { tryAsCoreIndex } from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants";
import { Decoder, codec } from "@typeberry/codec";
import { FixedSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler, IHostCallMemory } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import type { IHostCallRegisters } from "@typeberry/pvm-host-calls/host-call-registers";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;

/**
 * Assign new fixed-length authorization queue to some core.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/311702311702
 */
export class Assign implements HostCallHandler {
  index = tryAsHostCallIndex(6);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(
    private readonly partialState: AccumulationPartialState,
    private readonly chainSpec: ChainSpec,
  ) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    const coreIndex = regs.get(IN_OUT_REG);
    // o
    const authorizationQueueStart = regs.get(8);

    const res = new Uint8Array(HASH_SIZE * AUTHORIZATION_QUEUE_SIZE);
    const memoryReadResult = memory.loadInto(res, authorizationQueueStart);
    // error while reading the memory.
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    // the core is unknown
    if (coreIndex >= this.chainSpec.coresCount) {
      regs.set(IN_OUT_REG, HostCallResult.CORE);
      return;
    }

    const d = Decoder.fromBlob(res);
    const authQueue = d.sequenceFixLen(codec.bytes(HASH_SIZE), AUTHORIZATION_QUEUE_SIZE);
    const fixedSizeAuthQueue = FixedSizeArray.new(authQueue, AUTHORIZATION_QUEUE_SIZE);

    regs.set(IN_OUT_REG, HostCallResult.OK);
    this.partialState.updateAuthorizationQueue(tryAsCoreIndex(Number(coreIndex)), fixedSizeAuthQueue);
    return;
  }
}
