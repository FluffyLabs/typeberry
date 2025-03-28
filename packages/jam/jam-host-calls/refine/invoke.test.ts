import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { type U32, type U64, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { PvmExecution } from "@typeberry/pvm-host-calls";
import { MemoryBuilder, Registers, gasCounter, tryAsGas, tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { Status } from "@typeberry/pvm-interpreter/status";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { HostCallResult } from "../results";
import { Invoke } from "./invoke";
import { type MachineId, MachineInstance, type MachineStatus, tryAsMachineId } from "./machine-instance";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const MACHINE_INDEX_REG = 7;
const RESULT_REG_1 = MACHINE_INDEX_REG;
const DEST_REG = 8;
const RESULT_REG_2 = DEST_REG;
const GAS_REG_SIZE = 112;
const MEM_START = 0;

function prepareRegsAndMemory(
  machineIndex: U64,
  destinationStart: U32,
  data: BytesBlob,
  { registerMemory = true }: { registerMemory?: boolean } = {},
) {
  const registers = new Registers();
  registers.setU64(MACHINE_INDEX_REG, machineIndex);
  registers.setU32(DEST_REG, destinationStart);

  const memory = prepareMemory(data, destinationStart, PAGE_SIZE, { registerMemory });

  return {
    registers,
    memory,
  };
}

function prepareMemory(
  data: BytesBlob,
  address: number,
  size: number,
  { registerMemory = true }: { registerMemory?: boolean } = {},
) {
  const builder = new MemoryBuilder();
  if (registerMemory) {
    builder.setWriteablePages(tryAsMemoryIndex(address), tryAsMemoryIndex(address + size), data.raw);
  }
  return builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));
}

async function prepareMachine(
  machineStatus: MachineStatus,
  { registerMachine = true }: { registerMachine?: boolean } = {},
): Promise<[TestRefineExt, MachineId]> {
  const refine = new TestRefineExt();
  const machineId = tryAsMachineId(10_000);
  if (registerMachine) {
    refine.machineInvokeData.set(machineId, new MachineInstance());
    refine.machineInvokeStatus = machineStatus;
  }
  return [refine, machineId];
}

describe("HostCalls: Invoke", () => {
  it("should return panic if memory is unwritable", async () => {
    const [refine, machineId] = await prepareMachine(
      {
        status: Status.OK,
      },
      {
        registerMachine: false,
      },
    );

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(machineId);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code, { registerMemory: false });

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), w7);
    assert.deepStrictEqual(registers.getU32(RESULT_REG_2), w8);
  });

  it("should return `who` if machine is not found (machine not initialized)", async () => {
    const [refine, machineId] = await prepareMachine(
      {
        status: Status.OK,
      },
      {
        registerMachine: false,
      },
    );

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(machineId);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code);

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), HostCallResult.WHO);
    assert.deepStrictEqual(registers.getU32(RESULT_REG_2), w8);
  });

  it("should return `who` if machine is not found (machine id is not valid)", async () => {
    const [refine, machineId] = await prepareMachine({
      status: Status.OK,
    });

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(machineId + 1n);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code);

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), HostCallResult.WHO);
    assert.deepStrictEqual(registers.getU32(RESULT_REG_2), w8);
  });

  it("should run the machine and finish with `host` status", async () => {
    const hostCallIndex = tryAsU64(10);
    const [refine, machineId] = await prepareMachine({
      status: Status.HOST,
      hostCallIndex,
    });

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(machineId);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code);

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), tryAsU64(Status.HOST));
    assert.deepStrictEqual(registers.getU64(RESULT_REG_2), hostCallIndex);
  });

  it("should run the machine and finish with `fault` status", async () => {
    const address = tryAsU64(2 ** 12);
    const [refine, machineId] = await prepareMachine({
      status: Status.FAULT,
      address,
    });

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(machineId);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code);

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), tryAsU64(Status.FAULT));
    assert.deepStrictEqual(registers.getU64(RESULT_REG_2), address);
  });

  it("should run the machine and finish with `oog` status", async () => {
    const [refine, machineId] = await prepareMachine({
      status: Status.OOG,
    });

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(machineId);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code);

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), tryAsU64(Status.OOG));
    assert.deepStrictEqual(registers.getU32(RESULT_REG_2), w8);
  });

  it("should run the machine and finish with `panic` status", async () => {
    const [refine, machineId] = await prepareMachine({
      status: Status.PANIC,
    });

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(machineId);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code);

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), tryAsU64(Status.PANIC));
    assert.deepStrictEqual(registers.getU32(RESULT_REG_2), w8);
  });

  it("should run the machine and finish with `halt` status", async () => {
    const [refine, machineId] = await prepareMachine({
      status: Status.HALT,
    });

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(machineId);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code);

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), tryAsU64(Status.HALT));
    assert.deepStrictEqual(registers.getU32(RESULT_REG_2), w8);
  });
});
