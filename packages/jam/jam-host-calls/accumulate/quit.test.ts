import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { MemoryBuilder } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { Registers } from "@typeberry/pvm-interpreter/registers";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { Result } from "@typeberry/utils";
import { LegacyHostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { QuitError, TRANSFER_MEMO_BYTES } from "./partial-state";
import { TestAccumulate } from "./partial-state.test";
import { Quit } from "./quit";

const RESULT_REG = 7;
const DESTINATION_REG = 7;
const MEMO_START_REG = 8;

function prepareRegsAndMemory(
  destination: ServiceId,
  memo: Bytes<TRANSFER_MEMO_BYTES>,
  { skipMemo = false }: { skipMemo?: boolean } = {},
) {
  const memStart = 2 ** 16;
  const registers = Registers.new();
  registers.setU32(DESTINATION_REG, destination);
  registers.setU32(MEMO_START_REG, memStart);

  const builder = new MemoryBuilder();
  if (!skipMemo) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), memo.raw);
  }

  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory,
  };
}

const gas = gasCounter(tryAsGas(10_000));

describe("HostCalls: Quit", () => {
  it("should quit the account and burn the funds", async () => {
    const accumulate = new TestAccumulate();
    const quit = new Quit(accumulate);
    quit.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(
      CURRENT_SERVICE_ID,
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
      { skipMemo: true }, // memo is not needed in the memory if we burn the funds.
    );

    // when
    await quit.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OK);
    assert.deepStrictEqual(accumulate.quitAndTransferData, []);
    assert.deepStrictEqual(accumulate.quitAndBurnCalled, 1);
  });

  it("should quit the account and burn the funds", async () => {
    const accumulate = new TestAccumulate();
    const quit = new Quit(accumulate);
    quit.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(
      quit.currentServiceId,
      Bytes.fill(TRANSFER_MEMO_BYTES, 33),
      { skipMemo: true }, // memo is not needed in the memory if we burn the funds.
    );

    // when
    await quit.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OK);
    assert.deepStrictEqual(accumulate.quitAndTransferData, []);
    assert.deepStrictEqual(accumulate.quitAndBurnCalled, 1);
  });

  it("should quit and do a transfer to different account", async () => {
    const accumulate = new TestAccumulate();
    const quit = new Quit(accumulate);
    quit.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(tryAsServiceId(15_000), Bytes.fill(TRANSFER_MEMO_BYTES, 33));

    // when
    await quit.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OK);
    assert.deepStrictEqual(accumulate.quitAndTransferData, [[15_000, 10_000n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
    assert.deepStrictEqual(accumulate.quitAndBurnCalled, 0);
  });

  it("should fail if there is no memory for memo", async () => {
    const accumulate = new TestAccumulate();
    const quit = new Quit(accumulate);
    quit.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(tryAsServiceId(15_000), Bytes.fill(TRANSFER_MEMO_BYTES, 33), {
      skipMemo: true,
    });

    // when
    await quit.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OOB);
    assert.deepStrictEqual(accumulate.quitAndTransferData, []);
    assert.deepStrictEqual(accumulate.quitAndBurnCalled, 0);
  });

  it("should fail if gas is too low", async () => {
    const accumulate = new TestAccumulate();
    const quit = new Quit(accumulate);
    quit.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(tryAsServiceId(15_000), Bytes.fill(TRANSFER_MEMO_BYTES, 33));

    // when
    accumulate.quitReturnValue = Result.error(QuitError.GasTooLow);
    await quit.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.LOW);
    assert.deepStrictEqual(accumulate.quitAndTransferData, [[15_000, 10_000n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
    assert.deepStrictEqual(accumulate.quitAndBurnCalled, 0);
  });

  it("should fail if destination does not exist", async () => {
    const accumulate = new TestAccumulate();
    const quit = new Quit(accumulate);
    quit.currentServiceId = tryAsServiceId(10_000);

    const { registers, memory } = prepareRegsAndMemory(tryAsServiceId(15_000), Bytes.fill(TRANSFER_MEMO_BYTES, 33));

    // when
    accumulate.quitReturnValue = Result.error(QuitError.DestinationNotFound);
    await quit.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.WHO);
    assert.deepStrictEqual(accumulate.quitAndTransferData, [[15_000, 10_000n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
    assert.deepStrictEqual(accumulate.quitAndBurnCalled, 0);
  });
});
