import { tryAsCoreIndex } from "@typeberry/block";
import { Decoder, codec } from "@typeberry/codec";
import { FixedSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type Memory,
  type PvmExecution,
  type Registers,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { AUTHORIZATION_QUEUE_SIZE, type AccumulationPartialState } from "./partial-state";

const IN_OUT_REG = 7;

/**
 * Assign new fixed-length authorization queue to some core.
 *
 * https://graypaper.fluffylabs.dev/#/364735a/2ebf002ebf00
 */
export class Assign implements HostCallHandler {
  index = tryAsHostCallIndex(6);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(
    private readonly partialState: AccumulationPartialState,
    private readonly chainSpec: ChainSpec,
  ) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<undefined | PvmExecution> {
    const coreIndex = regs.asUnsigned[IN_OUT_REG];
    // o
    const authorizationQueueStart = tryAsMemoryIndex(regs.asUnsigned[8]);

    const res = new Uint8Array(HASH_SIZE * AUTHORIZATION_QUEUE_SIZE);
    const pageFault = memory.loadInto(res, authorizationQueueStart);
    // page fault while reading the memory.
    if (pageFault !== null) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.OOB;
      return;
    }

    // the core is unknown
    if (coreIndex >= this.chainSpec.coresCount) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.CORE;
      return;
    }

    const d = Decoder.fromBlob(res);
    const authQueue = d.sequenceFixLen(codec.bytes(HASH_SIZE), AUTHORIZATION_QUEUE_SIZE);
    const fixedSizeAuthQueue = FixedSizeArray.new(authQueue, AUTHORIZATION_QUEUE_SIZE);

    regs.asUnsigned[IN_OUT_REG] = HostCallResult.OK;
    this.partialState.updateAuthorizationQueue(tryAsCoreIndex(coreIndex), fixedSizeAuthQueue);
    return;
  }
}
