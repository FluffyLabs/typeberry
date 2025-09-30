import assert from "node:assert";
import { describe, it } from "node:test";

import { tryAsServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { tryAsU64, type U64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import {
  gasCounter,
  MemoryBuilder,
  Registers,
  tryAsGas,
  tryAsMemoryIndex,
  tryAsSbrkIndex,
} from "@typeberry/pvm-interpreter";
import { PAGE_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts.js";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { Fetch, FetchKind, type IFetchExternalities } from "./fetch.js";
import { HostCallResult } from "./results.js";

describe("Fetch", () => {
  const IN_OUT_REG = 7;
  const gas = gasCounter(tryAsGas(0));

  const itPre071 = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1) ? it.skip : it;
  const itPost071 = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1) ? it : it.skip;

  it("should return PvmExecution.Panic if memory write fails", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([1, 2, 3]);
    const fetchMock = new FetchMock();
    fetchMock.constantsResponse = blob;

    const badOffset = tryAsU64(0xfffff);

    const registers = new HostCallRegisters(new Registers());
    registers.set(IN_OUT_REG, badOffset);
    registers.set(8, tryAsU64(0));
    registers.set(9, tryAsU64(blob.length));
    registers.set(10, tryAsU64(FetchKind.Constants));

    const builder = new MemoryBuilder();
    // do not define any writable memory!
    const memory = new HostCallMemory(builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0)));

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, PvmExecution.Panic);
  });

  it("should write empty result and set IN_OUT_REG to NONE if fetch returns null", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const fetchMock = new FetchMock();
    fetchMock.entropyResponse = null;

    const blob = BytesBlob.blobFromNumbers([]);
    const { registers, memory, readBack } = prepareRegsAndMemory(blob, FetchKind.Entropy);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.strictEqual(registers.get(IN_OUT_REG), HostCallResult.NONE);
    // nothing written
    assert.deepStrictEqual(readBack(), new Uint8Array());
  });

  it("should write nothing if offset >= blob length", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([1, 2, 3]);
    const fetchMock = new FetchMock();
    fetchMock.constantsResponse = blob;

    const { registers, memory, readBack } = prepareRegsAndMemory(blob, FetchKind.Constants, 5, 2);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), tryAsU64(blob.length));
    assert.deepStrictEqual(readBack(), Uint8Array.from([0, 0, 0]));
  });

  it("should clamp offset + length to blob end", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([9, 8, 7, 6, 5]);
    const fetchMock = new FetchMock();
    fetchMock.constantsResponse = blob;

    const { registers, memory, readBack } = prepareRegsAndMemory(blob, FetchKind.Constants, 3, 10);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), tryAsU64(blob.length));

    assert.deepStrictEqual(readBack(), Uint8Array.from([6, 5, 0, 0, 0]));
  });

  it("should return NONE and write nothing if fetch kind is unknown", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.empty();
    const fetchMock = new FetchMock();
    fetchMock.constantsResponse = blob;

    const { registers, memory, readBack } = prepareRegsAndMemory(blob, FetchKind.Constants);
    registers.set(10, tryAsU64(999));

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.strictEqual(registers.get(IN_OUT_REG), HostCallResult.NONE);
    assert.deepStrictEqual(readBack(), new Uint8Array()); // memory should remain empty
  });

  it("should fetch constants and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([1, 2, 3, 4, 5]);
    const fetchMock = new FetchMock();
    fetchMock.constantsResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.Constants);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch entropy and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([10, 20, 30, 40]);
    const fetchMock = new FetchMock();
    fetchMock.entropyResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.Entropy);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch authorizer trace and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([9, 9, 9]);
    const fetchMock = new FetchMock();
    fetchMock.authorizerTraceResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.AuthorizerTrace);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch other work item extrinsics and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([42, 43, 44]);
    const fetchMock = new FetchMock();
    const workItem = tryAsU64(123);
    const index = tryAsU64(7);
    const key = `${workItem}:${index}`;
    fetchMock.workItemExtrinsicResponses.set(key, blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(
      blob,
      FetchKind.OtherWorkItemExtrinsics,
    );

    registers.set(11, workItem);
    registers.set(12, index);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.workItemExtrinsicData, [[workItem, index]]);
  });

  it("should fetch my extrinsics and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([11, 12, 13]);
    const fetchMock = new FetchMock();
    const index = tryAsU64(5);
    const key = `null:${index}`;
    fetchMock.workItemExtrinsicResponses.set(key, blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.MyExtrinsics);

    registers.set(11, index); // only index; workItem is null

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.workItemExtrinsicData, [[null, index]]);
  });

  it("should fetch other work item imports and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([21, 22, 23]);
    const fetchMock = new FetchMock();
    const workItem = tryAsU64(42);
    const index = tryAsU64(3);
    const key = `${workItem}:${index}`;
    fetchMock.workItemImportResponses.set(key, blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.OtherWorkItemImports);

    registers.set(11, workItem);
    registers.set(12, index);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.workItemImportData, [[workItem, index]]);
  });

  it("should fetch my imports and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([31, 32, 33]);
    const fetchMock = new FetchMock();
    const index = tryAsU64(8);
    const key = `null:${index}`;
    fetchMock.workItemImportResponses.set(key, blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.MyImports);

    registers.set(11, index); // workItem is implicitly null

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.workItemImportData, [[null, index]]);
  });

  it("should fetch work package and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([100, 101, 102]);
    const fetchMock = new FetchMock();
    fetchMock.workPackageResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.WorkPackage);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch authorizer and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([201, 202, 203]);
    const fetchMock = new FetchMock();
    fetchMock.authorizerResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.Authorizer);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch authorization token and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([210, 211, 212]);
    const fetchMock = new FetchMock();
    fetchMock.authorizationTokenResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.AuthorizationToken);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch refine context and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([88, 89, 90]);
    const fetchMock = new FetchMock();
    fetchMock.refineContextResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.RefineContext);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch all work items and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([70, 71, 72]);
    const fetchMock = new FetchMock();
    fetchMock.allWorkItemsResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.AllWorkItems);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch one work item and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([33, 34, 35]);
    const fetchMock = new FetchMock();
    const workItem = tryAsU64(55);
    fetchMock.oneWorkItemResponses.set(workItem.toString(), blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.OneWorkItem);

    registers.set(11, workItem);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.oneWorkItemData, [[workItem]]);
  });

  it("should fetch work item payload and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([60, 61, 62]);
    const fetchMock = new FetchMock();
    const workItem = tryAsU64(77);
    fetchMock.workItemPayloadResponses.set(workItem.toString(), blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.WorkItemPayload);

    registers.set(11, workItem);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.workItemPayloadData, [[workItem]]);
  });

  itPre071("should fetch all operands and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([101, 102, 103]);
    const fetchMock = new FetchMock();
    fetchMock.allOperandsResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.LegacyAllOperands);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  itPre071("should fetch one operand and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([115, 116, 117]);
    const fetchMock = new FetchMock();
    const index = tryAsU64(9);
    fetchMock.oneOperandResponses.set(index.toString(), blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.LegacyOneOperand);

    registers.set(11, index);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.oneOperandData, [[index]]);
  });

  itPre071("should fetch all transfers and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([130, 131, 132]);
    const fetchMock = new FetchMock();
    fetchMock.allTransfersResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.LegacyAllTransfers);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  itPre071("should fetch one transfer and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([140, 141, 142]);
    const fetchMock = new FetchMock();
    const index = tryAsU64(2);
    fetchMock.oneTransferResponses.set(index.toString(), blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.LegacyOneTransfer);

    registers.set(11, index);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.oneTransferData, [[index]]);
  });

  itPost071("should fetch all transfers and operands and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([101, 102, 103]);
    const fetchMock = new FetchMock();
    fetchMock.allOperandsAndTransfersResponses = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(
      blob,
      FetchKind.AllOperandsAndTransfers,
    );

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  itPost071("should fetch one operand or transfer and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([115, 116, 117]);
    const fetchMock = new FetchMock();
    const index = tryAsU64(9);
    fetchMock.oneOperandOrTransferResponses.set(index.toString(), blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.OneOperandOrTransfer);

    registers.set(11, index);

    const fetch = new Fetch(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.oneOperandOrTransferData, [[index]]);
  });

  function prepareRegsAndMemory(blob: BytesBlob, fetchKind: FetchKind, offset = 0, length: number = blob.length) {
    const pageStart = 2 ** 16;
    const memOffset = tryAsU64(pageStart + 1234);
    const blobLength = tryAsU64(blob.length);

    const registers = new HostCallRegisters(new Registers());
    registers.set(IN_OUT_REG, memOffset);
    registers.set(8, tryAsU64(offset));
    registers.set(9, tryAsU64(length));
    registers.set(10, tryAsU64(fetchKind));

    const builder = new MemoryBuilder();
    builder.setWriteablePages(tryAsMemoryIndex(pageStart), tryAsMemoryIndex(pageStart + PAGE_SIZE));
    const memory = new HostCallMemory(builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0)));

    const readBack = () => {
      const result = new Uint8Array(blob.length);
      assert.strictEqual(memory.loadInto(result, memOffset).isOk, true);
      return result;
    };

    return {
      registers,
      memory,
      readBack,
      expectedLength: blobLength,
    };
  }
});

class FetchMock implements IFetchExternalities {
  public readonly workItemExtrinsicData: Parameters<FetchMock["workItemExtrinsic"]>[] = [];
  public readonly workItemImportData: Parameters<FetchMock["workItemImport"]>[] = [];
  public readonly oneWorkItemData: Parameters<FetchMock["oneWorkItem"]>[] = [];
  public readonly workItemPayloadData: Parameters<FetchMock["workItemPayload"]>[] = [];
  public readonly oneOperandData: Parameters<FetchMock["oneOperand"]>[] = [];
  public readonly oneTransferData: Parameters<FetchMock["oneTransfer"]>[] = [];
  public readonly oneOperandOrTransferData: Parameters<FetchMock["oneOperandOrTransfer"]>[] = [];

  public constantsResponse: BytesBlob | null = null;
  public entropyResponse: BytesBlob | null = null;
  public authorizerTraceResponse: BytesBlob | null = null;
  public workItemExtrinsicResponses: Map<string, BytesBlob | null> = new Map();
  public workItemImportResponses: Map<string, BytesBlob | null> = new Map();
  public workPackageResponse: BytesBlob | null = null;
  public authorizerResponse: BytesBlob | null = null;
  public authorizationTokenResponse: BytesBlob | null = null;
  public refineContextResponse: BytesBlob | null = null;
  public allWorkItemsResponse: BytesBlob | null = null;
  public oneWorkItemResponses: Map<string, BytesBlob | null> = new Map();
  public workItemPayloadResponses: Map<string, BytesBlob | null> = new Map();
  public allOperandsResponse: BytesBlob | null = null;
  public oneOperandResponses: Map<string, BytesBlob | null> = new Map();
  public allTransfersResponse: BytesBlob | null = null;
  public oneTransferResponses: Map<string, BytesBlob | null> = new Map();
  public allOperandsAndTransfersResponses: BytesBlob | null = null;
  public oneOperandOrTransferResponses: Map<string, BytesBlob | null> = new Map();

  constants(): BytesBlob {
    if (this.constantsResponse === null) {
      throw new Error("Unexpected call to constants.");
    }
    return this.constantsResponse;
  }

  entropy(): BytesBlob | null {
    return this.entropyResponse;
  }

  authorizerTrace(): BytesBlob | null {
    return this.authorizerTraceResponse;
  }

  workItemExtrinsic(workItem: U64 | null, index: U64): BytesBlob | null {
    this.workItemExtrinsicData.push([workItem, index]);
    const key = `${workItem?.toString() ?? "null"}:${index.toString()}`;
    if (!this.workItemExtrinsicResponses.has(key)) {
      throw new Error(`Missing mock response for workItemExtrinsic(${key})`);
    }
    return this.workItemExtrinsicResponses.get(key) ?? null;
  }

  workItemImport(workItem: U64 | null, index: U64): BytesBlob | null {
    this.workItemImportData.push([workItem, index]);
    const key = `${workItem?.toString() ?? "null"}:${index.toString()}`;
    if (!this.workItemImportResponses.has(key)) {
      throw new Error(`Missing mock response for workItemImport(${key})`);
    }
    return this.workItemImportResponses.get(key) ?? null;
  }

  workPackage(): BytesBlob | null {
    return this.workPackageResponse;
  }

  authorizer(): BytesBlob | null {
    return this.authorizerResponse;
  }

  authorizationToken(): BytesBlob | null {
    return this.authorizationTokenResponse;
  }

  refineContext(): BytesBlob | null {
    return this.refineContextResponse;
  }

  allWorkItems(): BytesBlob | null {
    return this.allWorkItemsResponse;
  }

  oneWorkItem(workItem: U64): BytesBlob | null {
    this.oneWorkItemData.push([workItem]);
    const key = workItem.toString();
    if (!this.oneWorkItemResponses.has(key)) {
      throw new Error(`Missing mock response for oneWorkItem(${key})`);
    }
    return this.oneWorkItemResponses.get(key) ?? null;
  }

  workItemPayload(workItem: U64): BytesBlob | null {
    this.workItemPayloadData.push([workItem]);
    const key = workItem.toString();
    if (!this.workItemPayloadResponses.has(key)) {
      throw new Error(`Missing mock response for workItemPayload(${key})`);
    }
    return this.workItemPayloadResponses.get(key) ?? null;
  }

  allOperands(): BytesBlob | null {
    return this.allOperandsResponse;
  }

  oneOperand(operandIndex: U64): BytesBlob | null {
    this.oneOperandData.push([operandIndex]);
    const key = operandIndex.toString();
    if (!this.oneOperandResponses.has(key)) {
      throw new Error(`Missing mock response for oneOperand(${key})`);
    }
    return this.oneOperandResponses.get(key) ?? null;
  }

  allTransfers(): BytesBlob | null {
    return this.allTransfersResponse;
  }

  oneTransfer(transferIndex: U64): BytesBlob | null {
    this.oneTransferData.push([transferIndex]);
    const key = transferIndex.toString();
    if (!this.oneTransferResponses.has(key)) {
      throw new Error(`Missing mock response for oneTransfer(${key})`);
    }
    return this.oneTransferResponses.get(key) ?? null;
  }

  allOperandsAndTransfers(): BytesBlob | null {
    return this.allOperandsAndTransfersResponses;
  }

  oneOperandOrTransfer(index: U64): BytesBlob | null {
    this.oneOperandOrTransferData.push([index]);
    const key = index.toString();
    if (!this.oneOperandOrTransferResponses.has(key)) {
      throw new Error(`Missing mock response for oneOperandOrTransfer(${key})`);
    }
    return this.oneOperandOrTransferResponses.get(key) ?? null;
  }
}
