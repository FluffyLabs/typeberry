import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE, type OpaqueHash, keccak } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher, type MmrPeaks } from ".";

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
      "0xeabc669b60353b24855765b1fc2c60bafd033c97da0c3981bd7632ea1fa524f6",
    );
  });
});

function strPeaks(peaks: MmrPeaks<Hash>) {
  return `[${peaks.peaks.map(String).join(", ")}]`;
}
