import assert from "node:assert";
import { describe, it } from "node:test";
import { type CodeHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type U64, tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas.js";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/index.js";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts.js";
import { Result } from "@typeberry/utils";
import { PartialStateMock } from "../externalities/partial-state-mock.js";
import { HostCallResult } from "../results.js";
import { Forget } from "./forget.js";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const HASH_START_REG = 7;
const LENGTH_REG = 8;

function prepareRegsAndMemory(
  preimageHash: CodeHash,
  preimageLength: U64,
  { skipPreimageHash = false }: { skipPreimageHash?: boolean } = {},
) {
  const memStart = 2 ** 16;
  const registers = new HostCallRegisters(new Registers());
  registers.set(HASH_START_REG, tryAsU64(memStart));
  registers.set(LENGTH_REG, preimageLength);

  const builder = new MemoryBuilder();

  if (!skipPreimageHash) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), preimageHash.raw);
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
  };
}

describe("HostCalls: Solicit", () => {
  it("should request a preimage hash", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const forget = new Forget(serviceId, accumulate);
    const { registers, memory } = prepareRegsAndMemory(Bytes.fill(HASH_SIZE, 0x69).asOpaque(), tryAsU64(4_096));

    // when
    await forget.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.forgetPreimageData, [[Bytes.fill(HASH_SIZE, 0x69), 4_096n]]);
  });

  it("should fail if hash not available", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const forget = new Forget(serviceId, accumulate);
    const { registers, memory } = prepareRegsAndMemory(Bytes.fill(HASH_SIZE, 0x69).asOpaque(), tryAsU64(4_096), {
      skipPreimageHash: true,
    });

    // when
    const result = await forget.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accumulate.forgetPreimageData, []);
  });

  it("should fail if preimage not available", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const forget = new Forget(serviceId, accumulate);

    accumulate.forgetPreimageResponse = Result.error(null);
    const { registers, memory } = prepareRegsAndMemory(Bytes.fill(HASH_SIZE, 0x69).asOpaque(), tryAsU64(4_096));

    // when
    await forget.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
    assert.deepStrictEqual(accumulate.forgetPreimageData, [[Bytes.fill(HASH_SIZE, 0x69), 4_096n]]);
  });
});
