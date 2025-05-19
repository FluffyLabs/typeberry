import assert from "node:assert";
import { describe, it } from "node:test";
import { type CodeHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type U64, tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { PartialStateMock } from "../externalities/partial-state-mock";
import { HostCallResult } from "../results";
import { Upgrade } from "./upgrade";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const CODE_HASH_START_REG = 7;
const GAS_REG = 8;
const BALANCE_REG = 9;

function prepareRegsAndMemory(
  codeHash: CodeHash,
  gas: U64,
  balance: U64,
  { skipCodeHash = false }: { skipCodeHash?: boolean } = {},
) {
  const memStart = 2 ** 16;
  const registers = new HostCallRegisters(new Registers());
  registers.set(CODE_HASH_START_REG, tryAsU64(memStart));
  registers.set(GAS_REG, gas);
  registers.set(BALANCE_REG, balance);

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

describe("HostCalls: Upgrade", () => {
  it("should upgrade a service", async () => {
    const accumulate = new PartialStateMock();
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
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.upgradeData, [[Bytes.fill(HASH_SIZE, 0x69), 2n ** 40n, 2n ** 50n]]);
  });

  it("should fail when code not readable", async () => {
    const accumulate = new PartialStateMock();
    const upgrade = new Upgrade(accumulate);
    upgrade.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(
      Bytes.fill(HASH_SIZE, 0x69).asOpaque(),
      tryAsU64(2n ** 40n),
      tryAsU64(2n ** 50n),
      { skipCodeHash: true },
    );

    // when
    const result = await upgrade.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accumulate.upgradeData, []);
  });
});
