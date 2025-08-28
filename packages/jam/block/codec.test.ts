import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Decoder, Encoder, codec } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { type Opaque, asOpaqueType } from "@typeberry/utils";
import { codecHashDictionary, codecMap } from "./codec.js";
import type { PreimageHash } from "./preimage.js";
import { tryAsSegmentIndex } from "./work-item-segment.js";
import { ImportSpec } from "./work-item.js";

describe("JAM types codec / HashDictionary", () => {
  const dictionaryCodec = codecHashDictionary(ImportSpec.Codec, (x) => x.treeRoot, { typicalLength: 10 });

  const arrayCodec = codec.sequenceVarLen(ImportSpec.Codec);

  const hash = (num: number): PreimageHash => Bytes.fill(HASH_SIZE, num).asOpaque();

  it("should be compatible with a list", () => {
    const list = [
      ImportSpec.create({ treeRoot: hash(1), index: tryAsSegmentIndex(15) }),
      ImportSpec.create({ treeRoot: hash(2), index: tryAsSegmentIndex(30) }),
      ImportSpec.create({ treeRoot: hash(3), index: tryAsSegmentIndex(65_300) }),
    ];

    const encoded = Encoder.encodeObject(arrayCodec, list);
    const decoded = Decoder.decodeObject(dictionaryCodec, encoded);
    const reencoded = Encoder.encodeObject(dictionaryCodec, decoded);
    const decodedlist = Decoder.decodeObject(arrayCodec, reencoded);

    assert.deepStrictEqual(list, decodedlist);
    assert.deepStrictEqual(encoded.toString(), reencoded.toString());
    assert.deepStrictEqual(list, Array.from(decoded.values()));
  });

  it("should throw an error if order is incorrect", () => {
    const list = [
      ImportSpec.create({ treeRoot: hash(2), index: tryAsSegmentIndex(30) }),
      ImportSpec.create({ treeRoot: hash(3), index: tryAsSegmentIndex(65_300) }),
      ImportSpec.create({ treeRoot: hash(1), index: tryAsSegmentIndex(15) }),
    ];

    const encoded = Encoder.encodeObject(arrayCodec, list);

    assert.throws(() => {
      Decoder.decodeObject(dictionaryCodec, encoded);
    }, new Error(
      'The keys in dictionary encoding are not sorted "ImportSpec {treeRoot: 0x0303030303030303030303030303030303030303030303030303030303030303,index: 65300 (0xff14),}" >= "ImportSpec {treeRoot: 0x0101010101010101010101010101010101010101010101010101010101010101,index: 15 (0xf),}"!',
    ));
  });

  it("should throw an error if there are duplicates", () => {
    const list = [
      ImportSpec.create({ treeRoot: hash(1), index: tryAsSegmentIndex(15) }),
      ImportSpec.create({ treeRoot: hash(2), index: tryAsSegmentIndex(30) }),
      ImportSpec.create({ treeRoot: hash(3), index: tryAsSegmentIndex(65_300) }),
      ImportSpec.create({ treeRoot: hash(3), index: tryAsSegmentIndex(65_300) }),
    ];

    const encoded = Encoder.encodeObject(arrayCodec, list);

    assert.throws(() => {
      Decoder.decodeObject(dictionaryCodec, encoded);
    }, new Error(
      'Duplicate item in the dictionary encoding: "0x0303030303030303030303030303030303030303030303030303030303030303"!',
    ));
  });
});

describe("JAM types codec / Map", () => {
  type StorageKey = Opaque<BytesBlob, "storage key">;

  class StorageItem {
    static Codec = codec.Class(StorageItem, {
      key: codec.blob.convert(
        (i) => i,
        (o) => asOpaqueType(o),
      ),
      value: codec.blob,
    });

    static create({ key, value }: CodecRecord<StorageItem>) {
      return new StorageItem(key, value);
    }

    private constructor(
      readonly key: StorageKey,
      readonly value: BytesBlob,
    ) {}
  }
  const dictionaryCodec = codecMap(StorageItem.Codec, (x) => x.key.toString(), { typicalLength: 10 });

  const arrayCodec = codec.sequenceVarLen(StorageItem.Codec);

  it("should be compatible with a list", () => {
    const list = ["0x00", "0x01", "0x02"]
      .map(BytesBlob.parseBlob)
      .map((x) => StorageItem.create({ key: asOpaqueType(x), value: x }));

    const encoded = Encoder.encodeObject(arrayCodec, list);
    const decoded = Decoder.decodeObject(dictionaryCodec, encoded);
    const reencoded = Encoder.encodeObject(dictionaryCodec, decoded);
    const decodedlist = Decoder.decodeObject(arrayCodec, reencoded);

    assert.deepStrictEqual(list, decodedlist);
    assert.deepStrictEqual(encoded.toString(), reencoded.toString());
    assert.deepStrictEqual(list, Array.from(decoded.values()));
  });

  it("should throw an error if order is incorrect", () => {
    const list = ["0x00", "0x02", "0x01"]
      .map(BytesBlob.parseBlob)
      .map((x) => StorageItem.create({ key: asOpaqueType(x), value: x }));

    const encoded = Encoder.encodeObject(arrayCodec, list);

    assert.throws(() => {
      Decoder.decodeObject(dictionaryCodec, encoded);
    }, new Error('The keys in dictionary encoding are not sorted "0x02" >= "0x01"!'));
  });

  it("should throw an error if there are duplicates", () => {
    const list = ["0x00", "0x01", "0x01"]
      .map(BytesBlob.parseBlob)
      .map((x) => StorageItem.create({ key: asOpaqueType(x), value: x }));

    const encoded = Encoder.encodeObject(arrayCodec, list);

    assert.throws(() => {
      Decoder.decodeObject(dictionaryCodec, encoded);
    }, new Error('Duplicate item in the dictionary encoding: "0x01"!'));
  });
});
