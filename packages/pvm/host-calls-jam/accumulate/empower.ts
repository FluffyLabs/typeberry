import { type CodeHash, HASH_SIZE, type ServiceId, WithDebug } from "@typeberry/block";
import { type CodecRecord, Encoder, codec } from "@typeberry/codec";
import type { U32, U64 } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import type { HostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import type { Gas, GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas";
import { type Memory, createMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { HostCallResult } from "./results";
import { getServiceId } from "./utils";

/** Account data interface for Info host call. */
export interface Accounts {
  /** Get account info. */
  getInfo(serviceId: ServiceId): Promise<AccountInfo | null>;
}

const IN_OUT_REG = 7;

export class Empower implements HostCallHandler {
  index = 4 as HostCallIndex;
  gasCost = 10 as SmallGas;
  currentServiceId = (2 ** 32 - 1) as ServiceId;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // t
    const serviceId = getServiceId(IN_OUT_REG, regs, this.currentServiceId);
    // o
    const outputStart = createMemoryIndex(regs.asUnsigned[8]);

    // t
    const accountInfo = await this.account.getInfo(serviceId);

    if (accountInfo === null) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.NONE;
      return Promise.resolve();
    }

    const encodedInfo = Encoder.encodeObject(AccountInfo.Codec, accountInfo);
    const writeOk = memory.storeFrom(outputStart, encodedInfo.buffer);

    regs.asUnsigned[IN_OUT_REG] = writeOk !== null ? HostCallResult.OOB : HostCallResult.OK;
    return Promise.resolve();
  }
}
