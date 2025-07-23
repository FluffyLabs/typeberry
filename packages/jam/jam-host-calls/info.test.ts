import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, tryAsExactBytes } from "@typeberry/codec";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas.js";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/index.js";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts.js";
import { ServiceAccountInfo } from "@typeberry/state";
import { Info, codecServiceAccountInfoWithThresholdBalance } from "./info.js";
import { HostCallResult } from "./results.js";
import { TestAccounts } from "./test-accounts.js";

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
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
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
    const serviceId = tryAsServiceId(10_000);
    const currentServiceId = serviceId;
    const accounts = new TestAccounts(currentServiceId);
    const info = new Info(currentServiceId, accounts);
    const { registers, memory, readInfo } = prepareRegsAndMemory(serviceId);
    const storageUtilisationBytes = tryAsU64(10_000);
    const storageUtilisationCount = tryAsU32(1_000);
    accounts.details.set(
      serviceId,
      ServiceAccountInfo.create({
        codeHash: Bytes.fill(32, 5).asOpaque(),
        balance: tryAsU64(150_000),
        accumulateMinGas: tryAsServiceGas(0n),
        onTransferMinGas: tryAsServiceGas(0n),
        storageUtilisationBytes,
        storageUtilisationCount,
        gratisStorageBytes: tryAsU64(0),
        created: tryAsTimeSlot(0),
        lastAccumulation: tryAsTimeSlot(0),
        parentService: tryAsServiceId(0),
      }),
    );

    // when
    const result = await info.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(readInfo(), {
      ...accounts.details.get(serviceId),
      thresholdBalance: 20_100n,
    });
  });

  it("should write none if account info is missing", async () => {
    const currentServiceId = tryAsServiceId(15_000);
    const accounts = new TestAccounts(currentServiceId);
    const info = new Info(currentServiceId, accounts);
    const serviceId = tryAsServiceId(10_000);
    const { registers, memory } = prepareRegsAndMemory(serviceId);

    // when
    const result = await info.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.NONE);
  });

  it("should panic if not enough memory allocated", async () => {
    const serviceId = tryAsServiceId(10_000);
    const currentServiceId = serviceId;
    const accounts = new TestAccounts(currentServiceId);
    const info = new Info(serviceId, accounts);
    const { registers, memory } = prepareRegsAndMemory(serviceId, 10);
    const storageUtilisationBytes = tryAsU64(10_000);
    const storageUtilisationCount = tryAsU32(1_000);
    accounts.details.set(
      serviceId,
      ServiceAccountInfo.create({
        codeHash: Bytes.fill(32, 5).asOpaque(),
        balance: tryAsU64(150_000),
        accumulateMinGas: tryAsServiceGas(0n),
        onTransferMinGas: tryAsServiceGas(0n),
        storageUtilisationBytes,
        storageUtilisationCount,
        gratisStorageBytes: tryAsU64(0),
        created: tryAsTimeSlot(0),
        lastAccumulation: tryAsTimeSlot(0),
        parentService: tryAsServiceId(0),
      }),
    );

    // when
    const result = await info.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, PvmExecution.Panic);
  });
});
