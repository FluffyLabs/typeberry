import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE, keccak, type OpaqueHash } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher, type MmrPeaks } from "./index.js";

type Hash = OpaqueHash;

const hasher: Promise<MmrHasher<Hash>> = keccak.KeccakHasher.create().then((hasher) => {
  return {
    hashConcat(a, b) {
      return keccak.hashBlobs(hasher, [a, b]);
    },
    hashConcatPrepend(id, a, b) {
      return keccak.hashBlobs(hasher, [id, a, b]);
    },
  };
});

describe("MMR", () => {
  it("should return empty peaks and zero super hash", async () => {
    // when
    const mmr = MerkleMountainRange.empty(await hasher);

    // then
    assert.deepEqual(mmr.getPeaks(), { peaks: [] });
    assert.deepEqual(
      mmr.getSuperPeakHash().toString(),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should return one peak and a super hash", async () => {
    // given
    const mmr = MerkleMountainRange.empty(await hasher);

    // when
    mmr.append(Bytes.parseBytes("0x8720b97ddd6acc0f6eb66e095524038675a4e4067adc10ec39939eaefc47d842", HASH_SIZE));

    // then
    assert.deepEqual(strPeaks(mmr.getPeaks()), "[0x8720b97ddd6acc0f6eb66e095524038675a4e4067adc10ec39939eaefc47d842]");
    assert.deepEqual(
      mmr.getSuperPeakHash().toString(),
      "0x8720b97ddd6acc0f6eb66e095524038675a4e4067adc10ec39939eaefc47d842",
    );
  });

  it("should return two peaks and a super hash", async () => {
    // given
    const mmr = MerkleMountainRange.empty(await hasher);

    // when
    mmr.append(Bytes.parseBytes("0x8720b97ddd6acc0f6eb66e095524038675a4e4067adc10ec39939eaefc47d842", HASH_SIZE));
    mmr.append(Bytes.parseBytes("0x7507515a48439dc58bc318c48a120b656136699f42bfd2bd45473becba53462d", HASH_SIZE));

    // then
    assert.deepEqual(
      strPeaks(mmr.getPeaks()),
      "[null, 0x7076c31882a5953e097aef8378969945e72807c4705e53a0c5aacc9176f0d56b]",
    );
    assert.deepEqual(
      mmr.getSuperPeakHash().toString(),
      "0x7076c31882a5953e097aef8378969945e72807c4705e53a0c5aacc9176f0d56b",
    );
  });

  it("should return more peaks and a super hash", async () => {
    // given
    const mmr = MerkleMountainRange.empty(await hasher);

    // when
    for (let i = 0; i < 10; i++) {
      mmr.append(Bytes.parseBytes("0x8720b97ddd6acc0f6eb66e095524038675a4e4067adc10ec39939eaefc47d842", HASH_SIZE));
      mmr.append(Bytes.parseBytes("0x7507515a48439dc58bc318c48a120b656136699f42bfd2bd45473becba53462d", HASH_SIZE));
    }

    // then
    assert.deepEqual(
      strPeaks(mmr.getPeaks()),
      "[null, null, 0x603962acb9fd28fd650da61187a96761a9ca77b79e50278b8befd141ae9912b6, null, 0x0ae801c22b2305f0ce601f9ec42c44c7d63ceb02dc991c84f531e5496e945d98]",
    );
    assert.deepEqual(
      mmr.getSuperPeakHash().toString(),
      "0x1edf0b1f3291a8ffd2d17b8962b5aa58b3f9cf6ec8f9443a81bc786d4c64b7f4",
    );
  });

  it("should match reports", async () => {
    // given
    const mmr = MerkleMountainRange.fromPeaks(await hasher, {
      peaks: [
        "0x4c31a1024d553c6f5eb90a26f9c53507d6d58b7be1197c0f86054b084353de5f",
        null,
        "0x7f64e54f8be039cea06582eb38e7f36f924c1f59a0f3043b4df6f140cccd6ddf",
        "0xd7cc7a7751048dbe8d0232b5d0273acd874e56c19e41a2e09b590ca00e59908d",
      ].map((x) => (x !== null ? Bytes.parseBytes(x, HASH_SIZE) : x)),
    });

    // then
    assert.deepEqual(
      mmr.getSuperPeakHash().toString(),
      "0xf5df0c11416d43c55b43e096572d450b7780ed0fd7b540f26c8ded8e0d41e183",
    );
  });
});

function strPeaks(peaks: MmrPeaks<Hash>) {
  return `[${peaks.peaks.map(String).join(", ")}]`;
}
