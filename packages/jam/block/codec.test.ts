import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder, codec } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { codecHashDictionary } from "./codec";
import type { PreimageHash } from "./preimage";
import { ImportSpec } from "./work-item";
import { tryAsSegmentIndex } from "./work-item-segment";

describe("JAM types codec / HashDictionary", () => {
  const dictionaryCodec = codecHashDictionary(ImportSpec.Codec, (x) => x.treeRoot, { typicalLength: 10 });

  const arrayCodec = codec.sequenceVarLen(ImportSpec.Codec);

  const hash = (num: number): PreimageHash => Bytes.fill(HASH_SIZE, num).asOpaque();

  it("should be compatible with a list", () => {
    const list = [
      new ImportSpec(hash(1), tryAsSegmentIndex(15)),
      new ImportSpec(hash(2), tryAsSegmentIndex(30)),
      new ImportSpec(hash(3), tryAsSegmentIndex(65_300)),
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
      new ImportSpec(hash(2), tryAsSegmentIndex(30)),
      new ImportSpec(hash(3), tryAsSegmentIndex(65_300)),
      new ImportSpec(hash(1), tryAsSegmentIndex(15)),
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
      new ImportSpec(hash(1), tryAsSegmentIndex(15)),
      new ImportSpec(hash(2), tryAsSegmentIndex(30)),
      new ImportSpec(hash(3), tryAsSegmentIndex(65_300)),
      new ImportSpec(hash(3), tryAsSegmentIndex(65_300)),
    ];

    const encoded = Encoder.encodeObject(arrayCodec, list);

    assert.throws(() => {
      Decoder.decodeObject(dictionaryCodec, encoded);
    }, new Error(
      'Duplicate item in the dictionary encoding: "0x0303030303030303030303030303030303030303030303030303030303030303"!',
    ));
  });
});
