import assert from "node:assert";
import { describe, it } from "node:test";
import { type CodeHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { Result } from "@typeberry/utils";
import { LegacyHostCallResult } from "../results";
import { Forget } from "./forget";
import { TestAccumulate } from "./partial-state.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const HASH_START_REG = 7;
const LENGTH_REG = 8;

function prepareRegsAndMemory(
  preimageHash: CodeHash,
  preimageLength: U32,
  { skipPreimageHash = false }: { skipPreimageHash?: boolean } = {},
) {
  const memStart = 2 ** 16;
  const registers = Registers.new();
  registers.setU32(HASH_START_REG, memStart);
  registers.setU32(LENGTH_REG, preimageLength);

  const builder = new MemoryBuilder();

  if (!skipPreimageHash) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), preimageHash.raw);
  }
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory,
  };
}

describe("HostCalls: Solicit", () => {
  it("should request a preimage hash", async () => {
    const accumulate = new TestAccumulate();
    const forget = new Forget(accumulate);
    forget.currentServiceId = tryAsServiceId(10_000);
    const { registers, memory } = prepareRegsAndMemory(Bytes.fill(HASH_SIZE, 0x69).asOpaque(), tryAsU32(4_096));

    // when
    await forget.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OK);
    assert.deepStrictEqual(accumulate.forgetPreimageData, [[Bytes.fill(HASH_SIZE, 0x69), 4_096]]);
  });

  it("should fail if hash not available", async () => {
    const accumulate = new TestAccumulate();
    const forget = new Forget(accumulate);
    forget.currentServiceId = tryAsServiceId(10_000);
    const { registers, memory } = prepareRegsAndMemory(Bytes.fill(HASH_SIZE, 0x69).asOpaque(), tryAsU32(4_096), {
      skipPreimageHash: true,
    });

    // when
    await forget.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OOB);
    assert.deepStrictEqual(accumulate.forgetPreimageData, []);
  });

  it("should fail if preimage not available", async () => {
    const accumulate = new TestAccumulate();
    const forget = new Forget(accumulate);
    forget.currentServiceId = tryAsServiceId(10_000);

    accumulate.forgetPreimageResponse = Result.error(null);
    const { registers, memory } = prepareRegsAndMemory(Bytes.fill(HASH_SIZE, 0x69).asOpaque(), tryAsU32(4_096));

    // when
    await forget.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.HUH);
    assert.deepStrictEqual(accumulate.forgetPreimageData, [[Bytes.fill(HASH_SIZE, 0x69), 4_096]]);
  });
});
