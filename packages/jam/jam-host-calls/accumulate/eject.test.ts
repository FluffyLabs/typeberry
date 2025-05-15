import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import { HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { HostCallMemory } from "@typeberry/pvm-host-calls";
import { MemoryBuilder } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { Registers } from "@typeberry/pvm-interpreter/registers";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { OK, Result } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { Eject } from "./eject";
import { EjectError } from "./partial-state";
import { TestAccumulate } from "./partial-state.test";

const RESULT_REG = 7;
const SOURCE_REG = 7;
const HASH_START_REG = 8;

function prepareRegsAndMemory(
  source: ServiceId,
  hash: Bytes<HASH_SIZE>,
  { skipHash = false }: { skipHash?: boolean } = {},
) {
  const hashStart = 2 ** 16;
  const registers = new HostCallRegisters(new Registers());
  registers.set(SOURCE_REG, tryAsU64(source));
  registers.set(HASH_START_REG, tryAsU64(hashStart));

  const builder = new MemoryBuilder();
  if (!skipHash) {
    builder.setReadablePages(tryAsMemoryIndex(hashStart), tryAsMemoryIndex(hashStart + PAGE_SIZE), hash.raw);
  }

  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
  };
}

const gas = gasCounter(tryAsGas(10_000));

describe("HostCalls: Eject", () => {
  it("should eject the account and transfer the funds", async () => {
    const accumulate = new TestAccumulate();
    const eject = new Eject(accumulate);
    const sourceServiceId = tryAsServiceId(15_000);
    eject.currentServiceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(HASH_SIZE, 5);

    const { registers, memory } = prepareRegsAndMemory(sourceServiceId, hash);

    // when
    const result = await eject.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.ejectData, [[sourceServiceId, eject.currentServiceId, hash]]);
    assert.deepStrictEqual(accumulate.ejectReturnValue, Result.ok(OK));
  });

  it("should fail if there is no memory for hash", async () => {
    const accumulate = new TestAccumulate();
    const eject = new Eject(accumulate);
    const sourceServiceId = tryAsServiceId(15_000);
    eject.currentServiceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(HASH_SIZE, 5);

    const { registers, memory } = prepareRegsAndMemory(sourceServiceId, hash, { skipHash: true });

    // when
    const result = await eject.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accumulate.ejectData, []);
  });

  it("should fail if destination does not exist", async () => {
    const accumulate = new TestAccumulate();
    const eject = new Eject(accumulate);
    accumulate.ejectReturnValue = Result.error(EjectError.DestinationNotFound);
    const sourceServiceId = tryAsServiceId(15_000);
    eject.currentServiceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(HASH_SIZE, 5);
    accumulate.ejectReturnValue = Result.error(EjectError.DestinationNotFound);

    const { registers, memory } = prepareRegsAndMemory(sourceServiceId, hash);

    // when
    const result = await eject.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
    assert.deepStrictEqual(accumulate.ejectData, [[sourceServiceId, eject.currentServiceId, hash]]);
    assert.deepStrictEqual(accumulate.ejectReturnValue, Result.error(EjectError.DestinationNotFound));
  });

  it("should fail if destination and source are the same", async () => {
    const accumulate = new TestAccumulate();
    const eject = new Eject(accumulate);
    const sourceServiceId = tryAsServiceId(15_000);
    eject.currentServiceId = sourceServiceId;
    const hash = Bytes.fill(HASH_SIZE, 5);
    accumulate.ejectReturnValue = Result.error(EjectError.SameSourceAndDestination);

    const { registers, memory } = prepareRegsAndMemory(sourceServiceId, hash);

    // when
    const result = await eject.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
    assert.deepStrictEqual(accumulate.ejectData, [[sourceServiceId, eject.currentServiceId, hash]]);
    assert.deepStrictEqual(accumulate.ejectReturnValue, Result.error(EjectError.SameSourceAndDestination));
  });

  it("should fail if destination has no available preimage", async () => {
    const accumulate = new TestAccumulate();
    accumulate.ejectReturnValue = Result.error(EjectError.PreimageUnavailable);
    const eject = new Eject(accumulate);
    const sourceServiceId = tryAsServiceId(15_000);
    eject.currentServiceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(HASH_SIZE, 5);
    accumulate.ejectReturnValue = Result.error(EjectError.PreimageUnavailable);

    const { registers, memory } = prepareRegsAndMemory(sourceServiceId, hash);

    // when
    const result = await eject.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
    assert.deepStrictEqual(accumulate.ejectData, [[sourceServiceId, eject.currentServiceId, hash]]);
    assert.deepStrictEqual(accumulate.ejectReturnValue, Result.error(EjectError.PreimageUnavailable));
  });

  it("should fail if preimage is too old", async () => {
    const accumulate = new TestAccumulate();
    accumulate.ejectReturnValue = Result.error(EjectError.PreimageUnavailable);
    const eject = new Eject(accumulate);
    const sourceServiceId = tryAsServiceId(15_000);
    eject.currentServiceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(HASH_SIZE, 5);
    accumulate.ejectReturnValue = Result.error(EjectError.PreimageTooOld);

    const { registers, memory } = prepareRegsAndMemory(sourceServiceId, hash);

    // when
    const result = await eject.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
    assert.deepStrictEqual(accumulate.ejectData, [[sourceServiceId, eject.currentServiceId, hash]]);
    assert.deepStrictEqual(accumulate.ejectReturnValue, Result.error(EjectError.PreimageTooOld));
  });
});
