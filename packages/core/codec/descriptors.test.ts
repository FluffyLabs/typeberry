import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import { Decoder } from "./decoder.js";
import type { CodecRecord } from "./descriptor.js";
import { codec } from "./descriptors.js";
import { Encoder } from "./encoder.js";

class TestHeader {
  static Codec = codec.Class(TestHeader, {
    parentHeaderHash: codec.bytes(32),
    priorStateRoot: codec.bytes(32),
    extrinsicHash: codec.bytes(32),
  });

  static create = ({ parentHeaderHash, priorStateRoot, extrinsicHash }: CodecRecord<TestHeader>) =>
    new TestHeader(parentHeaderHash, priorStateRoot, extrinsicHash);

  // this key is ignored, since it's not a string one.
  public readonly 0: number;

  public constructor(
    public readonly parentHeaderHash: Bytes<32>,
    public readonly priorStateRoot: Bytes<32>,
    public readonly extrinsicHash: Bytes<32>,
  ) {}
}

describe("Codec Descriptors / sequence view", () => {
  class MyHash {
    static Codec = codec.Class(MyHash, {
      hash: codec.bytes(32),
    });
    static create = ({ hash }: CodecRecord<MyHash>) => new MyHash(hash);
    constructor(public readonly hash: Bytes<32>) {}
  }

  const headerSeq = codec.sequenceFixLen(MyHash.Codec, 10);
  const data = [
    new MyHash(Bytes.fill(32, 0)),
    new MyHash(Bytes.fill(32, 1)),
    new MyHash(Bytes.fill(32, 2)),
    new MyHash(Bytes.fill(32, 3)),
    new MyHash(Bytes.fill(32, 4)),
    new MyHash(Bytes.fill(32, 5)),
    new MyHash(Bytes.fill(32, 6)),
    new MyHash(Bytes.fill(32, 7)),
    new MyHash(Bytes.fill(32, 8)),
    new MyHash(Bytes.fill(32, 9)),
  ];
  const encoded = Encoder.encodeObject(headerSeq, data);

  it("should encode & decode", () => {
    const seqView = Decoder.decodeObject(headerSeq.View, encoded);

    // when
    const reEncoded = Encoder.encodeObject(headerSeq.View, seqView);

    // then
    assert.deepStrictEqual(reEncoded, encoded);
  });

  it("should retrieve one item", () => {
    const seqView = Decoder.decodeObject(headerSeq.View, encoded);

    // when
    const item5 = seqView.get(5);

    // then
    assert.deepStrictEqual(
      item5?.encoded().toString(),
      "0x0505050505050505050505050505050505050505050505050505050505050505",
    );
    assert.deepStrictEqual(item5?.materialize(), new MyHash(Bytes.fill(32, 5)));
    assert.deepStrictEqual(item5?.view().hash.materialize(), Bytes.fill(32, 5));
    assert.deepStrictEqual(item5?.view().hash.view(), Bytes.fill(32, 5));
  });

  it("should iterate over all items", () => {
    const seqView = Decoder.decodeObject(headerSeq.View, encoded);

    let i = 0;
    for (const item of seqView) {
      assert.deepStrictEqual(item?.materialize(), new MyHash(Bytes.fill(32, i)));
      i++;
    }
    assert.deepStrictEqual(i, 10);
  });

  it("should map all items", () => {
    const seqView = Decoder.decodeObject(headerSeq.View, encoded);

    const mapped = seqView.map((x) => x.view().hash.encoded());
    const materialized = seqView.map((x) => x.materialize().hash);
    assert.deepStrictEqual(mapped.length, seqView.length);
    assert.deepStrictEqual(materialized.length, seqView.length);
    for (let i = 0; i < 10; i++) {
      assert.strictEqual(mapped[i].toString(), materialized[i].toString());
    }
  });
});

describe("Codec Descriptors / object", () => {
  it("should encode & decode", () => {
    const headerCodec = codec.object({
      parentHeaderHash: codec.bytes(32),
      priorStateRoot: codec.bytes(32),
      extrinsicHash: codec.bytes(32),
    });

    const elem = {
      parentHeaderHash: Bytes.fill(32, 1),
      priorStateRoot: Bytes.fill(32, 2),
      extrinsicHash: Bytes.fill(32, 3),
    };
    const encoded = Encoder.encodeObject(headerCodec, elem);
    assert.deepStrictEqual(
      `${encoded}`,
      "0x010101010101010101010101010101010101010101010101010101010101010102020202020202020202020202020202020202020202020202020202020202020303030303030303030303030303030303030303030303030303030303030303",
    );

    const decoded = Decoder.decodeObject(headerCodec, encoded);
    assert.deepStrictEqual(decoded, elem);
  });
});

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

    const headerView = Decoder.decodeObject(TestHeader.Codec.View, data.bytes);
    assert.deepStrictEqual(headerView.parentHeaderHash.view(), data.parentHeaderHash);
    assert.deepStrictEqual(headerView.extrinsicHash.view(), data.extrinsicHash);
    assert.deepStrictEqual(headerView.priorStateRoot.view(), data.priorStateRoot);
    // now this should come from cache
    assert.deepStrictEqual(headerView.parentHeaderHash.materialize(), data.parentHeaderHash);
    assert.deepStrictEqual(headerView.extrinsicHash.materialize(), data.extrinsicHash);
    assert.deepStrictEqual(headerView.priorStateRoot.materialize(), data.priorStateRoot);
    assert.deepStrictEqual(headerView.encoded(), data.bytes);
  });

  it("should materialize a lazy view", () => {
    // given
    const data = testData();

    const headerView = Decoder.decodeObject(TestHeader.Codec.View, data.bytes);
    // read one data point to have something in cache, but not everything
    assert.deepStrictEqual(headerView.parentHeaderHash.view(), data.parentHeaderHash);

    const header = headerView.materialize();
    assert.deepStrictEqual(header.parentHeaderHash, data.parentHeaderHash);
    assert.deepStrictEqual(header.extrinsicHash, data.extrinsicHash);
    assert.deepStrictEqual(header.priorStateRoot, data.priorStateRoot);
    assert.deepStrictEqual(headerView.encoded(), data.bytes);
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
    assert.deepStrictEqual(TestHeader.Codec.sizeHint, { bytes: 3 * 32, isExact: true });
  });
});

describe("Codec Descriptors / nested views", () => {
  class TestExtrinsic {
    static Codec = codec.Class(TestExtrinsic, {
      kind: codec.string,
    });

    static create(o: CodecRecord<TestExtrinsic>) {
      return new TestExtrinsic(o.kind);
    }

    private constructor(public kind: string) {}
  }

  class TestBlock {
    static Codec = codec.Class(TestBlock, {
      someUnrelatedField: codec.u32,
      header: TestHeader.Codec,
      extrinsic: TestExtrinsic.Codec,
    });

    static create(o: CodecRecord<TestBlock>) {
      return new TestBlock(o.someUnrelatedField, o.header, o.extrinsic);
    }

    private constructor(
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
    assert.strictEqual(`${header.parentHeaderHash}`, `${data.parentHeaderHash}`);
    assert.strictEqual(`${header.priorStateRoot}`, `${data.priorStateRoot}`);
    assert.strictEqual(`${header.extrinsicHash}`, `${data.extrinsicHash}`);

    assert.deepStrictEqual(block.extrinsic, TestExtrinsic.create({ kind: "hello world!" }));
  });

  it("should encode in the same way", () => {
    // given
    const blockBytes = testData().bytes;
    const block = Decoder.decodeObject(TestBlock.Codec, blockBytes);
    const blockView = Decoder.decodeObject(TestBlock.Codec.View, blockBytes);

    // when
    const encoded = Encoder.encodeObject(TestBlock.Codec, block);

    // then
    assert.strictEqual(`${encoded}`, `${blockBytes}`);
    assert.strictEqual(`${blockView.encoded()}`, `${blockBytes}`);
  });

  it("should return a nested view", () => {
    // given
    const data = testData();
    const blockView = Decoder.decodeObject(TestBlock.Codec.View, data.bytes);

    // when
    const headerView = blockView.header.view();

    // then
    assert.strictEqual(`${headerView.extrinsicHash.view()}`, `${data.extrinsicHash}`);
    assert.strictEqual(`${headerView.priorStateRoot.materialize()}`, `${data.priorStateRoot}`);
  });

  it("should return encoded data of the nested view", () => {
    // given
    const data = testData();
    const blockView = Decoder.decodeObject(TestBlock.Codec.View, data.bytes);
    const block = Decoder.decodeObject(TestBlock.Codec, data.bytes);
    const headerEncoded = Encoder.encodeObject(TestHeader.Codec, block.header);

    // when
    const headerView = blockView.header.view();

    // then
    assert.strictEqual(`${headerView.encoded()}`, `${headerEncoded}`);
  });

  it("should create a view after field was decoded", () => {
    // given
    const data = testData();
    const blockView = Decoder.decodeObject(TestBlock.Codec.View, data.bytes);

    // when
    const header = blockView.header.materialize();
    const headerView = blockView.header.view();

    // then
    assert.strictEqual(`${header.extrinsicHash}`, `${data.extrinsicHash}`);
    assert.strictEqual(`${header.priorStateRoot}`, `${data.priorStateRoot}`);
    // view?
    assert.strictEqual(`${headerView.extrinsicHash.materialize()}`, `${data.extrinsicHash}`);
    assert.strictEqual(`${headerView.priorStateRoot.materialize()}`, `${data.priorStateRoot}`);
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

    static create({ a, b }: CodecRecord<Concrete>) {
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
      `${encoded}`,
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
      `${encoded}`,
      "0x0100000001010101010101010101010101010101010101010101010101010101010101010a0000000a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0f0000000f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f",
    );
  });
});

describe("Codec Descriptors / pair", () => {
  it("should encode/decode a pair", () => {
    const input: [U32, BytesBlob] = [tryAsU32(1245), BytesBlob.blobFromString("hello world!")];
    const pairCodec = codec.pair(codec.u32, codec.blob);

    const encoded = Encoder.encodeObject(pairCodec, input);
    const decoded = Decoder.decodeObject(pairCodec, encoded);

    assert.deepStrictEqual(decoded, input);
    assert.deepStrictEqual(`${encoded}`, "0xdd0400000c68656c6c6f20776f726c6421");
  });
});
