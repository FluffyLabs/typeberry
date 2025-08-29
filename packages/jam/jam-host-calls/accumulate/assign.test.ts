import assert from "node:assert";
import { describe, it } from "node:test";
import { type CoreIndex, tryAsCoreIndex, tryAsServiceId } from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants.js";
import { Bytes } from "@typeberry/bytes";
import { Encoder, codec } from "@typeberry/codec";
import { FixedSizeArray } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { type Blake2bHash, HASH_SIZE } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas.js";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/index.js";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts.js";
import { Compatibility, GpVersion, Result } from "@typeberry/utils";
import { PartialStateMock } from "../externalities/partial-state-mock.js";
import { UpdatePrivilegesError } from "../externalities/partial-state.js";
import { HostCallResult } from "../results.js";
import { Assign } from "./assign.js";

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
  const registers = new HostCallRegisters(new Registers());
  registers.set(CORE_INDEX_REG, tryAsU64(coreIndex));
  registers.set(AUTH_QUEUE_START_REG, tryAsU64(memStart));

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
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
  };
}

describe("HostCalls: Assign", () => {
  it("should assign authorization queue to a core", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const assign = new Assign(serviceId, accumulate, tinyChainSpec);
    const { registers, memory } = prepareRegsAndMemory(tryAsCoreIndex(0), [
      Bytes.fill(HASH_SIZE, 1),
      Bytes.fill(HASH_SIZE, 2),
      Bytes.fill(HASH_SIZE, 3),
    ]);

    // when
    const result = await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
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
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const assign = new Assign(serviceId, accumulate, tinyChainSpec);
    const { registers, memory } = prepareRegsAndMemory(tryAsCoreIndex(3), []);

    // when
    const result = await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.CORE);
    assert.deepStrictEqual(accumulate.authQueue.length, 0);
  });

  it("should return an error if core index is waay too large", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const assign = new Assign(serviceId, accumulate, tinyChainSpec);
    const { registers, memory } = prepareRegsAndMemory(tryAsCoreIndex(3), []);
    registers.set(CORE_INDEX_REG, tryAsU64(2 ** 16 + 3));

    // when
    const result = await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.CORE);
    assert.deepStrictEqual(accumulate.authQueue.length, 0);
  });

  it("should return panic if data not readable", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const assign = new Assign(serviceId, accumulate, tinyChainSpec);
    const { registers, memory } = prepareRegsAndMemory(tryAsCoreIndex(3), [], { skipAuthQueue: true });

    // when
    const result = await assign.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accumulate.authQueue.length, 0);
  });

  if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
    it("should return an error when current service is unprivileged", async () => {
      const accumulate = new PartialStateMock();
      accumulate.authQueueResponse = Result.error(UpdatePrivilegesError.UnprivilegedService);
      const serviceId = tryAsServiceId(10_000);
      const assign = new Assign(serviceId, accumulate, tinyChainSpec);
      const { registers, memory } = prepareRegsAndMemory(tryAsCoreIndex(0), []);

      // when
      const result = await assign.execute(gas, registers, memory);

      // then
      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
      assert.deepStrictEqual(accumulate.authQueue.length, 0);
    });

    it("should return an error when auth manager is invalid", async () => {
      const accumulate = new PartialStateMock();
      accumulate.authQueueResponse = Result.error(UpdatePrivilegesError.InvalidServiceId);
      const serviceId = tryAsServiceId(10_000);
      const assign = new Assign(serviceId, accumulate, tinyChainSpec);
      const { registers, memory } = prepareRegsAndMemory(tryAsCoreIndex(0), []);

      // when
      const result = await assign.execute(gas, registers, memory);

      // then
      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
      assert.deepStrictEqual(accumulate.authQueue.length, 0);
    });
  }
});
