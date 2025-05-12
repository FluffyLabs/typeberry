import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { type U64, tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { MemoryBuilder } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { Registers } from "@typeberry/pvm-interpreter/registers";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { Result } from "@typeberry/utils";
import { TRANSFER_MEMO_BYTES, TransferError } from "../externalities/partial-state";
import { TestAccumulate } from "../externalities/partial-state.test";
import { HostCallResult } from "../results";
import { Transfer } from "./transfer";

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
    assert.deepStrictEqual(cost, 10n + 1_000n);
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
    const result = await transfer.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
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
