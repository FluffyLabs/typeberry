import assert from "node:assert";
import { describe, it } from "node:test";
import { type CodeHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type U32, type U64, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { LegacyHostCallResult } from "../results";
import { New } from "./new";
import { TestAccumulate } from "./partial-state.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const CODE_HASH_START_REG = 7;
const CODE_LENGTH_REG = 8;
const GAS_LOW_REG = 9;
const GAS_HIG_REG = 10;
const BALANCE_LOW_REG = 11;
const BALANCE_HIG_REG = 12;

const u64AsParts = (v: U64) => {
  const lower = v & (2n ** 32n - 1n);
  const upper = v >> 32n;

  return {
    lower: tryAsU32(Number(lower)),
    upper: tryAsU32(Number(upper)),
  };
};

function prepareRegsAndMemory(
  codeHash: CodeHash,
  codeLength: U32,
  gas: U64,
  balance: U64,
  { skipCodeHash = false }: { skipCodeHash?: boolean } = {},
) {
  const memStart = 2 ** 16;
  const registers = new Registers();
  registers.setU32(CODE_HASH_START_REG, memStart);
  registers.setU32(CODE_LENGTH_REG, codeLength);
  registers.setU32(GAS_LOW_REG, u64AsParts(gas).lower);
  registers.setU32(GAS_HIG_REG, u64AsParts(gas).upper);
  registers.setU32(BALANCE_LOW_REG, u64AsParts(balance).lower);
  registers.setU32(BALANCE_HIG_REG, u64AsParts(balance).upper);

  const builder = new MemoryBuilder();

  if (!skipCodeHash) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), codeHash.raw);
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory,
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
    assert.deepStrictEqual(registers.getU32(RESULT_REG), tryAsServiceId(23_000));
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
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.CASH);
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
    await n.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OOB);
    assert.deepStrictEqual(accumulate.newServiceCalled, []);
  });
});
