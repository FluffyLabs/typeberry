import { BytesBlob } from "@typeberry/bytes";
import { tryAsU32 } from "@typeberry/numbers";
import { type HostCallHandler, type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import {
  type GasCounter,
  type Memory,
  type Registers,
  tryAsMemoryIndex,
  tryAsSmallGas,
} from "@typeberry/pvm-interpreter";
import { LegacyHostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { RefineExternalities } from "./refine-externalities";

const IN_OUT_REG_1 = 7;
const IN_OUT_REG_2 = 8;

/**
 * Kick off a nested PVM instance with given program code and entrypoint (program counter).
 *
 * https://graypaper.fluffylabs.dev/#/85129da/363b00363b00?v=0.6.3
 */
export class Invoke implements HostCallHandler {
    index = tryAsHostCallIndex(25);
    gasCost = tryAsSmallGas(10);
    currentServiceId = CURRENT_SERVICE_ID;

    constructor(private readonly refine: RefineExternalities) {}

    async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
        // `n`
        const machineIndex = tryAsU32(regs.getU32(IN_OUT_REG_1));
        // `o`
        const destinationStart = tryAsMemoryIndex(regs.getU32(IN_OUT_REG_2));

        return;
    }
}