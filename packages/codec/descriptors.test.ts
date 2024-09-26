import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { Decoder } from "./decoder";
import { BYTES, CLASS, type Record, STRING, U32 } from "./descriptors";
import { Encoder } from "./encoder";

class TestHeader {
  static Codec = CLASS(TestHeader, {
    parentHeaderHash: BYTES(32),
    priorStateRoot: BYTES(32),
    extrinsicHash: BYTES(32),
  });

  public readonly parentHeaderHash: Bytes<32>;
  public readonly priorStateRoot: Bytes<32>;
  public readonly extrinsicHash: Bytes<32>;
  // this key is ignored, since it's not a string one.
  public readonly 0: number;

  constructor(o: Record<TestHeader>) {
    this.parentHeaderHash = o.parentHeaderHash;
    this.priorStateRoot = o.priorStateRoot;
    this.extrinsicHash = o.extrinsicHash;
  }
}

describe("Codec Descriptors / class", () => {
  const testData = () => {
    const encoder = Encoder.create();
    const parentHeaderHash = Bytes.zero(32);
    encoder.bytes(parentHeaderHash);

    const priorStateRoot = Bytes.fill(32, 1);
    encoder.bytes(priorStateRoot);

    const extrinsicHash = Bytes.fill(32, 5);
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

    const headerView = TestHeader.Codec.View.fromBytesBlob(data.bytes);
    assert.deepStrictEqual(headerView.parentHeaderHash(), data.parentHeaderHash);
    assert.deepStrictEqual(headerView.extrinsicHash(), data.extrinsicHash);
    assert.deepStrictEqual(headerView.priorStateRoot(), data.priorStateRoot);
    // now this should come from cache
    assert.deepStrictEqual(headerView.parentHeaderHash(), data.parentHeaderHash);
    assert.deepStrictEqual(headerView.extrinsicHash(), data.extrinsicHash);
    assert.deepStrictEqual(headerView.priorStateRoot(), data.priorStateRoot);
  });

  it("should materialize a lazy view", () => {
    // given
    const data = testData();

    const headerView = TestHeader.Codec.View.fromBytesBlob(data.bytes);
    // read one data point to have something in cache, but not everything
    assert.deepStrictEqual(headerView.parentHeaderHash(), data.parentHeaderHash);

    const header = headerView.materialize();
    assert.deepStrictEqual(header.parentHeaderHash, data.parentHeaderHash);
    assert.deepStrictEqual(header.extrinsicHash, data.extrinsicHash);
    assert.deepStrictEqual(header.priorStateRoot, data.priorStateRoot);
  });

  it("should decode a class", () => {
    // given
    const data = testData();

    const header = Decoder.decodeObject(TestHeader.Codec, data.bytes);

    assert.deepStrictEqual(header.parentHeaderHash, data.parentHeaderHash);
    assert.deepStrictEqual(header.extrinsicHash, data.extrinsicHash);
    assert.deepStrictEqual(header.priorStateRoot, data.priorStateRoot);
  });

  it("should encode a class", () => {
    // given
    const data = testData();
    const header = new TestHeader({
      parentHeaderHash: data.parentHeaderHash,
      priorStateRoot: data.priorStateRoot,
      extrinsicHash: data.extrinsicHash,
    });

    const result = Encoder.encodeObject(TestHeader.Codec, header);

    assert.deepStrictEqual(result, data.bytes);
    assert.deepStrictEqual(TestHeader.Codec.sizeHintBytes, 3 * 32);
  });
});

describe("Codec Descriptors / nested views", () => {
  class TestExtrinsic {
    static Codec = CLASS(TestExtrinsic, {
      kind: STRING,
    });

    kind: string;

    constructor(o: Record<TestExtrinsic>) {
      this.kind = o.kind;
    }
  }

  class TestBlock {
    static Codec = CLASS(TestBlock, {
      someUnrelatedField: U32,
      header: TestHeader.Codec,
      extrinsic: TestExtrinsic.Codec,
    });

    public readonly someUnrelatedField: number;
    public readonly header: TestHeader;
    public readonly extrinsic: TestExtrinsic;

    constructor(o: Record<TestBlock>) {
      this.someUnrelatedField = o.someUnrelatedField;
      this.header = o.header;
      this.extrinsic = o.extrinsic;
    }
  }

  const testData = () => {
    const encoder = Encoder.create();
    // field
    encoder.i32(0xdeadbeef);

    // Header
    const parentHeaderHash = Bytes.zero(32);
    encoder.bytes(parentHeaderHash);
    const priorStateRoot = Bytes.fill(32, 1);
    encoder.bytes(priorStateRoot);
    const extrinsicHash = Bytes.fill(32, 5);
    encoder.bytes(extrinsicHash);

    // Extrinsic
    STRING.encode(encoder, "hello world!");

    return {
      bytes: encoder.viewResult(),
      parentHeaderHash,
      priorStateRoot,
      extrinsicHash,
    };
  };

  it("should decode nested structures", () => {
    // when
    const data = testData();
    const block = Decoder.decodeObject(TestBlock.Codec, data.bytes);

    // then
    assert.strictEqual(block.someUnrelatedField, 0xdeadbeef);

    const header = block.header;
    assert.strictEqual(header.parentHeaderHash.toString(), data.parentHeaderHash.toString());
    assert.strictEqual(header.priorStateRoot.toString(), data.priorStateRoot.toString());
    assert.strictEqual(header.extrinsicHash.toString(), data.extrinsicHash.toString());

    assert.deepStrictEqual(
      block.extrinsic,
      new TestExtrinsic({
        kind: "hello world!",
      }),
    );
  });

  it("should encode in the same way", () => {
    // given
    const block = Decoder.decodeObject(TestBlock.Codec, testData().bytes);

    // when
    const encoded = Encoder.encodeObject(TestBlock.Codec, block);

    // then
    assert.strictEqual(encoded.toString(), testData().bytes.toString());
  });

  it("should return a nested view", () => {
    // given
    const data = testData();
    const blockView = new TestBlock.Codec.View(Decoder.fromBytesBlob(data.bytes));

    // when
    const headerView = blockView.headerView();

    // then
    assert.strictEqual(`${headerView.extrinsicHash()}`, `${data.extrinsicHash}`);
    assert.strictEqual(`${headerView.priorStateRoot()}`, `${data.priorStateRoot}`);
  });
});
