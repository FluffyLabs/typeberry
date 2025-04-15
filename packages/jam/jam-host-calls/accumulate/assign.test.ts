import assert from "node:assert";
import { describe, it } from "node:test";
import { type CoreIndex, tryAsCoreIndex, tryAsServiceId } from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants";
import { Bytes } from "@typeberry/bytes";
import { Encoder, codec } from "@typeberry/codec";
import { FixedSizeArray } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { type Blake2bHash, HASH_SIZE } from "@typeberry/hash";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { LegacyHostCallResult } from "../results";
import { Assign } from "./assign";
import { TestAccumulate } from "./partial-state.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const CORE_INDEX_REG = 7;
const AUTH_QUEUE_START_REG = 8;

function prepareRegsAndMemory(
  coreIndex: CoreIndex,
  authQueue: Blake2bHash[],
  { skipAuthQueue = false }: { skipAuthQueue?: boolean } = {},
) {
  const memStart = 2 ** 16;
  const registers = new Registers();
  registers.setU32(CORE_INDEX_REG, coreIndex);
  registers.setU32(AUTH_QUEUE_START_REG, memStart);

  const builder = new MemoryBuilder();

  while (authQueue.length < AUTHORIZATION_QUEUE_SIZE) {
    authQueue.push(Bytes.zero(HASH_SIZE));
  }

  const encoder = Encoder.create();
  encoder.sequenceFixLen(codec.bytes(HASH_SIZE), authQueue);
  const data = encoder.viewResult();

  if (!skipAuthQueue) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), data.raw);
  }
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory,
  };
}

describe("HostCalls: Assign", () => {
  it("should assign authorization queue to a core", async () => {
    const accumulate = new TestAccumulate();
    const assign = new Assign(accumulate, tinyChainSpec);
    const serviceId = tryAsServiceId(10_000);
    assign.currentServiceId = serviceId;
    const { registers, memory } = prepareRegsAndMemory(tryAsCoreIndex(0), [
      Bytes.fill(HASH_SIZE, 1),
      Bytes.fill(HASH_SIZE, 2),
      Bytes.fill(HASH_SIZE, 3),
    ]);

    // when
    await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getLowerU32(RESULT_REG), LegacyHostCallResult.OK);
    assert.deepStrictEqual(accumulate.authQueue[0][0], tryAsCoreIndex(0));
    const expected = new Array(AUTHORIZATION_QUEUE_SIZE);
    expected[0] = Bytes.fill(HASH_SIZE, 1);
    expected[1] = Bytes.fill(HASH_SIZE, 2);
    expected[2] = Bytes.fill(HASH_SIZE, 3);
    for (let i = 3; i < AUTHORIZATION_QUEUE_SIZE; i += 1) {
      expected[i] = Bytes.zero(HASH_SIZE);
    }
    const expectedAuthQueue = FixedSizeArray.new(expected, AUTHORIZATION_QUEUE_SIZE);
    assert.deepStrictEqual(accumulate.authQueue[0][1], expectedAuthQueue);
    assert.deepStrictEqual(accumulate.authQueue.length, 1);
  });

  it("should return an error if core index is too large", async () => {
    const accumulate = new TestAccumulate();
    const assign = new Assign(accumulate, tinyChainSpec);
    const serviceId = tryAsServiceId(10_000);
    assign.currentServiceId = serviceId;
    const { registers, memory } = prepareRegsAndMemory(tryAsCoreIndex(3), []);

    // when
    await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getLowerU32(RESULT_REG), LegacyHostCallResult.CORE);
    assert.deepStrictEqual(accumulate.authQueue.length, 0);
  });

  it("should return an error if core index is waay too large", async () => {
    const accumulate = new TestAccumulate();
    const assign = new Assign(accumulate, tinyChainSpec);
    const serviceId = tryAsServiceId(10_000);
    assign.currentServiceId = serviceId;
    const { registers, memory } = prepareRegsAndMemory(tryAsCoreIndex(3), []);
    registers.setU32(CORE_INDEX_REG, 2 ** 16 + 3);

    // when
    await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getLowerU32(RESULT_REG), LegacyHostCallResult.CORE);
    assert.deepStrictEqual(accumulate.authQueue.length, 0);
  });

  it("should return an error if data not readable", async () => {
    const accumulate = new TestAccumulate();
    const assign = new Assign(accumulate, tinyChainSpec);
    const serviceId = tryAsServiceId(10_000);
    assign.currentServiceId = serviceId;
    const { registers, memory } = prepareRegsAndMemory(tryAsCoreIndex(3), [], { skipAuthQueue: true });

    // when
    await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getLowerU32(RESULT_REG), LegacyHostCallResult.OOB);
    assert.deepStrictEqual(accumulate.authQueue.length, 0);
  });
});
