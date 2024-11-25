import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { MemoryBuilder } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { Registers } from "@typeberry/pvm-interpreter/registers";
import { Result } from "@typeberry/utils";
import { HostCallResult } from "../results";
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
  const memStart = 20_000;
  const registers = new Registers();
  registers.asUnsigned[DESTINATION_REG] = destination;
  registers.asUnsigned[MEMO_START_REG] = memStart;

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
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OK);
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
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OK);
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
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OK);
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
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
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
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.LOW);
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
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.WHO);
    assert.deepStrictEqual(accumulate.quitAndTransferData, [[15_000, 10_000n, Bytes.fill(TRANSFER_MEMO_BYTES, 33)]]);
    assert.deepStrictEqual(accumulate.quitAndBurnCalled, 0);
  });
});
