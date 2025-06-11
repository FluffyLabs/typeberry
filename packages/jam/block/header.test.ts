import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { BANDERSNATCH_VRF_SIGNATURE_BYTES } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsTimeSlot, tryAsValidatorIndex } from "./common.js";
import { Header, encodeUnsealedHeader } from "./header.js";

describe("Header", () => {
  it("should encode unsigned header", () => {
    const spec = tinyChainSpec;
    const header = Header.create({
      parentHeaderHash: Bytes.fill(HASH_SIZE, 0xa).asOpaque(),
      priorStateRoot: Bytes.fill(HASH_SIZE, 0x5).asOpaque(),
      extrinsicHash: Bytes.fill(HASH_SIZE, 0xe).asOpaque(),
      timeSlotIndex: tryAsTimeSlot(10),
      epochMarker: null,
      ticketsMarker: null,
      offendersMarker: [],
      bandersnatchBlockAuthorIndex: tryAsValidatorIndex(4),
      entropySource: Bytes.fill(BANDERSNATCH_VRF_SIGNATURE_BYTES, 0x1).asOpaque(),
      seal: Bytes.fill(BANDERSNATCH_VRF_SIGNATURE_BYTES, 0xf).asOpaque(),
    });

    const encoded = Encoder.encodeObject(Header.Codec, header, spec);
    const view = Decoder.decodeObject(Header.Codec.View, encoded, spec);

    const encodedNoSeal = encodeUnsealedHeader(view);

    assert.deepStrictEqual(
      encoded.toString(),
      "0x0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a05050505050505050505050505050505050505050505050505050505050505050e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0a00000000000004000101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f",
    );
    assert.deepStrictEqual(
      encodedNoSeal.toString(),
      "0x0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a05050505050505050505050505050505050505050505050505050505050505050e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0a0000000000000400010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101",
    );
  });
});
