import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64, type U32 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import {
  gasCounter,
  MemoryBuilder,
  Registers,
  tryAsGas,
  tryAsMemoryIndex,
  tryAsSbrkIndex,
} from "@typeberry/pvm-interpreter";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts.js";
import { type PreimageStatus, PreimageStatusKind } from "../externalities/partial-state.js";
import { PartialStateMock } from "../externalities/partial-state-mock.js";
import { HostCallResult } from "../results.js";
import { Query } from "./query.js";

const gas = gasCounter(tryAsGas(0));
const HASH_START_REG = 7;
const LENGTH_REG = 8;
const RESULT_REG_1 = 7;
const RESULT_REG_2 = 8;
const UPPER_BITS_SHIFT = 32n;

function prepareRegsAndMemory(
  hashStart: U32,
  length: U32,
  data: BytesBlob,
  { registerMemory = true }: { registerMemory?: boolean } = {},
) {
  const registers = new HostCallRegisters(new Registers());
  registers.set(HASH_START_REG, tryAsU64(hashStart));
  registers.set(LENGTH_REG, tryAsU64(length));

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

describe("HostCalls: Query", () => {
  it("should return panic if memory is unreadable", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const query = new Query(currentServiceId, accumulate);

    const w7 = tryAsU64(2 ** 16);
    const w8 = tryAsU64(0);
    const data = Bytes.fill(HASH_SIZE, 0xaa).asOpaque();
    accumulate.checkPreimageStatusResponse = null;

    const { registers, memory } = prepareRegsAndMemory(tryAsU32(Number(w7)), tryAsU32(Number(w8)), data, {
      registerMemory: false,
    });

    // when
    const result = await query.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(registers.get(RESULT_REG_1), w7);
    assert.deepStrictEqual(registers.get(RESULT_REG_2), w8);
  });

  it("should return none if preimage is not found", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const query = new Query(currentServiceId, accumulate);

    const w7 = tryAsU64(2 ** 16);
    const w8 = tryAsU64(32);
    const data = Bytes.fill(HASH_SIZE, 0xaa).asOpaque();
    accumulate.checkPreimageStatusResponse = null;

    const { registers, memory } = prepareRegsAndMemory(tryAsU32(Number(w7)), tryAsU32(Number(w8)), data);

    // when
    const result = await query.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG_1), HostCallResult.NONE);
    assert.deepStrictEqual(registers.get(RESULT_REG_2), 0n);
    assert.deepStrictEqual(accumulate.checkPreimageStatusData, [[Bytes.fill(HASH_SIZE, 0xaa), w8]]);
  });

  it("should return requested if preimage is requested", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const query = new Query(currentServiceId, accumulate);

    const w7 = tryAsU64(2 ** 16);
    const w8 = tryAsU64(32);
    const data = Bytes.fill(HASH_SIZE, 0xaa).asOpaque();
    const status: PreimageStatus = {
      status: PreimageStatusKind.Requested,
    };
    accumulate.checkPreimageStatusResponse = status;

    const { registers, memory } = prepareRegsAndMemory(tryAsU32(Number(w7)), tryAsU32(Number(w8)), data);

    // when
    const result = await query.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG_1), 0n);
    assert.deepStrictEqual(registers.get(RESULT_REG_2), 0n);
    assert.deepStrictEqual(accumulate.checkPreimageStatusData, [[Bytes.fill(HASH_SIZE, 0xaa), w8]]);
  });

  it("should return available if preimage is available", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const query = new Query(currentServiceId, accumulate);

    const w7 = tryAsU64(2 ** 16);
    const w8 = tryAsU64(32);
    const data = Bytes.fill(HASH_SIZE, 0xaa).asOpaque();
    const timeslot1 = tryAsTimeSlot(0x1234);

    const status: PreimageStatus = {
      status: PreimageStatusKind.Available,
      data: [timeslot1],
    };
    accumulate.checkPreimageStatusResponse = status;

    const { registers, memory } = prepareRegsAndMemory(tryAsU32(Number(w7)), tryAsU32(Number(w8)), data);

    // when
    const result = await query.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG_1), (BigInt(timeslot1) << UPPER_BITS_SHIFT) + 1n);
    assert.deepStrictEqual(registers.get(RESULT_REG_2), 0n);
    assert.deepStrictEqual(accumulate.checkPreimageStatusData, [[Bytes.fill(HASH_SIZE, 0xaa), w8]]);
  });

  it("should return unavailable if preimage is unavailable", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const query = new Query(currentServiceId, accumulate);

    const w7 = tryAsU64(2 ** 16);
    const w8 = tryAsU64(32);
    const data = Bytes.fill(HASH_SIZE, 0xaa).asOpaque();
    const timeslot1 = tryAsTimeSlot(0x1234);
    const timeslot2 = tryAsTimeSlot(0x5678);

    const status: PreimageStatus = {
      status: PreimageStatusKind.Unavailable,
      data: [timeslot1, timeslot2],
    };
    accumulate.checkPreimageStatusResponse = status;

    const { registers, memory } = prepareRegsAndMemory(tryAsU32(Number(w7)), tryAsU32(Number(w8)), data);

    // when
    const result = await query.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG_1), (BigInt(timeslot1) << UPPER_BITS_SHIFT) + 2n);
    assert.deepStrictEqual(registers.get(RESULT_REG_2), BigInt(timeslot2));
    assert.deepStrictEqual(accumulate.checkPreimageStatusData, [[Bytes.fill(HASH_SIZE, 0xaa), w8]]);
  });

  it("should return reavailable if preimage is reavailable", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const query = new Query(currentServiceId, accumulate);

    const w7 = tryAsU64(2 ** 16);
    const w8 = tryAsU64(32);
    const data = Bytes.fill(HASH_SIZE, 0xaa).asOpaque();
    const timeslot1 = tryAsTimeSlot(0x1234);
    const timeslot2 = tryAsTimeSlot(0x5678);
    const timeslot3 = tryAsTimeSlot(0x9abc);

    const status: PreimageStatus = {
      status: PreimageStatusKind.Reavailable,
      data: [timeslot1, timeslot2, timeslot3],
    };
    accumulate.checkPreimageStatusResponse = status;

    const { registers, memory } = prepareRegsAndMemory(tryAsU32(Number(w7)), tryAsU32(Number(w8)), data);

    // when
    const result = await query.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG_1), (BigInt(timeslot1) << UPPER_BITS_SHIFT) + 3n);
    assert.deepStrictEqual(registers.get(RESULT_REG_2), (BigInt(timeslot3) << UPPER_BITS_SHIFT) + BigInt(timeslot2));
    assert.deepStrictEqual(accumulate.checkPreimageStatusData, [[Bytes.fill(HASH_SIZE, 0xaa), w8]]);
  });
});
