import assert from "node:assert";
import { describe, it } from "node:test";
import { type CodeHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU64, type U64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas.js";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/index.js";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts.js";
import { Result } from "@typeberry/utils";
import { NewServiceError } from "../externalities/partial-state.js";
import { PartialStateMock } from "../externalities/partial-state-mock.js";
import { HostCallResult } from "../results.js";
import { New } from "./new.js";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const CODE_HASH_START_REG = 7;
const CODE_LENGTH_REG = 8;
const GAS_REG = 9;
const BALANCE_REG = 10;
const GRATIS_STORAGE_REG = 11;

function prepareRegsAndMemory(
  codeHash: CodeHash,
  codeLength: U64,
  gas: U64,
  balance: U64,
  gratisStorage: U64,
  { skipCodeHash = false }: { skipCodeHash?: boolean } = {},
) {
  const memStart = 2 ** 16;
  const registers = new HostCallRegisters(new Registers());
  registers.set(CODE_HASH_START_REG, tryAsU64(memStart));
  registers.set(CODE_LENGTH_REG, tryAsU64(codeLength));
  registers.set(GAS_REG, gas);
  registers.set(BALANCE_REG, balance);
  registers.set(GRATIS_STORAGE_REG, gratisStorage);

  const builder = new MemoryBuilder();

  if (!skipCodeHash) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), codeHash.raw);
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
  };
}

describe("HostCalls: New", () => {
  it("should create a new service", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const n = new New(serviceId, accumulate);
    accumulate.newServiceResponse = Result.ok(tryAsServiceId(23_000));
    const { registers, memory } = prepareRegsAndMemory(
      Bytes.fill(HASH_SIZE, 0x69).asOpaque(),
      tryAsU64(4_096n),
      tryAsU64(2n ** 40n),
      tryAsU64(2n ** 50n),
      tryAsU64(1_024n),
    );

    // when
    await n.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(tryAsServiceId(Number(registers.get(RESULT_REG))), tryAsServiceId(23_000));
    const gratisStorage = 1_024n;
    assert.deepStrictEqual(accumulate.newServiceCalled, [
      [Bytes.fill(HASH_SIZE, 0x69), 4_096n, 2n ** 40n, 2n ** 50n, gratisStorage],
    ]);
  });

  it("should fail when balance is not enough", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const n = new New(serviceId, accumulate);
    accumulate.newServiceResponse = Result.error(NewServiceError.InsufficientFunds);
    const { registers, memory } = prepareRegsAndMemory(
      Bytes.fill(HASH_SIZE, 0x69).asOpaque(),
      tryAsU64(4_096n),
      tryAsU64(2n ** 40n),
      tryAsU64(2n ** 50n),
      tryAsU64(1n),
    );

    // when
    await n.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.CASH);
    assert.deepStrictEqual(accumulate.newServiceCalled.length, 1);
  });

  it("should fail when code not readable", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const n = new New(serviceId, accumulate);
    const { registers, memory } = prepareRegsAndMemory(
      Bytes.fill(HASH_SIZE, 0x69).asOpaque(),
      tryAsU64(4_096n),
      tryAsU64(2n ** 40n),
      tryAsU64(2n ** 50n),
      tryAsU64(1_024n),
      { skipCodeHash: true },
    );

    // when
    const result = await n.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accumulate.newServiceCalled, []);
  });

  it("should fail when trying to set gratis storage by unprivileged service", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const n = new New(serviceId, accumulate);
    accumulate.newServiceResponse = Result.error(NewServiceError.UnprivilegedService);
    const { registers, memory } = prepareRegsAndMemory(
      Bytes.fill(HASH_SIZE, 0x69).asOpaque(),
      tryAsU64(4_096n),
      tryAsU64(2n ** 40n),
      tryAsU64(2n ** 50n),
      tryAsU64(1_024n),
    );

    // when
    await n.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
    assert.deepStrictEqual(accumulate.newServiceCalled.length, 1);
  });
});
