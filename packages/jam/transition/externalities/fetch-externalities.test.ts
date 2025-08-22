import assert from "node:assert";
import { describe, it } from "node:test";

import { type EntropyHash, tryAsServiceGas } from "@typeberry/block";
import { WorkExecResult, WorkExecResultKind } from "@typeberry/block/work-result.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder, codec } from "@typeberry/codec";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { Operand, Operand_0_6_4 } from "../accumulate/operand.js";
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
          // gas: tryAsServiceGas(i + 3),
          hash: Bytes.fill(HASH_SIZE, i + 4).asOpaque(),
          payloadHash: Bytes.fill(HASH_SIZE, i + 5).asOpaque(),
          result: new WorkExecResult(WorkExecResultKind.ok, BytesBlob.empty()),
          gas: tryAsServiceGas(1_000),
        }),
      );
    }

    return operands;
  };

  const prepareData = ({
    chainSpec,
    operands,
    entropy,
  }: { chainSpec?: ChainSpec; operands?: Operand[]; entropy?: EntropyHash }) => {
    const defaultChainSpec = tinyChainSpec;
    const defaultEntropy: EntropyHash = Bytes.zero(HASH_SIZE).asOpaque();
    const defaultOperands: Operand[] = [];
    const fetchData = {
      entropy: entropy ?? defaultEntropy,
      operands: operands ?? defaultOperands,
    };
    return [fetchData, chainSpec ?? defaultChainSpec] as const;
  };

  it("should return different constants for different chain specs", () => {
    const tinyArgs = prepareData({ chainSpec: tinyChainSpec });
    const fullArgs = prepareData({ chainSpec: fullChainSpec });

    const tinyFetchExternalities = new FetchExternalities(...tinyArgs);
    const fullFetchExternalities = new FetchExternalities(...fullArgs);

    const tinyContants = tinyFetchExternalities.constants();
    const fullContants = fullFetchExternalities.constants();

    assert.notStrictEqual(tinyContants.length, 0);
    assert.notStrictEqual(fullContants.length, 0);
    assert.notDeepStrictEqual(tinyContants, fullContants);
  });

  it("should return null for all methods that are not important during accumulate", () => {
    const args = prepareData({ chainSpec: fullChainSpec });

    const fetchExternalities = new FetchExternalities(...args);

    assert.strictEqual(fetchExternalities.authorizerTrace(), null);
    assert.strictEqual(fetchExternalities.workItemExtrinsic(tryAsU64(0), tryAsU64(0)), null);
    assert.strictEqual(fetchExternalities.workItemImport(tryAsU64(0), tryAsU64(0)), null);
    assert.strictEqual(fetchExternalities.workPackage(), null);
    assert.strictEqual(fetchExternalities.authorizer(), null);
    assert.strictEqual(fetchExternalities.authorizationToken(), null);
    assert.strictEqual(fetchExternalities.refineContext(), null);
    assert.strictEqual(fetchExternalities.allWorkItems(), null);
    assert.strictEqual(fetchExternalities.oneWorkItem(tryAsU64(0)), null);
    assert.strictEqual(fetchExternalities.workItemPayload(tryAsU64(0)), null);
    assert.strictEqual(fetchExternalities.allTransfers(), null);
    assert.strictEqual(fetchExternalities.oneTransfer(tryAsU64(0)), null);
  });

  it("should return entropy hash", () => {
    const expectedEntropy: EntropyHash = Bytes.fill(HASH_SIZE, 5).asOpaque();
    const args = prepareData({ entropy: expectedEntropy });

    const fetchExternalities = new FetchExternalities(...args);

    const entropy = fetchExternalities.entropy();

    assert.deepStrictEqual(entropy, expectedEntropy);
  });

  it("should return all operands", () => {
    const expectedOperands = prepareOperands(5);
    const chainSpec = tinyChainSpec;
    const encodedOperands = Compatibility.is(GpVersion.V0_6_4)
      ? Encoder.encodeObject(codec.sequenceVarLen(Operand_0_6_4.Codec), expectedOperands, chainSpec)
      : Encoder.encodeObject(codec.sequenceVarLen(Operand.Codec), expectedOperands, chainSpec);

    const args = prepareData({ operands: expectedOperands, chainSpec });

    const fetchExternalities = new FetchExternalities(...args);

    const operands = fetchExternalities.allOperands();

    assert.deepStrictEqual(operands, encodedOperands);
  });

  it("should null when operand index is not U32", () => {
    const operands = prepareOperands(5);
    const chainSpec = tinyChainSpec;
    const expectedOperandIndex = 2 ** 32 + 3;
    const expectedOperand: Operand | null = null;

    const args = prepareData({ operands, chainSpec });

    const fetchExternalities = new FetchExternalities(...args);

    const operand = fetchExternalities.oneOperand(tryAsU64(expectedOperandIndex));

    assert.deepStrictEqual(operand, expectedOperand);
  });

  it("should null when operand index is U32 but is incorrect", () => {
    const operands = prepareOperands(5);
    const chainSpec = tinyChainSpec;
    const expectedOperandIndex = 153;
    const expectedOperand: Operand | null = null;

    const args = prepareData({ operands, chainSpec });

    const fetchExternalities = new FetchExternalities(...args);

    const operand = fetchExternalities.oneOperand(tryAsU64(expectedOperandIndex));

    assert.deepStrictEqual(operand, expectedOperand);
  });

  it("should return one operand", () => {
    const operands = prepareOperands(5);
    const chainSpec = tinyChainSpec;
    const expectedOperandIndex = 3;
    const expectedOperand = operands[expectedOperandIndex];
    const encodedOperand = Compatibility.is(GpVersion.V0_6_4)
      ? Encoder.encodeObject(Operand_0_6_4.Codec, expectedOperand, chainSpec)
      : Encoder.encodeObject(Operand.Codec, expectedOperand, chainSpec);

    const args = prepareData({ operands, chainSpec });

    const fetchExternalities = new FetchExternalities(...args);

    const operand = fetchExternalities.oneOperand(tryAsU64(expectedOperandIndex));

    assert.deepStrictEqual(operand, encodedOperand);
  });
});
