import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, tryAsExactBytes } from "@typeberry/codec";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { tryAsGas } from "@typeberry/pvm-interface";
import { gasCounter } from "@typeberry/pvm-interpreter";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/index.js";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts.js";
import { ServiceAccountInfo } from "@typeberry/state";
import { TestAccounts } from "./externalities/test-accounts.js";
import { codecServiceAccountInfoWithThresholdBalance, Info, LEN_REG } from "./info.js";
import { HostCallResult } from "./results.js";
import { emptyRegistersBuffer } from "./utils.js";

const SERVICE_ID_REG = 7;
const RESULT_REG = SERVICE_ID_REG;
const DEST_START_REG = 8;

const gas = gasCounter(tryAsGas(0));

const serviceAccountInfoSize = tryAsExactBytes(codecServiceAccountInfoWithThresholdBalance.sizeHint);

function prepareRegsAndMemory(serviceId: ServiceId, accountInfoLength = serviceAccountInfoSize) {
  const pageStart = 2 ** 16;
  const memStart = pageStart + PAGE_SIZE - accountInfoLength - 1;
  const registers = new HostCallRegisters(emptyRegistersBuffer());
  registers.set(SERVICE_ID_REG, tryAsU64(serviceId));
  registers.set(DEST_START_REG, tryAsU64(memStart));
  registers.set(LEN_REG, tryAsU64(serviceAccountInfoSize));

  const builder = new MemoryBuilder();
  builder.setWriteablePages(tryAsMemoryIndex(pageStart), tryAsMemoryIndex(pageStart + PAGE_SIZE));
  const memory = new HostCallMemory(builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0)));

  const readRaw = () => {
    const result = new Uint8Array(Number(registers.get(LEN_REG)));
    assert.strictEqual(memory.loadInto(result, tryAsU64(memStart)).isOk, true);
    return BytesBlob.blobFrom(result);
  };
  return {
    registers,
    memory,
    readRaw,
    readInfo: () => {
      const data = readRaw();
      return Decoder.decodeObject(codecServiceAccountInfoWithThresholdBalance, data);
    },
  };
}

describe("HostCalls: Info", () => {
  const serviceComp = {
    gratisStorage: tryAsU64(1024),
    created: tryAsTimeSlot(10),
    lastAccumulation: tryAsTimeSlot(15),
    parentService: tryAsServiceId(1),
  };

  it("should write account info data into memory", async () => {
    const serviceId = tryAsServiceId(10_000);
    const currentServiceId = serviceId;
    const accounts = new TestAccounts(currentServiceId);
    const info = new Info(currentServiceId, accounts);
    const { registers, memory, readInfo } = prepareRegsAndMemory(serviceId);
    const storageUtilisationBytes = tryAsU64(10_000);
    const storageUtilisationCount = tryAsU32(1_000);

    const thresholdBalance = ServiceAccountInfo.calculateThresholdBalance(
      storageUtilisationCount,
      storageUtilisationBytes,
      serviceComp.gratisStorage,
    );

    accounts.details.set(
      serviceId,
      ServiceAccountInfo.create({
        codeHash: Bytes.fill(32, 5).asOpaque(),
        balance: tryAsU64(150_000),
        accumulateMinGas: tryAsServiceGas(0n),
        onTransferMinGas: tryAsServiceGas(0n),
        storageUtilisationBytes,
        storageUtilisationCount,
        ...serviceComp,
      }),
    );

    // when
    const result = await info.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), 96n);
    assert.deepStrictEqual(readInfo(), {
      ...accounts.details.get(serviceId),
      thresholdBalance,
    });
  });

  it("should write ONLY PART of account info data into memory", async () => {
    const serviceId = tryAsServiceId(10_000);
    const currentServiceId = serviceId;
    const accounts = new TestAccounts(currentServiceId);
    const info = new Info(currentServiceId, accounts);
    const { registers, memory, readRaw } = prepareRegsAndMemory(serviceId);
    registers.set(LEN_REG, tryAsU64(10));
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
        ...serviceComp,
      }),
    );

    // when
    const result = await info.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), 96n);
    assert.deepStrictEqual(readRaw().toString(), "0x05050505050505050505");
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
        ...serviceComp,
      }),
    );

    // when
    const result = await info.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, PvmExecution.Panic);
  });
});
