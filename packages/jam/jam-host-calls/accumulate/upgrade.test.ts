import assert from "node:assert";
import { describe, it } from "node:test";
import { type CodeHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type U64, tryAsU64, u64IntoParts } from "@typeberry/numbers";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { LegacyHostCallResult } from "../results";
import { TestAccumulate } from "./partial-state.test";
import { Upgrade } from "./upgrade";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const CODE_HASH_START_REG = 7;
const GAS_HIG_REG = 8;
const GAS_LOW_REG = 9;
const BALANCE_HIG_REG = 10;
const BALANCE_LOW_REG = 11;

function prepareRegsAndMemory(
  codeHash: CodeHash,
  gas: U64,
  balance: U64,
  { skipCodeHash = false }: { skipCodeHash?: boolean } = {},
) {
  const memStart = 2 ** 16;
  const registers = Registers.new();
  registers.setU32(CODE_HASH_START_REG, memStart);
  registers.setU32(GAS_LOW_REG, u64IntoParts(gas).lower);
  registers.setU32(GAS_HIG_REG, u64IntoParts(gas).upper);
  registers.setU32(BALANCE_LOW_REG, u64IntoParts(balance).lower);
  registers.setU32(BALANCE_HIG_REG, u64IntoParts(balance).upper);

  const builder = new MemoryBuilder();

  if (!skipCodeHash) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), codeHash.raw);
  }
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory,
  };
}

describe("HostCalls: Upgrade", () => {
  it("should upgrade a service", async () => {
    const accumulate = new TestAccumulate();
    const upgrade = new Upgrade(accumulate);
    upgrade.currentServiceId = tryAsServiceId(10_000);
    const { registers, memory } = prepareRegsAndMemory(
      Bytes.fill(HASH_SIZE, 0x69).asOpaque(),
      tryAsU64(2n ** 40n),
      tryAsU64(2n ** 50n),
    );

    // when
    await upgrade.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OK);
    assert.deepStrictEqual(accumulate.upgradeData, [[Bytes.fill(HASH_SIZE, 0x69), 2n ** 40n, 2n ** 50n]]);
  });

  it("should fail when code not readable", async () => {
    const accumulate = new TestAccumulate();
    const upgrade = new Upgrade(accumulate);
    upgrade.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(
      Bytes.fill(HASH_SIZE, 0x69).asOpaque(),
      tryAsU64(2n ** 40n),
      tryAsU64(2n ** 50n),
      { skipCodeHash: true },
    );

    // when
    await upgrade.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OOB);
    assert.deepStrictEqual(accumulate.upgradeData, []);
  });
});
