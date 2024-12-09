import assert from "node:assert";
import { describe, it } from "node:test";
import { type CodeHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { Result } from "@typeberry/utils";
import { HostCallResult } from "../results";
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
  const memStart = 20_000;
  const registers = new Registers();
  registers.set(HASH_START_REG, memStart);
  registers.set(LENGTH_REG, preimageLength);

  const builder = new MemoryBuilder();

  if (!skipPreimageHash) {
    builder.setReadable(
      tryAsMemoryIndex(memStart),
      tryAsMemoryIndex(memStart + preimageHash.raw.length),
      preimageHash.raw,
    );
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsMemoryIndex(0));
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
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
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
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OOB);
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
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
    assert.deepStrictEqual(accumulate.forgetPreimageData, [[Bytes.fill(HASH_SIZE, 0x69), 4_096]]);
  });
});
