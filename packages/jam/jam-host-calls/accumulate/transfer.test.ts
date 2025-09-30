import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { tryAsU64, type U64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { MemoryBuilder } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas.js";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/index.js";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { Registers } from "@typeberry/pvm-interpreter/registers.js";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts.js";
import { Result } from "@typeberry/utils";
import { TRANSFER_MEMO_BYTES, TransferError } from "../externalities/partial-state.js";
import { PartialStateMock } from "../externalities/partial-state-mock.js";
import { HostCallResult } from "../results.js";
import { Transfer } from "./transfer.js";

const RESULT_REG = 7;
const DESTINATION_REG = 7;
const AMOUNT_REG = 8; // `a`
const ON_TRANSFER_GAS_REG = 9; // `l`
const MEMO_START_REG = 10; // `o`

function prepareRegsAndMemory(
  destination: ServiceId,
  amount: U64,
  gas: U64,
  memo: Bytes<TRANSFER_MEMO_BYTES>,
  { skipMemo = false }: { skipMemo?: boolean } = {},
) {
  const memStart = 2 ** 16;
  const registers = new HostCallRegisters(new Registers());
  registers.set(DESTINATION_REG, tryAsU64(destination));
  registers.set(AMOUNT_REG, amount);
  registers.set(ON_TRANSFER_GAS_REG, gas);
  registers.set(MEMO_START_REG, tryAsU64(memStart));

  const builder = new MemoryBuilder();
  if (!skipMemo) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), memo.raw);
  }

  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
  };
}

describe("HostCalls: Transfer", () => {
  it("should perform a transfer to self?", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const transfer = new Transfer(currentServiceId, accumulate);

    const { registers, memory } = prepareRegsAndMemory(
      transfer.currentServiceId,
      tryAsU64(2n ** 45n),
      tryAsU64(1_000),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    const gas = gasCounter(tryAsGas(10_000));

    // when
    gas.sub(transfer.basicGasCost);
    await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.transferData, [
      [transfer.currentServiceId, 2n ** 45n, 1_000n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)],
    ]);
    assert.deepStrictEqual(gas.get(), 8_990n);
  });

  it("should perform a transfer to different account", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const transfer = new Transfer(currentServiceId, accumulate);

    const { registers, memory } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(1_000),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    const gas = gasCounter(tryAsGas(10_000));

    // when
    gas.sub(transfer.basicGasCost);
    await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.transferData, [[15_000, 2n ** 45n, 1_000n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
    assert.deepStrictEqual(gas.get(), 8_990n);
  });

  it("should OOG if gas is too low", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const transfer = new Transfer(currentServiceId, accumulate);

    const { registers, memory } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(1_000n),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    const gas = gasCounter(tryAsGas(1_000));

    // when
    gas.sub(transfer.basicGasCost);
    const result = await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.OOG);
    assert.deepStrictEqual(accumulate.transferData, [[15_000, 2n ** 45n, 1_000n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
    assert.deepStrictEqual(gas.get(), 0n);
  });

  it("should fail if there is no memory for memo", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const transfer = new Transfer(currentServiceId, accumulate);

    const { registers, memory } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(1_000),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
      { skipMemo: true },
    );

    const gas = gasCounter(tryAsGas(10_000));

    // when
    gas.sub(transfer.basicGasCost);
    const result = await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accumulate.transferData, []);
    assert.deepStrictEqual(gas.get(), 9_990n);
  });

  it("should fail if gas is too low", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const transfer = new Transfer(currentServiceId, accumulate);

    const { registers, memory } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(1_000n),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    const gas = gasCounter(tryAsGas(10_000));

    // when
    gas.sub(transfer.basicGasCost);
    accumulate.transferReturnValue = Result.error(TransferError.GasTooLow);
    await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.LOW);
    assert.deepStrictEqual(accumulate.transferData, [[15_000, 2n ** 45n, 0n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
    assert.deepStrictEqual(gas.get(), 9_990n);
  });

  it("should fail if amount is too big", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const transfer = new Transfer(currentServiceId, accumulate);

    const { registers, memory } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(1_000n),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    const gas = gasCounter(tryAsGas(10_000));

    // when
    gas.sub(transfer.basicGasCost);
    accumulate.transferReturnValue = Result.error(TransferError.BalanceBelowThreshold);
    await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.CASH);
    assert.deepStrictEqual(accumulate.transferData, [[15_000, 2n ** 45n, 0n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
    assert.deepStrictEqual(gas.get(), 9_990n);
  });

  it("should fail if destination does not exist", async () => {
    const accumulate = new PartialStateMock();
    const currentServiceId = tryAsServiceId(10_000);
    const transfer = new Transfer(currentServiceId, accumulate);

    const { registers, memory } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(1_000n),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    const gas = gasCounter(tryAsGas(10_000));

    // when
    gas.sub(transfer.basicGasCost);
    accumulate.transferReturnValue = Result.error(TransferError.DestinationNotFound);
    await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
    assert.deepStrictEqual(accumulate.transferData, [[15_000, 2n ** 45n, 0n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
    assert.deepStrictEqual(gas.get(), 9_990n);
  });
});
