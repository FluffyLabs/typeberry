import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { tryAsGas } from "@typeberry/pvm-interface";
import { gasCounter, MemoryBuilder, Registers, tryAsMemoryIndex, tryAsSbrkIndex } from "@typeberry/pvm-interpreter";
import { PAGE_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts.js";
import { deepEqual, Result } from "@typeberry/utils";
import { ProvidePreimageError } from "../externalities/partial-state.js";
import { PartialStateMock } from "../externalities/partial-state-mock.js";
import { HostCallResult } from "../results.js";
import { Provide } from "./provide.js";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const PREIMAGE_START_REG = 8;
const LENGTH_REG = 9;

function prepareRegsAndMemory(
  service: ServiceId,
  preimage: BytesBlob,
  { registerMemory = true }: { registerMemory?: boolean } = {},
) {
  const preimageStart = 2 ** 16;
  const registers = new HostCallRegisters(new Registers());
  registers.set(RESULT_REG, tryAsU64(service));
  registers.set(PREIMAGE_START_REG, tryAsU64(preimageStart));
  registers.set(LENGTH_REG, tryAsU64(preimage.length));

  const builder = new MemoryBuilder();
  if (registerMemory) {
    builder.setReadablePages(
      tryAsMemoryIndex(preimageStart),
      tryAsMemoryIndex(preimageStart + PAGE_SIZE),
      preimage.raw,
    );
  }

  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
  };
}

describe("HostCalls: Provide", () => {
  it("should return panic if memory is unreadable", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const provide = new Provide(currentServiceId, accumulate);
    const serviceId = tryAsServiceId(15_000);
    const preimage = BytesBlob.blobFromNumbers([0xaa, 0xbb, 0xcc, 0xdd]);

    const { registers, memory } = prepareRegsAndMemory(serviceId, preimage, { registerMemory: false });

    const result = await provide.execute(gas, registers, memory);

    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accumulate.providePreimageData, []);
  });

  it("should return WHO if service not found", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const provide = new Provide(currentServiceId, accumulate);
    const serviceId = tryAsServiceId(15_000);
    const preimage = BytesBlob.blobFromNumbers([0xaa, 0xbb, 0xcc, 0xdd]);
    accumulate.providePreimageResponse = Result.error(
      ProvidePreimageError.ServiceNotFound,
      () => "Test: service not found for provide",
    );

    const { registers, memory } = prepareRegsAndMemory(serviceId, preimage);

    const result = await provide.execute(gas, registers, memory);

    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
    assert.deepStrictEqual(accumulate.providePreimageData, [[serviceId, preimage]]);
    deepEqual(
      accumulate.providePreimageResponse,
      Result.error(ProvidePreimageError.ServiceNotFound, () => "Test: service not found for provide"),
    );
  });

  it("should return HUH if preimage was not previously requested", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const provide = new Provide(currentServiceId, accumulate);
    const serviceId = tryAsServiceId(15_000);
    const preimage = BytesBlob.blobFromNumbers([0xaa, 0xbb, 0xcc, 0xdd]);
    accumulate.providePreimageResponse = Result.error(
      ProvidePreimageError.WasNotRequested,
      () => "Test: preimage was not requested for provide",
    );

    const { registers, memory } = prepareRegsAndMemory(serviceId, preimage);

    const result = await provide.execute(gas, registers, memory);

    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
    assert.deepStrictEqual(accumulate.providePreimageData, [[serviceId, preimage]]);
    deepEqual(
      accumulate.providePreimageResponse,
      Result.error(ProvidePreimageError.WasNotRequested, () => "Test: preimage was not requested for provide"),
    );
  });

  it("should return HUH if preimage already provided", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const provide = new Provide(currentServiceId, accumulate);
    const serviceId = tryAsServiceId(15_000);
    const preimage = BytesBlob.blobFromNumbers([0xaa, 0xbb, 0xcc, 0xdd]);
    accumulate.providePreimageResponse = Result.error(
      ProvidePreimageError.AlreadyProvided,
      () => "Test: preimage already provided",
    );

    const { registers, memory } = prepareRegsAndMemory(serviceId, preimage);

    const result = await provide.execute(gas, registers, memory);

    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
    assert.deepStrictEqual(accumulate.providePreimageData, [[serviceId, preimage]]);
    deepEqual(
      accumulate.providePreimageResponse,
      Result.error(ProvidePreimageError.AlreadyProvided, () => "Test: preimage already provided"),
    );
  });

  it("should return OK if preimage was not provided before (for other service)", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const provide = new Provide(currentServiceId, accumulate);
    const serviceId = tryAsServiceId(15_000);
    const preimage = BytesBlob.blobFromNumbers([0xaa, 0xbb, 0xcc, 0xdd]);

    const { registers, memory } = prepareRegsAndMemory(serviceId, preimage);

    const result = await provide.execute(gas, registers, memory);

    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.providePreimageData, [[serviceId, preimage]]);
  });

  it("should return OK if preimage was not provided before (for self)", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const provide = new Provide(currentServiceId, accumulate);
    const serviceId = tryAsServiceId(15_000);
    const preimage = BytesBlob.blobFromNumbers([0xaa, 0xbb, 0xcc, 0xdd]);

    const { registers, memory } = prepareRegsAndMemory(serviceId, preimage);

    const result = await provide.execute(gas, registers, memory);

    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.providePreimageData, [[serviceId, preimage]]);
  });
});
