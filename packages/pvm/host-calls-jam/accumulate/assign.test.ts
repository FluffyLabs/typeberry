import assert from "node:assert";
import { describe, it } from "node:test";
import { type CoreIndex, serviceId as asServiceId, coreIndex } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder, codec } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { type Blake2bHash, HASH_SIZE } from "@typeberry/hash";
import { Registers } from "@typeberry/pvm-interpreter";
import { type Gas, gasCounter } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, createMemoryIndex as memIdx } from "@typeberry/pvm-interpreter/memory";
import { HostCallResult } from "../results";
import { Assign } from "./assign";
import { AUTHORIZATION_QUEUE_SIZE } from "./partial-state";
import { TestAccumulate } from "./partial-state.test";

const gas = gasCounter(0 as Gas);
const RESULT_REG = 7;
const CORE_INDEX_REG = 7;
const AUTH_QUEUE_START_REG = 8;

function prepareRegsAndMemory(
  coreIndex: CoreIndex,
  authQueue: Blake2bHash[],
  { skipAuthQueue = false }: { skipAuthQueue?: boolean } = {},
) {
  const memStart = 20_000;
  const registers = new Registers();
  registers.asUnsigned[CORE_INDEX_REG] = coreIndex;
  registers.asUnsigned[AUTH_QUEUE_START_REG] = memStart;

  const builder = new MemoryBuilder();

  while (authQueue.length < AUTHORIZATION_QUEUE_SIZE) {
    authQueue.push(Bytes.zero(HASH_SIZE));
  }

  const encoder = Encoder.create();
  encoder.sequenceFixLen(codec.bytes(HASH_SIZE), authQueue);
  const data = encoder.viewResult();

  if (!skipAuthQueue) {
    builder.setReadable(memIdx(memStart), memIdx(memStart + data.buffer.length), data.buffer);
  }
  const memory = builder.finalize(memIdx(0), memIdx(0));
  return {
    registers,
    memory,
  };
}

describe("HostCalls: Assign", () => {
  // TODO [ToDr] Check large core index (greater than 2**16)
  it("should assign authorization queue to a core", async () => {
    const accumulate = new TestAccumulate();
    const assign = new Assign(accumulate, tinyChainSpec);
    const serviceId = asServiceId(10_000);
    assign.currentServiceId = serviceId;
    const { registers, memory } = prepareRegsAndMemory(coreIndex(0), [
      Bytes.fill(HASH_SIZE, 1),
      Bytes.fill(HASH_SIZE, 2),
      Bytes.fill(HASH_SIZE, 3),
    ]);

    // when
    await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OK);
    assert.deepStrictEqual(accumulate.authQueue[0][0], coreIndex(0));
    const expected = new Array(AUTHORIZATION_QUEUE_SIZE);
    expected[0] = Bytes.fill(HASH_SIZE, 1);
    expected[1] = Bytes.fill(HASH_SIZE, 2);
    expected[2] = Bytes.fill(HASH_SIZE, 3);
    for (let i = 3; i < AUTHORIZATION_QUEUE_SIZE; i += 1) {
      expected[i] = Bytes.zero(HASH_SIZE);
    }
    assert.deepStrictEqual(accumulate.authQueue[0][1], expected);
    assert.deepStrictEqual(accumulate.authQueue.length, 1);
  });

  it("should return an error if core index is too large", async () => {
    const accumulate = new TestAccumulate();
    const assign = new Assign(accumulate, tinyChainSpec);
    const serviceId = asServiceId(10_000);
    assign.currentServiceId = serviceId;
    const { registers, memory } = prepareRegsAndMemory(coreIndex(3), []);

    // when
    await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.CORE);
    assert.deepStrictEqual(accumulate.authQueue.length, 0);
  });

  it("should return an error if core index is waay too large", async () => {
    const accumulate = new TestAccumulate();
    const assign = new Assign(accumulate, tinyChainSpec);
    const serviceId = asServiceId(10_000);
    assign.currentServiceId = serviceId;
    const { registers, memory } = prepareRegsAndMemory(coreIndex(3), []);
    registers.asUnsigned[CORE_INDEX_REG] = 2 ** 16 + 3;

    // when
    await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.CORE);
    assert.deepStrictEqual(accumulate.authQueue.length, 0);
  });

  it("should return an error if data not readable", async () => {
    const accumulate = new TestAccumulate();
    const assign = new Assign(accumulate, tinyChainSpec);
    const serviceId = asServiceId(10_000);
    assign.currentServiceId = serviceId;
    const { registers, memory } = prepareRegsAndMemory(coreIndex(3), [], { skipAuthQueue: true });

    // when
    await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
    assert.deepStrictEqual(accumulate.authQueue.length, 0);
  });
});
