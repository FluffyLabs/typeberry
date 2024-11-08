import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import { Decoder } from "./decoder";
import { type CodecRecord, codec } from "./descriptors";
import { Encoder } from "./encoder";

class TestHeader {
  static Codec = codec.Class(TestHeader, {
    parentHeaderHash: codec.bytes(32),
    priorStateRoot: codec.bytes(32),
    extrinsicHash: codec.bytes(32),
  });

  static fromCodec = ({ parentHeaderHash, priorStateRoot, extrinsicHash }: CodecRecord<TestHeader>) =>
    new TestHeader(parentHeaderHash, priorStateRoot, extrinsicHash);

  // this key is ignored, since it's not a string one.
  public readonly 0: number;

  public constructor(
    public readonly parentHeaderHash: Bytes<32>,
    public readonly priorStateRoot: Bytes<32>,
    public readonly extrinsicHash: Bytes<32>,
  ) {}
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
    const header = new TestHeader(data.parentHeaderHash, data.priorStateRoot, data.extrinsicHash);

    const result = Encoder.encodeObject(TestHeader.Codec, header);

    assert.deepStrictEqual(result, data.bytes);
    assert.deepStrictEqual(TestHeader.Codec.sizeHintBytes, 3 * 32);
  });
});

describe("Codec Descriptors / nested views", () => {
  class TestExtrinsic {
    static Codec = codec.Class(TestExtrinsic, {
      kind: codec.string,
    });

    static fromCodec(o: CodecRecord<TestExtrinsic>) {
      return new TestExtrinsic(o.kind);
    }

    public constructor(public kind: string) {}
  }

  class TestBlock {
    static Codec = codec.Class(TestBlock, {
      someUnrelatedField: codec.u32,
      header: TestHeader.Codec,
      extrinsic: TestExtrinsic.Codec,
    });

    static fromCodec(o: CodecRecord<TestBlock>) {
      return new TestBlock(o.someUnrelatedField, o.header, o.extrinsic);
    }

    public constructor(
      public readonly someUnrelatedField: U32,
      public readonly header: TestHeader,
      public readonly extrinsic: TestExtrinsic,
    ) {}
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
    codec.string.encode(encoder, "hello world!");

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

    assert.deepStrictEqual(block.extrinsic, new TestExtrinsic("hello world!"));
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

  it("should create a view after field was decoded", () => {
    // given
    const data = testData();
    const blockView = new TestBlock.Codec.View(Decoder.fromBytesBlob(data.bytes));

    // when
    const header = blockView.header();
    const headerView = blockView.headerView();

    // then
    assert.strictEqual(`${header.extrinsicHash}`, `${data.extrinsicHash}`);
    assert.strictEqual(`${header.priorStateRoot}`, `${data.priorStateRoot}`);
    // view?
    assert.strictEqual(`${headerView.extrinsicHash()}`, `${data.extrinsicHash}`);
    assert.strictEqual(`${headerView.priorStateRoot()}`, `${data.priorStateRoot}`);
  });
});

describe("Codec Descriptors / generic class", () => {
  abstract class Generic<A, B> {
    constructor(
      public readonly a: A,
      public readonly b: B,
    ) {}
  }

  class Concrete extends Generic<U32, boolean> {
    static Codec = codec.Class(Concrete, {
      a: codec.varU32,
      b: codec.bool,
    });

    static fromCodec({ a, b }: CodecRecord<Concrete>) {
      return new Concrete(a, b);
    }

    toString() {
      return `${this.a} ${this.b}`;
    }
  }

  it("should encode/decode concrete instance of generic class", () => {
    const input = new Concrete(tryAsU32(15), true);
    const encoded = Encoder.encodeObject(Concrete.Codec, input);
    const decoded = Decoder.decodeObject(Concrete.Codec, encoded);

    assert.deepStrictEqual(decoded, input);
  });
});

describe("Codec Descriptors / dictionary", () => {
  it("should encode/decode a dictionary", () => {
    const input = new Map<U32, Bytes<32>>();
    input.set(tryAsU32(10), Bytes.fill(32, 10));
    input.set(tryAsU32(1), Bytes.fill(32, 1));
    input.set(tryAsU32(15), Bytes.fill(32, 15));

    const dictCodec = codec.dictionary(codec.u32, codec.bytes(32), {
      sortKeys: (a, b) => a - b,
    });

    const encoded = Encoder.encodeObject(dictCodec, input);
    const decoded = Decoder.decodeObject(dictCodec, encoded);

    assert.deepStrictEqual(decoded, input);
    assert.deepStrictEqual(
      encoded.toString(),
      "0x030100000001010101010101010101010101010101010101010101010101010101010101010a0000000a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0f0000000f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f",
    );
  });

  it("should encode/decode a known-length dictionary", () => {
    const input = new Map<U32, Bytes<32>>();
    input.set(tryAsU32(10), Bytes.fill(32, 10));
    input.set(tryAsU32(1), Bytes.fill(32, 1));
    input.set(tryAsU32(15), Bytes.fill(32, 15));

    const dictCodec = codec.dictionary(codec.u32, codec.bytes(32), {
      sortKeys: (a, b) => a - b,
      fixedLength: 3,
    });

    const encoded = Encoder.encodeObject(dictCodec, input);
    const decoded = Decoder.decodeObject(dictCodec, encoded);

    assert.deepStrictEqual(decoded, input);
    assert.deepStrictEqual(
      encoded.toString(),
      "0x0100000001010101010101010101010101010101010101010101010101010101010101010a0000000a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0f0000000f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f",
    );
  });
});
