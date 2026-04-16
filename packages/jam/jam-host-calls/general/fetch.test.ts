import assert from "node:assert";
import { describe, it } from "node:test";

import { type EntropyHash, tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU64, type U64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { tryAsGas } from "@typeberry/pvm-interface";
import { gasCounter, MemoryBuilder, tryAsMemoryIndex, tryAsSbrkIndex } from "@typeberry/pvm-interpreter";
import { PAGE_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts.js";
import { Fetch, FetchContext, FetchKind, type IAccumulateFetch, type IRefineFetch } from "./fetch.js";
import { HostCallResult } from "./results.js";

describe("Fetch", () => {
  const IN_OUT_REG = 7;
  const gas = gasCounter(tryAsGas(0));

  it("should return PvmExecution.Panic if memory write fails", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([1, 2, 3]);
    const fetchMock = new RefineFetchMock();
    fetchMock.constantsResponse = blob;

    const badOffset = tryAsU64(0xfffff);

    const registers = HostCallRegisters.empty();
    registers.set(IN_OUT_REG, badOffset);
    registers.set(8, tryAsU64(0));
    registers.set(9, tryAsU64(blob.length));
    registers.set(10, tryAsU64(FetchKind.Constants));

    const builder = new MemoryBuilder();
    // do not define any writable memory!
    const memory = HostCallMemory.new(builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0)));

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, PvmExecution.Panic);
  });

  it("should write empty result and set IN_OUT_REG to NONE if fetch returns null", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const fetchMock = new RefineFetchMock();
    // oneWorkItem returns null when the work item index has no mock response registered

    const blob = BytesBlob.blobFromNumbers([]);
    const { registers, memory, readBack } = prepareRegsAndMemory(blob, FetchKind.OneWorkItem);
    // set work item index to one that has no response → oneWorkItem returns null
    registers.set(11, tryAsU64(999));
    fetchMock.oneWorkItemResponses.set("999", null);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.strictEqual(registers.get(IN_OUT_REG), HostCallResult.NONE);
    // nothing written
    assert.deepStrictEqual(readBack(), new Uint8Array());
  });

  it("should write nothing if offset >= blob length", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([1, 2, 3]);
    const fetchMock = new RefineFetchMock();
    fetchMock.constantsResponse = blob;

    const { registers, memory, readBack } = prepareRegsAndMemory(blob, FetchKind.Constants, 5, 2);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), tryAsU64(blob.length));
    assert.deepStrictEqual(readBack(), Uint8Array.from([0, 0, 0]));
  });

  it("should clamp offset + length to blob end", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([9, 8, 7, 6, 5]);
    const fetchMock = new RefineFetchMock();
    fetchMock.constantsResponse = blob;

    const { registers, memory, readBack } = prepareRegsAndMemory(blob, FetchKind.Constants, 3, 10);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), tryAsU64(blob.length));

    assert.deepStrictEqual(readBack(), Uint8Array.from([6, 5, 0, 0, 0]));
  });

  it("should return NONE and write nothing if fetch kind is unknown", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.empty();
    const fetchMock = new RefineFetchMock();
    fetchMock.constantsResponse = blob;

    const { registers, memory, readBack } = prepareRegsAndMemory(blob, FetchKind.Constants);
    registers.set(10, tryAsU64(999));

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.strictEqual(registers.get(IN_OUT_REG), HostCallResult.NONE);
    assert.deepStrictEqual(readBack(), new Uint8Array()); // memory should remain empty
  });

  it("should fetch constants and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([1, 2, 3, 4, 5]);
    const fetchMock = new RefineFetchMock();
    fetchMock.constantsResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.Constants);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch entropy and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob: EntropyHash = Bytes.fill(HASH_SIZE, 10).asOpaque();
    const fetchMock = new RefineFetchMock();
    fetchMock.entropyResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.Entropy);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch authorizer trace and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([9, 9, 9]);
    const fetchMock = new RefineFetchMock();
    fetchMock.authorizerTraceResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.AuthorizerTrace);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch other work item extrinsics and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([42, 43, 44]);
    const fetchMock = new RefineFetchMock();
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

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.workItemExtrinsicData, [[workItem, index]]);
  });

  it("should fetch my extrinsics and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([11, 12, 13]);
    const fetchMock = new RefineFetchMock();
    const index = tryAsU64(5);
    const key = `null:${index}`;
    fetchMock.workItemExtrinsicResponses.set(key, blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.MyExtrinsics);

    registers.set(11, index); // only index; workItem is null

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.workItemExtrinsicData, [[null, index]]);
  });

  it("should fetch other work item imports and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([21, 22, 23]);
    const fetchMock = new RefineFetchMock();
    const workItem = tryAsU64(42);
    const index = tryAsU64(3);
    const key = `${workItem}:${index}`;
    fetchMock.workItemImportResponses.set(key, blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.OtherWorkItemImports);

    registers.set(11, workItem);
    registers.set(12, index);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.workItemImportData, [[workItem, index]]);
  });

  it("should fetch my imports and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([31, 32, 33]);
    const fetchMock = new RefineFetchMock();
    const index = tryAsU64(8);
    const key = `null:${index}`;
    fetchMock.workItemImportResponses.set(key, blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.MyImports);

    registers.set(11, index); // workItem is implicitly null

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.workItemImportData, [[null, index]]);
  });

  it("should fetch work package and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([100, 101, 102]);
    const fetchMock = new RefineFetchMock();
    fetchMock.workPackageResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.WorkPackage);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch authorizer and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([201, 202, 203]);
    const fetchMock = new RefineFetchMock();
    fetchMock.authorizerResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.AuthConfiguration);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch authorization token and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([210, 211, 212]);
    const fetchMock = new RefineFetchMock();
    fetchMock.authorizationTokenResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.AuthToken);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch refine context and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([88, 89, 90]);
    const fetchMock = new RefineFetchMock();
    fetchMock.refineContextResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.RefineContext);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch all work items and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([70, 71, 72]);
    const fetchMock = new RefineFetchMock();
    fetchMock.allWorkItemsResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.AllWorkItems);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch one work item and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([33, 34, 35]);
    const fetchMock = new RefineFetchMock();
    const workItem = tryAsU64(55);
    fetchMock.oneWorkItemResponses.set(workItem.toString(), blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.OneWorkItem);

    registers.set(11, workItem);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.oneWorkItemData, [[workItem]]);
  });

  it("should fetch work item payload and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([60, 61, 62]);
    const fetchMock = new RefineFetchMock();
    const workItem = tryAsU64(77);
    fetchMock.workItemPayloadResponses.set(workItem.toString(), blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.WorkItemPayload);

    registers.set(11, workItem);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.workItemPayloadData, [[workItem]]);
  });

  it("should fetch all transfers and operands and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([101, 102, 103]);
    const fetchMock = new AccumulateFetchMock();
    fetchMock.allTransfersAndOperandsResponse = blob;

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(
      blob,
      FetchKind.AllTransfersAndOperands,
    );

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
  });

  it("should fetch one operand or transfer and write result to memory", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const blob = BytesBlob.blobFromNumbers([115, 116, 117]);
    const fetchMock = new AccumulateFetchMock();
    const index = tryAsU64(9);
    fetchMock.oneTransferOrOperandResponses.set(index.toString(), blob);

    const { registers, memory, readBack, expectedLength } = prepareRegsAndMemory(blob, FetchKind.OneTransferOrOperand);

    registers.set(11, index);

    const fetch = Fetch.new(currentServiceId, fetchMock);
    const result = await fetch.execute(gas, registers, memory);

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(IN_OUT_REG), expectedLength);
    assert.deepStrictEqual(readBack(), blob.raw);
    assert.deepStrictEqual(fetchMock.oneTransferOrOperandData, [[index]]);
  });

  it("should return NONE for refine-only kinds in accumulate context", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const fetchMock = new AccumulateFetchMock();
    const blob = BytesBlob.empty();

    for (const kind of [
      FetchKind.AuthorizerTrace,
      FetchKind.OtherWorkItemExtrinsics,
      FetchKind.MyExtrinsics,
      FetchKind.OtherWorkItemImports,
      FetchKind.MyImports,
      FetchKind.WorkPackage,
      FetchKind.AuthConfiguration,
      FetchKind.AuthToken,
      FetchKind.RefineContext,
      FetchKind.AllWorkItems,
      FetchKind.OneWorkItem,
      FetchKind.WorkItemPayload,
    ]) {
      const { registers, memory } = prepareRegsAndMemory(blob, kind);

      const fetch = Fetch.new(currentServiceId, fetchMock);
      const result = await fetch.execute(gas, registers, memory);

      assert.strictEqual(result, undefined, `Expected undefined for kind ${kind}`);
      assert.strictEqual(registers.get(IN_OUT_REG), HostCallResult.NONE, `Expected NONE for kind ${kind}`);
    }
  });

  it("should return NONE for accumulate-only kinds in refine context", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const fetchMock = new RefineFetchMock();
    const blob = BytesBlob.empty();

    for (const kind of [FetchKind.AllTransfersAndOperands, FetchKind.OneTransferOrOperand]) {
      const { registers, memory } = prepareRegsAndMemory(blob, kind);

      const fetch = Fetch.new(currentServiceId, fetchMock);
      const result = await fetch.execute(gas, registers, memory);

      assert.strictEqual(result, undefined, `Expected undefined for kind ${kind}`);
      assert.strictEqual(registers.get(IN_OUT_REG), HostCallResult.NONE, `Expected NONE for kind ${kind}`);
    }
  });

  function prepareRegsAndMemory(blob: BytesBlob, fetchKind: FetchKind, offset = 0, length: number = blob.length) {
    const pageStart = 2 ** 16;
    const memOffset = tryAsU64(pageStart + 1234);
    const blobLength = tryAsU64(blob.length);

    const registers = HostCallRegisters.empty();
    registers.set(IN_OUT_REG, memOffset);
    registers.set(8, tryAsU64(offset));
    registers.set(9, tryAsU64(length));
    registers.set(10, tryAsU64(fetchKind));

    const builder = new MemoryBuilder();
    builder.setWriteablePages(tryAsMemoryIndex(pageStart), tryAsMemoryIndex(pageStart + PAGE_SIZE));
    const memory = HostCallMemory.new(builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0)));

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

class RefineFetchMock implements IRefineFetch {
  readonly context = FetchContext.Refine;

  public readonly workItemExtrinsicData: Parameters<RefineFetchMock["workItemExtrinsic"]>[] = [];
  public readonly workItemImportData: Parameters<RefineFetchMock["workItemImport"]>[] = [];
  public readonly oneWorkItemData: Parameters<RefineFetchMock["oneWorkItem"]>[] = [];
  public readonly workItemPayloadData: Parameters<RefineFetchMock["workItemPayload"]>[] = [];

  public constantsResponse: BytesBlob | null = null;
  public entropyResponse: EntropyHash | null = null;
  public authorizerTraceResponse: BytesBlob = BytesBlob.empty();
  public workItemExtrinsicResponses: Map<string, BytesBlob | null> = new Map();
  public workItemImportResponses: Map<string, BytesBlob | null> = new Map();
  public workPackageResponse: BytesBlob = BytesBlob.empty();
  public authorizerResponse: BytesBlob = BytesBlob.empty();
  public authorizationTokenResponse: BytesBlob = BytesBlob.empty();
  public refineContextResponse: BytesBlob = BytesBlob.empty();
  public allWorkItemsResponse: BytesBlob = BytesBlob.empty();
  public oneWorkItemResponses: Map<string, BytesBlob | null> = new Map();
  public workItemPayloadResponses: Map<string, BytesBlob | null> = new Map();

  constants(): BytesBlob {
    if (this.constantsResponse === null) {
      throw new Error("Unexpected call to constants.");
    }
    return this.constantsResponse;
  }

  entropy(): EntropyHash {
    if (this.entropyResponse === null) {
      throw new Error("Unexpected call to entropy.");
    }
    return this.entropyResponse;
  }

  authorizerTrace(): BytesBlob {
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

  workPackage(): BytesBlob {
    return this.workPackageResponse;
  }

  authConfiguration(): BytesBlob {
    return this.authorizerResponse;
  }

  authToken(): BytesBlob {
    return this.authorizationTokenResponse;
  }

  refineContext(): BytesBlob {
    return this.refineContextResponse;
  }

  allWorkItems(): BytesBlob {
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
}

class AccumulateFetchMock implements IAccumulateFetch {
  readonly context = FetchContext.Accumulate;

  public readonly oneTransferOrOperandData: Parameters<AccumulateFetchMock["oneTransferOrOperand"]>[] = [];

  public constantsResponse: BytesBlob | null = null;
  public entropyResponse: EntropyHash | null = null;
  public allTransfersAndOperandsResponse: BytesBlob | null = null;
  public oneTransferOrOperandResponses: Map<string, BytesBlob | null> = new Map();

  constants(): BytesBlob {
    if (this.constantsResponse === null) {
      throw new Error("Unexpected call to constants.");
    }
    return this.constantsResponse;
  }

  entropy(): EntropyHash {
    if (this.entropyResponse === null) {
      throw new Error("Unexpected call to entropy.");
    }
    return this.entropyResponse;
  }

  allTransfersAndOperands(): BytesBlob | null {
    return this.allTransfersAndOperandsResponse;
  }

  oneTransferOrOperand(index: U64): BytesBlob | null {
    this.oneTransferOrOperandData.push([index]);
    const key = index.toString();
    if (!this.oneTransferOrOperandResponses.has(key)) {
      throw new Error(`Missing mock response for oneTransferOrOperand(${key})`);
    }
    return this.oneTransferOrOperandResponses.get(key) ?? null;
  }
}
