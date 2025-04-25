import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, tryAsExactBytes } from "@typeberry/codec";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { ServiceAccountInfo } from "@typeberry/state";
import { type Accounts, Info, codecServiceAccountInfoWithThresholdBalance } from "./info";
import { HostCallResult } from "./results";

class TestAccounts implements Accounts {
  public readonly data = new Map<ServiceId, ServiceAccountInfo>();

  getInfo(serviceId: ServiceId): Promise<ServiceAccountInfo | null> {
    return Promise.resolve(this.data.get(serviceId) ?? null);
  }
}

const SERVICE_ID_REG = 7;
const RESULT_REG = SERVICE_ID_REG;
const DEST_START_REG = 8;

const gas = gasCounter(tryAsGas(0));

function prepareRegsAndMemory(
  serviceId: ServiceId,
  accountInfoLength = tryAsExactBytes(codecServiceAccountInfoWithThresholdBalance.sizeHint),
) {
  const pageStart = 2 ** 16;
  const memStart = pageStart + PAGE_SIZE - accountInfoLength - 1;
  const registers = new HostCallRegisters(new Registers());
  registers.set(SERVICE_ID_REG, tryAsU64(serviceId));
  registers.set(DEST_START_REG, tryAsU64(memStart));

  const builder = new MemoryBuilder();
  builder.setWriteablePages(tryAsMemoryIndex(pageStart), tryAsMemoryIndex(pageStart + PAGE_SIZE));
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
    readInfo: () => {
      const result = new Uint8Array(accountInfoLength);
      assert.strictEqual(memory.loadInto(result, tryAsMemoryIndex(memStart)).isOk, true);
      const data = BytesBlob.blobFrom(result);
      return Decoder.decodeObject(codecServiceAccountInfoWithThresholdBalance, data);
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
      ServiceAccountInfo.fromCodec({
        codeHash: Bytes.fill(32, 5).asOpaque(),
        balance: tryAsU64(150_000),
        accumulateMinGas: tryAsGas(0n),
        onTransferMinGas: tryAsGas(0n),
        storageUtilisationBytes,
        storageUtilisationCount,
      }),
    );

    // when
    await info.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(readInfo(), {
      ...accounts.data.get(serviceId),
      thresholdBalance: 20_100n,
    });
  });

  it("should write none if account info is missing", async () => {
    const accounts = new TestAccounts();
    const info = new Info(accounts);
    const serviceId = tryAsServiceId(10_000);
    const { registers, memory } = prepareRegsAndMemory(serviceId);

    // when
    await info.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.NONE);
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
      ServiceAccountInfo.fromCodec({
        codeHash: Bytes.fill(32, 5).asOpaque(),
        balance: tryAsU64(150_000),
        accumulateMinGas: tryAsGas(0n),
        onTransferMinGas: tryAsGas(0n),
        storageUtilisationBytes,
        storageUtilisationCount,
      }),
    );

    // when
    await info.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OOB);
  });
});
