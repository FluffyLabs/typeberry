import assert from "node:assert";
import { describe, it } from "node:test";
import { type CodeHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type U32, type U64, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { HostCallResult } from "../results";
import { New } from "./new";
import { TestAccumulate } from "./partial-state.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const CODE_HASH_START_REG = 7;
const CODE_LENGTH_REG = 8;
const GAS_REG = 9;
const BALANCE_REG = 10;

function prepareRegsAndMemory(
  codeHash: CodeHash,
  codeLength: U32,
  gas: U64,
  balance: U64,
  { skipCodeHash = false }: { skipCodeHash?: boolean } = {},
) {
  const memStart = 2 ** 16;
  const registers = new HostCallRegisters(new Registers());
  registers.set(CODE_HASH_START_REG, tryAsU64(memStart));
  registers.set(CODE_LENGTH_REG, tryAsU64(codeLength));
  registers.set(GAS_REG, gas);
  registers.set(BALANCE_REG, balance);

  const builder = new MemoryBuilder();

  if (!skipCodeHash) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), codeHash.raw);
  }
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
  };
}

describe("HostCalls: New", () => {
  it("should create a new service", async () => {
    const accumulate = new TestAccumulate();
    const n = new New(accumulate);
    const serviceId = tryAsServiceId(10_000);
    n.currentServiceId = serviceId;
    accumulate.newServiceResponse = tryAsServiceId(23_000);
    const { registers, memory } = prepareRegsAndMemory(
      Bytes.fill(HASH_SIZE, 0x69).asOpaque(),
      tryAsU32(4_096),
      tryAsU64(2n ** 40n),
      tryAsU64(2n ** 50n),
    );

    // when
    await n.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(tryAsServiceId(Number(registers.get(RESULT_REG))), tryAsServiceId(23_000));
    assert.deepStrictEqual(accumulate.newServiceCalled, [
      [10_042, Bytes.fill(HASH_SIZE, 0x69), 4_096, 2n ** 40n, 2n ** 50n],
    ]);
  });

  it("should fail when balance is not enough", async () => {
    const accumulate = new TestAccumulate();
    const n = new New(accumulate);
    const serviceId = tryAsServiceId(10_000);
    n.currentServiceId = serviceId;
    accumulate.newServiceResponse = null;
    const { registers, memory } = prepareRegsAndMemory(
      Bytes.fill(HASH_SIZE, 0x69).asOpaque(),
      tryAsU32(4_096),
      tryAsU64(2n ** 40n),
      tryAsU64(2n ** 50n),
    );

    // when
    await n.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.CASH);
    assert.deepStrictEqual(accumulate.newServiceCalled.length, 1);
  });

  it("should fail when code not readable", async () => {
    const accumulate = new TestAccumulate();
    const n = new New(accumulate);
    const serviceId = tryAsServiceId(10_000);
    n.currentServiceId = serviceId;
    accumulate.newServiceResponse = null;
    const { registers, memory } = prepareRegsAndMemory(
      Bytes.fill(HASH_SIZE, 0x69).asOpaque(),
      tryAsU32(4_096),
      tryAsU64(2n ** 40n),
      tryAsU64(2n ** 50n),
      { skipCodeHash: true },
    );

    // when
    const result = await n.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accumulate.newServiceCalled, []);
  });
});
