import assert from "node:assert";
import { describe, it } from "node:test";

import { type EntropyHash, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { WorkExecResult } from "@typeberry/block/work-result.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { codec, Encoder } from "@typeberry/codec";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { TRANSFER_MEMO_BYTES } from "@typeberry/jam-host-calls/externalities/partial-state.js";
import { PendingTransfer } from "@typeberry/jam-host-calls/externalities/pending-transfer.js";
import { tryAsU64 } from "@typeberry/numbers";
import { Operand } from "../accumulate/operand.js";
import {
  FetchExternalities,
  TRANSFER_OR_OPERAND,
  TransferOperandKind,
  type TransferOrOperand,
} from "./fetch-externalities.js";

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
          result: WorkExecResult.ok(BytesBlob.empty()),
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

  // allTransfersAndOperands: transfers first, then operands
  const toAllTransfersAndOperands = (operands: Operand[], transfers: PendingTransfer[]): TransferOrOperand[] => {
    return [
      ...transfers.map((t): TransferOrOperand => ({ kind: TransferOperandKind.TRANSFER, value: t })),
      ...operands.map((o): TransferOrOperand => ({ kind: TransferOperandKind.OPERAND, value: o })),
    ];
  };

  // oneTransferOrOperand: operands first (index < operands.length), then transfers
  const toOneTransferOrOperandAt = (
    operands: Operand[],
    transfers: PendingTransfer[],
    index: number,
  ): TransferOrOperand | null => {
    if (index >= operands.length + transfers.length) {
      return null;
    }
    if (index < operands.length) {
      return { kind: TransferOperandKind.OPERAND, value: operands[index] };
    }
    return { kind: TransferOperandKind.TRANSFER, value: transfers[index - operands.length] };
  };

  const encodeOneTransferOrOperand = (item: TransferOrOperand | null, chainSpec: ChainSpec): BytesBlob | null => {
    if (item === null) {
      return null;
    }
    return Encoder.encodeObject(TRANSFER_OR_OPERAND, item, chainSpec);
  };

  const prepareAccumulateData = ({
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
    return FetchExternalities.createForAccumulate(fetchData, chainSpec ?? defaultChainSpec);
  };

  const prepareRefineData = ({ chainSpec }: { chainSpec?: ChainSpec } = {}) => {
    const defaultChainSpec = tinyChainSpec;
    return FetchExternalities.createForRefine({ entropy: undefined }, chainSpec ?? defaultChainSpec);
  };

  describe("Accumulate", () => {
    it("should return different constants for different chain specs", () => {
      const tinyFetchExternalities = prepareAccumulateData({ chainSpec: tinyChainSpec });
      const fullFetchExternalities = prepareAccumulateData({ chainSpec: fullChainSpec });

      const tinyConstants = tinyFetchExternalities.constants();
      const fullConstants = fullFetchExternalities.constants();

      assert.notStrictEqual(tinyConstants.length, 0);
      assert.notStrictEqual(fullConstants.length, 0);
      assert.notDeepStrictEqual(tinyConstants, fullConstants);
    });

    it("should return entropy hash", () => {
      const expectedEntropy: EntropyHash = Bytes.fill(HASH_SIZE, 5).asOpaque();
      const fetchExternalities = prepareAccumulateData({ entropy: expectedEntropy });

      const entropy = fetchExternalities.entropy();

      assert.deepStrictEqual(entropy, expectedEntropy);
    });

    it("should return all transfers and operands", () => {
      const operands = prepareOperands(3);
      const transfers = prepareTransfers(2);
      const chainSpec = tinyChainSpec;
      const expected = toAllTransfersAndOperands(operands, transfers);
      const encodedExpected = Encoder.encodeObject(codec.sequenceVarLen(TRANSFER_OR_OPERAND), expected, chainSpec);

      const fetchExternalities = prepareAccumulateData({ operands, transfers, chainSpec });

      const result = fetchExternalities.allTransfersAndOperands();

      assert.deepStrictEqual(result, encodedExpected);
    });

    it("should return empty encoded sequence when no transfers and no operands", () => {
      const chainSpec = tinyChainSpec;
      const encodedExpected = Encoder.encodeObject(codec.sequenceVarLen(TRANSFER_OR_OPERAND), [], chainSpec);

      const fetchExternalities = prepareAccumulateData({ operands: [], transfers: [], chainSpec });

      const result = fetchExternalities.allTransfersAndOperands();

      assert.deepStrictEqual(result, encodedExpected);
    });

    it("should return one operand by index", () => {
      const operands = prepareOperands(3);
      const transfers = prepareTransfers(2);
      const chainSpec = tinyChainSpec;
      const encodedExpected = encodeOneTransferOrOperand(toOneTransferOrOperandAt(operands, transfers, 0), chainSpec);

      const fetchExternalities = prepareAccumulateData({ operands, transfers, chainSpec });

      // Operands come first (indices 0..2), then transfers (indices 3..4)
      const result = fetchExternalities.oneTransferOrOperand(tryAsU64(0));

      assert.deepStrictEqual(result, encodedExpected);
    });

    it("should return one transfer by index", () => {
      const operands = prepareOperands(3);
      const transfers = prepareTransfers(2);
      const chainSpec = tinyChainSpec;
      const encodedExpected = encodeOneTransferOrOperand(toOneTransferOrOperandAt(operands, transfers, 3), chainSpec);

      const fetchExternalities = prepareAccumulateData({ operands, transfers, chainSpec });

      // Transfers start after operands, so index 3 is the first transfer
      const result = fetchExternalities.oneTransferOrOperand(tryAsU64(3));

      assert.deepStrictEqual(result, encodedExpected);
    });

    it("should return null when index is out of bounds", () => {
      const operands = prepareOperands(3);
      const transfers = prepareTransfers(2);
      const chainSpec = tinyChainSpec;

      const fetchExternalities = prepareAccumulateData({ operands, transfers, chainSpec });

      // Total items: 3 operands + 2 transfers = 5, so index 5 is out of bounds
      const result = fetchExternalities.oneTransferOrOperand(tryAsU64(5));

      assert.strictEqual(result, null);
    });

    it("should return null when index is far out of bounds", () => {
      const operands = prepareOperands(3);
      const transfers = prepareTransfers(2);
      const chainSpec = tinyChainSpec;

      const fetchExternalities = prepareAccumulateData({ operands, transfers, chainSpec });

      const result = fetchExternalities.oneTransferOrOperand(tryAsU64(153));

      assert.strictEqual(result, null);
    });

    it("should have consistent encoding between all and one", () => {
      const operands = prepareOperands(2);
      const transfers = prepareTransfers(2);
      const chainSpec = tinyChainSpec;
      const allItems = toAllTransfersAndOperands(operands, transfers);
      const encodedAll = Encoder.encodeObject(codec.sequenceVarLen(TRANSFER_OR_OPERAND), allItems, chainSpec);

      const fetchExternalities = prepareAccumulateData({ operands, transfers, chainSpec });

      const all = fetchExternalities.allTransfersAndOperands();
      assert.deepStrictEqual(all, encodedAll);

      for (let i = 0; i < operands.length + transfers.length; i++) {
        const one = fetchExternalities.oneTransferOrOperand(tryAsU64(i));
        const encodedOne = encodeOneTransferOrOperand(toOneTransferOrOperandAt(operands, transfers, i), chainSpec);
        assert.deepStrictEqual(one, encodedOne, `Mismatch at index ${i}`);
      }

      const outOfRange = fetchExternalities.oneTransferOrOperand(tryAsU64(operands.length + transfers.length));
      assert.strictEqual(outOfRange, null);
    });

    it("should handle only operands without transfers", () => {
      const operands = prepareOperands(5);
      const chainSpec = tinyChainSpec;
      const allItems = toAllTransfersAndOperands(operands, []);
      const encodedAll = Encoder.encodeObject(codec.sequenceVarLen(TRANSFER_OR_OPERAND), allItems, chainSpec);

      const fetchExternalities = prepareAccumulateData({ operands, transfers: [], chainSpec });

      const result = fetchExternalities.allTransfersAndOperands();
      assert.deepStrictEqual(result, encodedAll);

      for (let i = 0; i < operands.length; i++) {
        const one = fetchExternalities.oneTransferOrOperand(tryAsU64(i));
        const encodedOne = encodeOneTransferOrOperand(toOneTransferOrOperandAt(operands, [], i), chainSpec);
        assert.deepStrictEqual(one, encodedOne, `Mismatch at operand index ${i}`);
      }

      const outOfRange = fetchExternalities.oneTransferOrOperand(tryAsU64(operands.length));
      assert.strictEqual(outOfRange, null);
    });

    it("should handle only transfers without operands", () => {
      const transfers = prepareTransfers(5);
      const chainSpec = tinyChainSpec;
      const allItems = toAllTransfersAndOperands([], transfers);
      const encodedAll = Encoder.encodeObject(codec.sequenceVarLen(TRANSFER_OR_OPERAND), allItems, chainSpec);

      const fetchExternalities = prepareAccumulateData({ operands: [], transfers, chainSpec });

      const result = fetchExternalities.allTransfersAndOperands();
      assert.deepStrictEqual(result, encodedAll);

      for (let i = 0; i < transfers.length; i++) {
        const one = fetchExternalities.oneTransferOrOperand(tryAsU64(i));
        const encodedOne = encodeOneTransferOrOperand(toOneTransferOrOperandAt([], transfers, i), chainSpec);
        assert.deepStrictEqual(one, encodedOne, `Mismatch at transfer index ${i}`);
      }

      const outOfRange = fetchExternalities.oneTransferOrOperand(tryAsU64(transfers.length));
      assert.strictEqual(outOfRange, null);
    });

    it("should return null for unimplemented methods", () => {
      const fetchExternalities = prepareAccumulateData({});

      assert.strictEqual(fetchExternalities.authorizerTrace(), null);
      assert.strictEqual(fetchExternalities.workItemExtrinsic(null, tryAsU64(0)), null);
      assert.strictEqual(fetchExternalities.workItemImport(null, tryAsU64(0)), null);
      assert.strictEqual(fetchExternalities.workPackage(), null);
      assert.strictEqual(fetchExternalities.authorizer(), null);
      assert.strictEqual(fetchExternalities.authorizationToken(), null);
      assert.strictEqual(fetchExternalities.refineContext(), null);
      assert.strictEqual(fetchExternalities.allWorkItems(), null);
      assert.strictEqual(fetchExternalities.oneWorkItem(tryAsU64(0)), null);
      assert.strictEqual(fetchExternalities.workItemPayload(tryAsU64(0)), null);
    });
  });

  describe("Refine", () => {
    it("should return different constants for different chain specs", () => {
      const tinyFetchExternalities = prepareRefineData({ chainSpec: tinyChainSpec });
      const fullFetchExternalities = prepareRefineData({ chainSpec: fullChainSpec });

      const tinyConstants = tinyFetchExternalities.constants();
      const fullConstants = fullFetchExternalities.constants();

      assert.notStrictEqual(tinyConstants.length, 0);
      assert.notStrictEqual(fullConstants.length, 0);
      assert.notDeepStrictEqual(tinyConstants, fullConstants);
    });

    it("should return null entropy", () => {
      const fetchExternalities = prepareRefineData();

      const entropy = fetchExternalities.entropy();

      assert.strictEqual(entropy, null);
    });

    it("should return null for allTransfersAndOperands", () => {
      const fetchExternalities = prepareRefineData();

      const result = fetchExternalities.allTransfersAndOperands();

      assert.strictEqual(result, null);
    });

    it("should return null for oneTransferOrOperand", () => {
      const fetchExternalities = prepareRefineData();

      const result = fetchExternalities.oneTransferOrOperand(tryAsU64(0));

      assert.strictEqual(result, null);
    });

    it("should return null for unimplemented methods", () => {
      const fetchExternalities = prepareRefineData();

      assert.strictEqual(fetchExternalities.authorizerTrace(), null);
      assert.strictEqual(fetchExternalities.workItemExtrinsic(null, tryAsU64(0)), null);
      assert.strictEqual(fetchExternalities.workItemImport(null, tryAsU64(0)), null);
      assert.strictEqual(fetchExternalities.workPackage(), null);
      assert.strictEqual(fetchExternalities.authorizer(), null);
      assert.strictEqual(fetchExternalities.authorizationToken(), null);
      assert.strictEqual(fetchExternalities.refineContext(), null);
      assert.strictEqual(fetchExternalities.allWorkItems(), null);
      assert.strictEqual(fetchExternalities.oneWorkItem(tryAsU64(0)), null);
      assert.strictEqual(fetchExternalities.workItemPayload(tryAsU64(0)), null);
    });
  });
});
