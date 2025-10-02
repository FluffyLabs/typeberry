import assert from "node:assert";
import { describe, it } from "node:test";

import { type EntropyHash, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { WorkExecResult, WorkExecResultKind } from "@typeberry/block/work-result.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { codec, Encoder } from "@typeberry/codec";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { TRANSFER_MEMO_BYTES } from "@typeberry/jam-host-calls/externalities/partial-state.js";
import { PendingTransfer } from "@typeberry/jam-host-calls/externalities/pending-transfer.js";
import { tryAsU64 } from "@typeberry/numbers";
import { Operand } from "../accumulate/operand.js";
import { FetchExternalities } from "./fetch-externalities.js";

describe("fetch-externalities", () => {
  const prepareOperands = (length: number) => {
    const operands: Operand[] = [];

    for (let i = 0; i < length; i++) {
      operands.push(
        Operand.create({
          authorizationOutput: BytesBlob.empty(),
          authorizerHash: Bytes.fill(HASH_SIZE, i + 1).asOpaque(),
          exportsRoot: Bytes.fill(HASH_SIZE, i + 2).asOpaque(),
          hash: Bytes.fill(HASH_SIZE, i + 4).asOpaque(),
          payloadHash: Bytes.fill(HASH_SIZE, i + 5).asOpaque(),
          result: new WorkExecResult(WorkExecResultKind.ok, BytesBlob.empty()),
          gas: tryAsServiceGas(1_000),
        }),
      );
    }

    return operands;
  };

  const prepareTransfers = (length: number) => {
    const transfers: PendingTransfer[] = [];

    for (let i = 0; i < length; i++) {
      transfers.push(
        PendingTransfer.create({
          amount: tryAsU64(1000),
          source: tryAsServiceId(i),
          destination: tryAsServiceId(i + 1),
          gas: tryAsServiceGas(10),
          memo: Bytes.fill(TRANSFER_MEMO_BYTES, 0),
        }),
      );
    }

    return transfers;
  };

  const prepareLegacyAccumulateData = ({
    chainSpec,
    operands,
    entropy,
  }: {
    chainSpec?: ChainSpec;
    operands?: Operand[];
    entropy?: EntropyHash;
    transfers?: PendingTransfer[];
  }) => {
    const defaultChainSpec = tinyChainSpec;
    const defaultEntropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const defaultOperands: Operand[] = [];
    const fetchData = {
      entropy: entropy ?? defaultEntropy,
      operands: operands ?? defaultOperands,
    };
    return FetchExternalities.createForPre071Accumulate(fetchData, chainSpec ?? defaultChainSpec);
  };

  const prepareOnTransferData = ({
    chainSpec,
    operands,
    entropy,
    transfers,
  }: {
    chainSpec?: ChainSpec;
    operands?: Operand[];
    entropy?: EntropyHash;
    transfers?: PendingTransfer[];
  }) => {
    const defaultChainSpec = tinyChainSpec;
    const defaultEntropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const defaultOperands: Operand[] = [];
    const defaultTransfers: PendingTransfer[] = [];
    const fetchData = {
      entropy: entropy ?? defaultEntropy,
      operands: operands ?? defaultOperands,
      transfers: transfers ?? defaultTransfers,
    };
    return FetchExternalities.createForOnTransfer(fetchData, chainSpec ?? defaultChainSpec);
  };

  it("should return different constants for different chain specs (Accumulate)", () => {
    const tinyFetchExternalities = prepareLegacyAccumulateData({ chainSpec: tinyChainSpec });
    const fullFetchExternalities = prepareLegacyAccumulateData({ chainSpec: fullChainSpec });

    const tinyContants = tinyFetchExternalities.constants();
    const fullContants = fullFetchExternalities.constants();

    assert.notStrictEqual(tinyContants.length, 0);
    assert.notStrictEqual(fullContants.length, 0);
    assert.notDeepStrictEqual(tinyContants, fullContants);
  });

  it("should return different constants for different chain specs (OnTransfer)", () => {
    const tinyFetchExternalities = prepareOnTransferData({ chainSpec: tinyChainSpec });
    const fullFetchExternalities = prepareOnTransferData({ chainSpec: fullChainSpec });

    const tinyContants = tinyFetchExternalities.constants();
    const fullContants = fullFetchExternalities.constants();

    assert.notStrictEqual(tinyContants.length, 0);
    assert.notStrictEqual(fullContants.length, 0);
    assert.notDeepStrictEqual(tinyContants, fullContants);
  });

  it("should return entropy hash (Accumulate)", () => {
    const expectedEntropy: EntropyHash = Bytes.fill(HASH_SIZE, 5).asOpaque();
    const fetchExternalities = prepareLegacyAccumulateData({ entropy: expectedEntropy });

    const entropy = fetchExternalities.entropy();

    assert.deepStrictEqual(entropy, expectedEntropy);
  });

  it("should return entropy hash (OnTransfer)", () => {
    const expectedEntropy: EntropyHash = Bytes.fill(HASH_SIZE, 5).asOpaque();
    const fetchExternalities = prepareOnTransferData({ entropy: expectedEntropy });

    const entropy = fetchExternalities.entropy();

    assert.deepStrictEqual(entropy, expectedEntropy);
  });

  it("should return all operands", () => {
    const expectedOperands = prepareOperands(5);
    const chainSpec = tinyChainSpec;
    const encodedOperands = Encoder.encodeObject(codec.sequenceVarLen(Operand.Codec), expectedOperands, chainSpec);

    const fetchExternalities = prepareLegacyAccumulateData({ operands: expectedOperands, chainSpec });

    const operands = fetchExternalities.allOperands();

    assert.deepStrictEqual(operands, encodedOperands);
  });

  it("should null when operand index is not U32", () => {
    const operands = prepareOperands(5);
    const chainSpec = tinyChainSpec;
    const expectedOperandIndex = 2 ** 32 + 3;
    const expectedOperand: Operand | null = null;

    const fetchExternalities = prepareLegacyAccumulateData({ operands, chainSpec });

    const operand = fetchExternalities.oneOperand(tryAsU64(expectedOperandIndex));

    assert.deepStrictEqual(operand, expectedOperand);
  });

  it("should null when operand index is U32 but is incorrect", () => {
    const operands = prepareOperands(5);
    const chainSpec = tinyChainSpec;
    const expectedOperandIndex = 153;
    const expectedOperand: Operand | null = null;

    const fetchExternalities = prepareLegacyAccumulateData({ operands, chainSpec });

    const operand = fetchExternalities.oneOperand(tryAsU64(expectedOperandIndex));

    assert.deepStrictEqual(operand, expectedOperand);
  });

  it("should return one operand", () => {
    const operands = prepareOperands(5);
    const chainSpec = tinyChainSpec;
    const expectedOperandIndex = 3;
    const expectedOperand = operands[expectedOperandIndex];
    const encodedOperand = Encoder.encodeObject(Operand.Codec, expectedOperand, chainSpec);

    const fetchExternalities = prepareLegacyAccumulateData({ operands, chainSpec });

    const operand = fetchExternalities.oneOperand(tryAsU64(expectedOperandIndex));

    assert.deepStrictEqual(operand, encodedOperand);
  });

  it("should return all transfers", () => {
    const transfersToEncode = prepareTransfers(5);
    const chainSpec = tinyChainSpec;
    const encodedTransfers = Encoder.encodeObject(
      codec.sequenceVarLen(PendingTransfer.Codec),
      transfersToEncode,
      chainSpec,
    );

    const fetchExternalities = prepareOnTransferData({ transfers: transfersToEncode, chainSpec });

    const transfers = fetchExternalities.allTransfers();

    assert.deepStrictEqual(transfers, encodedTransfers);
  });

  it("should null when transfer index is not U32", () => {
    const transfers = prepareTransfers(5);
    const chainSpec = tinyChainSpec;
    const expectedTransferIndex = tryAsU64(2 ** 32 + 3);
    const expectedTransfer: PendingTransfer | null = null;

    const fetchExternalities = prepareOnTransferData({ transfers, chainSpec });

    const transfer = fetchExternalities.oneTransfer(expectedTransferIndex);

    assert.deepStrictEqual(transfer, expectedTransfer);
  });

  it("should null when transfer index is U32 but is incorrect", () => {
    const transfers = prepareTransfers(5);
    const chainSpec = tinyChainSpec;
    const expectedTransferIndex = tryAsU64(153);
    const expectedTransfer: PendingTransfer | null = null;

    const fetchExternalities = prepareOnTransferData({ transfers, chainSpec });

    const transfer = fetchExternalities.oneTransfer(expectedTransferIndex);

    assert.deepStrictEqual(transfer, expectedTransfer);
  });

  it("should return one transfer", () => {
    const transfers = prepareTransfers(5);
    const chainSpec = tinyChainSpec;
    const expectedOperandIndex = 3;
    const expectedTransfer = transfers[expectedOperandIndex];
    const encodedTransfer = Encoder.encodeObject(PendingTransfer.Codec, expectedTransfer, chainSpec);

    const fetchExternalities = prepareOnTransferData({ transfers, chainSpec });

    const transfer = fetchExternalities.oneTransfer(tryAsU64(expectedOperandIndex));

    assert.deepStrictEqual(transfer, encodedTransfer);
  });
});
