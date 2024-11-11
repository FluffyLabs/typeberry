import assert from "node:assert";
import { describe, it } from "node:test";
import { type CodeHash, type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, tryAsExactBytes } from "@typeberry/codec";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { Registers } from "@typeberry/pvm-interpreter";
import { type Gas, gasCounter } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { AccountInfo, type Accounts, Info } from "./info";
import { HostCallResult } from "./results";

class TestAccounts implements Accounts {
  public readonly data = new Map<ServiceId, AccountInfo>();

  getInfo(serviceId: ServiceId): Promise<AccountInfo | null> {
    return Promise.resolve(this.data.get(serviceId) ?? null);
  }
}

const SERVICE_ID_REG = 7;
const RESULT_REG = SERVICE_ID_REG;
const DEST_START_REG = 8;

const gas = gasCounter(0 as Gas);

function prepareRegsAndMemory(serviceId: ServiceId, accountInfoLength = tryAsExactBytes(AccountInfo.Codec.sizeHint)) {
  const memStart = 20_000;
  const registers = new Registers();
  registers.asUnsigned[SERVICE_ID_REG] = serviceId;
  registers.asUnsigned[DEST_START_REG] = memStart;

  const builder = new MemoryBuilder();
  builder.setWriteable(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + accountInfoLength));
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsMemoryIndex(0));
  return {
    registers,
    memory,
    readInfo: () => {
      const result = new Uint8Array(accountInfoLength);
      assert.strictEqual(memory.loadInto(result, tryAsMemoryIndex(memStart)), null);
      const data = BytesBlob.from(result);
      return Decoder.decodeObject(AccountInfo.Codec, data);
    },
  };
}

describe("HostCalls: Info", () => {
  it("should write account info data into memory", async () => {
    const accounts = new TestAccounts();
    const info = new Info(accounts);
    const serviceId = tryAsServiceId(10_000);
    info.currentServiceId = serviceId;
    const { registers, memory, readInfo } = prepareRegsAndMemory(serviceId);
    const storageUtilisationBytes = tryAsU64(10_000);
    const storageUtilisationCount = tryAsU32(1_000);
    accounts.data.set(
      serviceId,
      AccountInfo.fromCodec({
        codeHash: Bytes.fill(32, 5) as CodeHash,
        balance: tryAsU64(150_000),
        thresholdBalance: AccountInfo.calculateThresholdBalance(storageUtilisationCount, storageUtilisationBytes),
        accumulateMinGas: 0n as Gas,
        onTransferMinGas: 0n as Gas,
        storageUtilisationBytes,
        storageUtilisationCount,
      }),
    );

    // when
    await info.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OK);
    assert.deepStrictEqual(readInfo(), accounts.data.get(serviceId));
  });

  it("should write none if account info is missing", async () => {
    const accounts = new TestAccounts();
    const info = new Info(accounts);
    const serviceId = tryAsServiceId(10_000);
    const { registers, memory } = prepareRegsAndMemory(serviceId);

    // when
    await info.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.NONE);
  });

  it("should write OOB if not enough memory allocated", async () => {
    const accounts = new TestAccounts();
    const info = new Info(accounts);
    const serviceId = tryAsServiceId(10_000);
    info.currentServiceId = serviceId;
    const { registers, memory } = prepareRegsAndMemory(serviceId, 10);
    const storageUtilisationBytes = tryAsU64(10_000);
    const storageUtilisationCount = tryAsU32(1_000);
    accounts.data.set(
      serviceId,
      AccountInfo.fromCodec({
        codeHash: Bytes.fill(32, 5) as CodeHash,
        balance: tryAsU64(150_000),
        thresholdBalance: AccountInfo.calculateThresholdBalance(storageUtilisationCount, storageUtilisationBytes),
        accumulateMinGas: 0n as Gas,
        onTransferMinGas: 0n as Gas,
        storageUtilisationBytes,
        storageUtilisationCount,
      }),
    );

    // when
    await info.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
  });
});
