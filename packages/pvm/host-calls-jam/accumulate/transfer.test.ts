import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { type U64, tryAsU64, u64IntoParts } from "@typeberry/numbers";
import { MemoryBuilder } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { Registers } from "@typeberry/pvm-interpreter/registers";
import { Result } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { TRANSFER_MEMO_BYTES, TransferError } from "./partial-state";
import { TestAccumulate } from "./partial-state.test";
import { Transfer } from "./transfer";

const RESULT_REG = 7;
const DESTINATION_REG = 7;
const AMOUNT_LOW_REG = 8;
const AMOUNT_HIG_REG = 9;
const GAS_LOW_REG = 10;
const GAS_HIG_REG = 11;
const MEMO_START_REG = 12;

function prepareRegsAndMemory(
  destination: ServiceId,
  amount: U64,
  gas: U64,
  memo: Bytes<TRANSFER_MEMO_BYTES>,
  { skipMemo = false }: { skipMemo?: boolean } = {},
) {
  const memStart = 20_000;
  const registers = new Registers();
  registers.set(DESTINATION_REG, destination);
  registers.set(AMOUNT_LOW_REG, u64IntoParts(amount).lower);
  registers.set(AMOUNT_HIG_REG, u64IntoParts(amount).upper);
  registers.set(GAS_LOW_REG, u64IntoParts(gas).lower);
  registers.set(GAS_HIG_REG, u64IntoParts(gas).upper);
  registers.set(MEMO_START_REG, memStart);

  const builder = new MemoryBuilder();
  if (!skipMemo) {
    builder.setReadable(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + memo.raw.length), memo.raw);
  }

  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsMemoryIndex(0));
  return {
    registers,
    memory,
  };
}

const gas = gasCounter(tryAsGas(10_000));

describe("HostCalls: Transfer", () => {
  it("should perform a transfer to self?", async () => {
    const accumulate = new TestAccumulate();
    const transfer = new Transfer(accumulate);
    transfer.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(
      transfer.currentServiceId,
      tryAsU64(2n ** 45n),
      tryAsU64(1_000),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    // when
    await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.transferData, [
      [transfer.currentServiceId, 2n ** 45n, 1_000n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)],
    ]);
  });

  it("should perform a transfer to different account", async () => {
    const accumulate = new TestAccumulate();
    const transfer = new Transfer(accumulate);
    transfer.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(1_000),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    // when
    await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.transferData, [[15_000, 2n ** 45n, 1_000n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
  });

  it("should calculate gas cost", () => {
    const accumulate = new TestAccumulate();
    const transfer = new Transfer(accumulate);
    transfer.currentServiceId = tryAsServiceId(10_000);

    const { registers } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(1_000),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    // when
    const cost = transfer.gasCost(registers);

    // then
    assert.deepStrictEqual(cost, 2n ** 45n + 10n);
  });

  it("should fail if there is no memory for memo", async () => {
    const accumulate = new TestAccumulate();
    const transfer = new Transfer(accumulate);
    transfer.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(1_000),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
      { skipMemo: true },
    );

    // when
    await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OOB);
    assert.deepStrictEqual(accumulate.transferData, []);
  });

  it("should fail if gas is too high", async () => {
    const accumulate = new TestAccumulate();
    const transfer = new Transfer(accumulate);
    transfer.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(2n ** 32n),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    // when
    await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HIGH);
    assert.deepStrictEqual(accumulate.transferData, []);
  });

  it("should fail if gas is too low", async () => {
    const accumulate = new TestAccumulate();
    const transfer = new Transfer(accumulate);
    transfer.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(1_000n),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    // when
    accumulate.transferReturnValue = Result.error(TransferError.GasTooLow);
    await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.LOW);
    assert.deepStrictEqual(accumulate.transferData, [[15_000, 2n ** 45n, 1_000n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
  });

  it("should fail if amount is too big", async () => {
    const accumulate = new TestAccumulate();
    const transfer = new Transfer(accumulate);
    transfer.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(1_000n),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    // when
    accumulate.transferReturnValue = Result.error(TransferError.BalanceBelowThreshold);
    await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.CASH);
    assert.deepStrictEqual(accumulate.transferData, [[15_000, 2n ** 45n, 1_000n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
  });

  it("should fail if destination does not exist", async () => {
    const accumulate = new TestAccumulate();
    const transfer = new Transfer(accumulate);
    transfer.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(
      tryAsServiceId(15_000),
      tryAsU64(2n ** 45n),
      tryAsU64(1_000n),
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
    );

    // when
    accumulate.transferReturnValue = Result.error(TransferError.DestinationNotFound);
    await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
    assert.deepStrictEqual(accumulate.transferData, [[15_000, 2n ** 45n, 1_000n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
  });
});
