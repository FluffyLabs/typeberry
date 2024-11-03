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
    const { registers, memory } = prepareRegsAndMemory(coreIndex(15), [
      Bytes.fill(HASH_SIZE, 1),
      Bytes.fill(HASH_SIZE, 2),
      Bytes.fill(HASH_SIZE, 3), // one extra, but doesn't matter.
    ]);

    // when
    await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OK);
    assert.deepStrictEqual(accumulate.authQueue, [coreIndex(15), [Bytes.fill(HASH_SIZE, 1), Bytes.fill(HASH_SIZE, 2)]]);
  });
});
