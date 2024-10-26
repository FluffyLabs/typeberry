import { Bytes, BytesBlob } from "@typeberry/bytes";
import { hashBytes } from "@typeberry/hash";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import type { HostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import type { GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas";
import type { Memory } from "@typeberry/pvm-interpreter/memory";
import { createMemoryIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import type { Registers } from "@typeberry/pvm-interpreter/registers";

export class Lookup implements HostCallHandler {
  index = 1 as HostCallIndex;
  gasCost = 10 as SmallGas;

  execute(gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // h_0
    const hashStartAddress = regs.asUnsigned[8];
    // b_0
    const destinationStart = regs.asUnsigned[9];
    // b_z
    const destinationEnd = regs.asUnsigned[10];

    const hash = Bytes.zero(32);
    memory.loadInto(hash.raw, createMemoryIndex(hashStartAddress));
    // TODO [ToDr] Remove conversion, after #141
    const keyHash = hashBytes(BytesBlob.fromBlob(hash.raw));
    return Promise.resolve();
  }
}
