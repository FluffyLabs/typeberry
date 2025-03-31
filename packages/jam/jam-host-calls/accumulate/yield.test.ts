import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type U32, tryAsU32 } from "@typeberry/numbers";
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
  const registers = Registers.empty();
  registers.setU32(HASH_START_REG, hashStart);

  const builder = new MemoryBuilder();
  if (registerMemory) {
    builder.setReadablePages(tryAsMemoryIndex(hashStart), tryAsMemoryIndex(hashStart + PAGE_SIZE), data.raw);
  }

  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory,
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
    assert.deepStrictEqual(registers.getU32(RESULT_REG), hashStart);
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
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.yieldHash, data);
  });
});
