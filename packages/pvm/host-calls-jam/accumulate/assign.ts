import { tryAsCoreIndex } from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants";
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
import type { AccumulationPartialState } from "./partial-state";

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
    const coreIndex = regs.getU32(IN_OUT_REG);
    // o
    const authorizationQueueStart = tryAsMemoryIndex(regs.getU32(8));

    const res = new Uint8Array(HASH_SIZE * AUTHORIZATION_QUEUE_SIZE);
    const pageFault = memory.loadInto(res, authorizationQueueStart);
    // page fault while reading the memory.
    if (pageFault !== null) {
      regs.setU32(IN_OUT_REG, HostCallResult.OOB);
      return;
    }

    // the core is unknown
    if (coreIndex >= this.chainSpec.coresCount) {
      regs.setU32(IN_OUT_REG, HostCallResult.CORE);
      return;
    }

    const d = Decoder.fromBlob(res);
    const authQueue = d.sequenceFixLen(codec.bytes(HASH_SIZE), AUTHORIZATION_QUEUE_SIZE);
    const fixedSizeAuthQueue = FixedSizeArray.new(authQueue, AUTHORIZATION_QUEUE_SIZE);

    regs.setU32(IN_OUT_REG, HostCallResult.OK);
    this.partialState.updateAuthorizationQueue(tryAsCoreIndex(coreIndex), fixedSizeAuthQueue);
    return;
  }
}
