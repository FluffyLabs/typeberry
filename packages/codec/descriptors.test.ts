import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "./encoder";
import {BYTES, CLASS} from "./descriptors";
import {Decoder} from "./decoder";

describe.only("Codec Descriptors / class", () => {
  class TestHeader {
    static Codec = CLASS(
      "TestHeader",
      TestHeader,
      {
        parentHeaderHash: BYTES(32),
        priorStateRoot: BYTES(32),
        extrinsicHash: BYTES(32),
      });

      constructor(
        public readonly parentHeaderHash: Bytes<32>,
        public readonly priorStateRoot: Bytes<32>,
        public readonly extrinsicHash: Bytes<32>,
      ) {}
  }

  const testData = () => {
    const encoder = Encoder.create();
    const parentHeaderHash = Bytes.zero(32);
    encoder.bytes(parentHeaderHash);

    const priorStateRoot = Bytes.zero(32);
    priorStateRoot.raw.fill(1, 0, 32);
    encoder.bytes(priorStateRoot);

    const extrinsicHash = Bytes.zero(32);
    extrinsicHash.raw.fill(5, 0, 32);
    encoder.bytes(extrinsicHash);

    return {
      bytes: encoder.viewResult(),
      parentHeaderHash,
      priorStateRoot,
      extrinsicHash,
    };
  };

  it("should create a lazy view", () => {
    // given
    const data = testData();

    const headerView = new TestHeader.Codec.View(Decoder.fromBytesBlob(data.bytes));
    assert.deepStrictEqual(headerView.parentHeaderHash(), data.parentHeaderHash);
    assert.deepStrictEqual(headerView.extrinsicHash(), data.extrinsicHash);
    assert.deepStrictEqual(headerView.priorStateRoot(), data.priorStateRoot);
    // now this should come from cache
    assert.deepStrictEqual(headerView.parentHeaderHash(), data.parentHeaderHash);
    assert.deepStrictEqual(headerView.extrinsicHash(), data.extrinsicHash);
    assert.deepStrictEqual(headerView.priorStateRoot(), data.priorStateRoot);
  });

  it("should decode a class", () => {
    // given
    const data = testData();

    const header = TestHeader.Codec.decode(Decoder.fromBytesBlob(data.bytes));

    assert.deepStrictEqual(header.parentHeaderHash, data.parentHeaderHash);
    assert.deepStrictEqual(header.extrinsicHash, data.extrinsicHash);
    assert.deepStrictEqual(header.priorStateRoot, data.priorStateRoot);
  });

  it('should encode a class', () => {
    // given
    const data = testData();
    const header = new TestHeader(
      data.parentHeaderHash,
      data.priorStateRoot,
      data.extrinsicHash
    );

    const encoder = Encoder.create({ expectedLength: TestHeader.Codec.sizeHintBytes });
    TestHeader.Codec.encode(encoder, header);

    assert.deepStrictEqual(encoder.viewResult(), data.bytes);
    assert.deepStrictEqual(TestHeader.Codec.sizeHintBytes, 3 * 32);
  });

});


