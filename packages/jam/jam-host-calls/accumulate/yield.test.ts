import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type U32, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution } from "@typeberry/pvm-host-calls/host-call-handler";
import {
  MemoryBuilder,
  Registers,
  gasCounter,
  tryAsGas,
  tryAsMemoryIndex,
  tryAsSbrkIndex,
} from "@typeberry/pvm-interpreter";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { HostCallResult } from "../results";
import { TestAccumulate } from "./partial-state.test";
import { Yield } from "./yield";

const gas = gasCounter(tryAsGas(0));
const HASH_START_REG = 7;
const RESULT_REG = 7;

function prepareRegsAndMemory(
  hashStart: U32,
  data: BytesBlob,
  { registerMemory = true }: { registerMemory?: boolean } = {},
) {
  const registers = new HostCallRegisters(new Registers());
  registers.set(HASH_START_REG, tryAsU64(hashStart));

  const builder = new MemoryBuilder();
  if (registerMemory) {
    builder.setReadablePages(tryAsMemoryIndex(hashStart), tryAsMemoryIndex(hashStart + PAGE_SIZE), data.raw);
  }

  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
  };
}

describe("HostCalls: Yield", () => {
  it("should return panic if memory is unreadable", async () => {
    const accumulate = new TestAccumulate();
    const yieldHostCall = new Yield(accumulate); // yield is a reserved keyword

    const hashStart = tryAsU32(2 ** 16);
    const data = Bytes.fill(HASH_SIZE, 0xaa).asOpaque();

    yieldHostCall.currentServiceId = tryAsServiceId(10_000);
    const { registers, memory } = prepareRegsAndMemory(hashStart, data, { registerMemory: false });

    // when
    const result = await yieldHostCall.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(hashStart));
    assert.deepStrictEqual(accumulate.yieldHash, null);
  });

  it("should return status OK and yield hash", async () => {
    const accumulate = new TestAccumulate();
    const yieldHostCall = new Yield(accumulate);

    const hashStart = tryAsU32(2 ** 16);
    const data = Bytes.fill(HASH_SIZE, 0xaa).asOpaque();

    yieldHostCall.currentServiceId = tryAsServiceId(10_000);
    const { registers, memory } = prepareRegsAndMemory(hashStart, data);

    // when
    const result = await yieldHostCall.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.yieldHash, data);
  });
});
