import assert from "node:assert";
import { describe, it } from "node:test";
import { type CodeHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type U64, tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { Result } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { RequestPreimageError } from "./partial-state";
import { TestAccumulate } from "./partial-state.test";
import { Solicit } from "./solicit";

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
    const accumulate = new TestAccumulate();
    const solicit = new Solicit(accumulate);
    solicit.currentServiceId = tryAsServiceId(10_000);
    const { registers, memory } = prepareRegsAndMemory(Bytes.fill(HASH_SIZE, 0x69).asOpaque(), tryAsU64(4_096));

    // when
    await solicit.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.requestPreimageData, [[Bytes.fill(HASH_SIZE, 0x69), 4_096n]]);
  });

  it("should fail if hash not available", async () => {
    const accumulate = new TestAccumulate();
    const solicit = new Solicit(accumulate);
    solicit.currentServiceId = tryAsServiceId(10_000);
    const { registers, memory } = prepareRegsAndMemory(Bytes.fill(HASH_SIZE, 0x69).asOpaque(), tryAsU64(4_096), {
      skipPreimageHash: true,
    });

    // when
    const result = await solicit.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accumulate.requestPreimageData, []);
  });

  it("should fail if already requested", async () => {
    const accumulate = new TestAccumulate();
    const solicit = new Solicit(accumulate);
    solicit.currentServiceId = tryAsServiceId(10_000);

    accumulate.requestPreimageResponse = Result.error(RequestPreimageError.AlreadyRequested);
    const { registers, memory } = prepareRegsAndMemory(Bytes.fill(HASH_SIZE, 0x69).asOpaque(), tryAsU64(4_096));

    // when
    await solicit.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
    assert.deepStrictEqual(accumulate.requestPreimageData, [[Bytes.fill(HASH_SIZE, 0x69), 4_096n]]);
  });

  it("should fail if already available", async () => {
    const accumulate = new TestAccumulate();
    const solicit = new Solicit(accumulate);
    solicit.currentServiceId = tryAsServiceId(10_000);

    accumulate.requestPreimageResponse = Result.error(RequestPreimageError.AlreadyAvailable);
    const { registers, memory } = prepareRegsAndMemory(Bytes.fill(HASH_SIZE, 0x69).asOpaque(), tryAsU64(4_096));

    // when
    await solicit.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
    assert.deepStrictEqual(accumulate.requestPreimageData, [[Bytes.fill(HASH_SIZE, 0x69), 4_096n]]);
  });

  it("should fail if balance too low", async () => {
    const accumulate = new TestAccumulate();
    const solicit = new Solicit(accumulate);
    solicit.currentServiceId = tryAsServiceId(10_000);

    accumulate.requestPreimageResponse = Result.error(RequestPreimageError.InsufficientFunds);
    const { registers, memory } = prepareRegsAndMemory(Bytes.fill(HASH_SIZE, 0x69).asOpaque(), tryAsU64(4_096));

    // when
    await solicit.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.FULL);
    assert.deepStrictEqual(accumulate.requestPreimageData, [[Bytes.fill(HASH_SIZE, 0x69), 4_096n]]);
  });
});
