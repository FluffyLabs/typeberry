import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type U32, type U64, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { PvmExecution } from "@typeberry/pvm-host-calls";
import {
  type Memory,
  MemoryBuilder,
  Registers,
  gasCounter,
  tryAsGas,
  tryAsMemoryIndex,
} from "@typeberry/pvm-interpreter";
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
const MACHINE_ID = 420;
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

function prepareMachine(
  machineId: MachineId,
  code: BytesBlob,
  memory: Memory,
  entrypoint: U64,
  { registerMachine = true }: { registerMachine?: boolean } = {},
): [TestRefineExt, MachineInstance] {
  const refine = new TestRefineExt();
  const machineInstance = MachineInstance.create(code, memory, entrypoint);
  if (registerMachine) {
    refine.machines.set(machineId, machineInstance);
  }
  return [refine, machineInstance];
}

describe("HostCalls: Invoke", () => {
  it("should return panic if memory is unwritable", async () => {
    const refine = new TestRefineExt();
    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(MACHINE_ID);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code, { registerMemory: false });

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), w7);
    assert.deepStrictEqual(registers.getU32(RESULT_REG_2), w8);
  });

  it("should return `who` if machine is not found #1", async () => {
    const machineId = tryAsMachineId(MACHINE_ID);
    const machineCode = BytesBlob.blobFromString("amazing PVM code");
    const machineMemory = prepareMemory(Bytes.zero(PAGE_SIZE), PAGE_SIZE, PAGE_SIZE);
    const machineEntry = tryAsU64(42);
    const [refine, _machine] = prepareMachine(machineId, machineCode, machineMemory, machineEntry, {
      registerMachine: false,
    });

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(MACHINE_ID);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code);

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), HostCallResult.WHO);
    assert.deepStrictEqual(registers.getU32(RESULT_REG_2), w8);
  });

  it("should return `who` if machine is not found #2", async () => {
    const machineId = tryAsMachineId(MACHINE_ID);
    const machineCode = BytesBlob.blobFromString("amazing PVM code");
    const machineMemory = prepareMemory(Bytes.zero(PAGE_SIZE), PAGE_SIZE, PAGE_SIZE);
    const machineEntry = tryAsU64(42);
    const [refine, _machine] = prepareMachine(machineId, machineCode, machineMemory, machineEntry);

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(MACHINE_ID + 1);
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
    const machineId = tryAsMachineId(MACHINE_ID);
    const machineCode = BytesBlob.blobFromString("amazing PVM code");
    const machineMemory = prepareMemory(Bytes.zero(PAGE_SIZE), PAGE_SIZE, PAGE_SIZE);
    const machineEntry = tryAsU64(0);
    const [refine, _machine] = prepareMachine(machineId, machineCode, machineMemory, machineEntry);
    const machineStatus: MachineStatus = {
      status: Status.HOST,
      hostCallIndex,
    };
    refine.machineInvokeResult = machineStatus;

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(MACHINE_ID);
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
    const machineId = tryAsMachineId(MACHINE_ID);
    const machineCode = BytesBlob.blobFromString("amazing PVM code");
    const machineMemory = prepareMemory(Bytes.zero(PAGE_SIZE), PAGE_SIZE, PAGE_SIZE);
    const machineEntry = tryAsU64(0);
    const [refine, _machine] = prepareMachine(machineId, machineCode, machineMemory, machineEntry);
    const machineStatus: MachineStatus = {
      status: Status.FAULT,
      address,
    };
    refine.machineInvokeResult = machineStatus;

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(MACHINE_ID);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code);

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), tryAsU64(Status.FAULT));
    assert.deepStrictEqual(registers.getU64(RESULT_REG_2), address);
  });

  it("should run the machine and finish with `oog` status", async () => {
    const machineId = tryAsMachineId(MACHINE_ID);
    const machineCode = BytesBlob.blobFromString("amazing PVM code");
    const machineMemory = prepareMemory(Bytes.zero(PAGE_SIZE), PAGE_SIZE, PAGE_SIZE);
    const machineEntry = tryAsU64(0);
    const [refine, _machine] = prepareMachine(machineId, machineCode, machineMemory, machineEntry);
    const machineStatus: MachineStatus = {
      status: Status.OOG,
    };
    refine.machineInvokeResult = machineStatus;

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(MACHINE_ID);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code);

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), tryAsU64(Status.OOG));
    assert.deepStrictEqual(registers.getU32(RESULT_REG_2), w8);
  });

  it("should run the machine and finish with `panic` status", async () => {
    const machineId = tryAsMachineId(MACHINE_ID);
    const machineCode = BytesBlob.blobFromString("amazing PVM code");
    const machineMemory = prepareMemory(Bytes.zero(PAGE_SIZE), PAGE_SIZE, PAGE_SIZE);
    const machineEntry = tryAsU64(0);
    const [refine, _machine] = prepareMachine(machineId, machineCode, machineMemory, machineEntry);
    const machineStatus: MachineStatus = {
      status: Status.PANIC,
    };
    refine.machineInvokeResult = machineStatus;

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(MACHINE_ID);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code);

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), tryAsU64(Status.PANIC));
    assert.deepStrictEqual(registers.getU32(RESULT_REG_2), w8);
  });

  it("should run the machine and finish with `halt` status", async () => {
    const machineId = tryAsMachineId(MACHINE_ID);
    const machineCode = BytesBlob.blobFromString("amazing PVM code");
    const machineMemory = prepareMemory(Bytes.zero(PAGE_SIZE), PAGE_SIZE, PAGE_SIZE);
    const machineEntry = tryAsU64(0);
    const [refine, _machine] = prepareMachine(machineId, machineCode, machineMemory, machineEntry);
    const machineStatus: MachineStatus = {
      status: Status.HALT,
    };
    refine.machineInvokeResult = machineStatus;

    const invoke = new Invoke(refine);
    invoke.currentServiceId = tryAsServiceId(10_000);

    const w7 = tryAsU64(MACHINE_ID);
    const w8 = tryAsU32(MEM_START);
    const code = Bytes.zero(GAS_REG_SIZE);
    const { registers, memory } = prepareRegsAndMemory(w7, w8, code);

    const result = await invoke.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG_1), tryAsU64(Status.HALT));
    assert.deepStrictEqual(registers.getU32(RESULT_REG_2), w8);
  });
});
