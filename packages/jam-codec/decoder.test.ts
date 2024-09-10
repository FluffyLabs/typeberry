import assert from "node:assert";
import { describe, it } from "node:test";

import { Decoder } from "./decoder";

function decodeVarU32(source: Uint8Array) {
  const decoder = Decoder.fromBlob(source);
  const value = decoder.varU32();
  const bytesToSkip = decoder.bytesRead();

  // compare with u64 just to be sure.
  const decoder2 = Decoder.fromBlob(source);
  assert.strictEqual(decoder2.varU64(), BigInt(value));

  return { value, bytesToSkip };
}

function decodeVarU64(source: Uint8Array) {
  const decoder = Decoder.fromBlob(source);
  const value = decoder.varU64();
  const bytesToSkip = decoder.bytesRead();
  return { value, bytesToSkip };
}

describe("decode natural number", () => {
  it("decode 0", () => {
    const encodedBytes = new Uint8Array([0]);
    const expectedValue = 0;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode single byte min value", () => {
    const encodedBytes = new Uint8Array([1]);
    const expectedValue = 1;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode single byte max value", () => {
    const encodedBytes = new Uint8Array([127]);
    const expectedValue = 127;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 2 bytes min value", () => {
    const encodedBytes = new Uint8Array([128, 128]);
    const expectedValue = 128;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 2 bytes max value", () => {
    const encodedBytes = new Uint8Array([191, 255]);
    const expectedValue = 2 ** 14 - 1;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 3 bytes min value", () => {
    const encodedBytes = new Uint8Array([192, 0, 0x40]);
    const expectedValue = 2 ** 14;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 3 bytes max value", () => {
    const encodedBytes = new Uint8Array([192 + 31, 0xff, 0xff]);
    const expectedValue = 2 ** 21 - 1;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 4 bytes min value", () => {
    const encodedBytes = new Uint8Array([0xe0, 0, 0, 0x20]);
    const expectedValue = 2 ** 21;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 4 bytes max value", () => {
    const encodedBytes = new Uint8Array([0xe0 + 15, 0xff, 0xff, 0xff]);
    const expectedValue = 2 ** 28 - 1;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 5 bytes min value", () => {
    const encodedBytes = new Uint8Array([256 - 16, 0, 0, 0, 0x10]);
    const expectedValue = 2n ** 28n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 5 bytes max value", () => {
    const encodedBytes = new Uint8Array([256 - 16 + 7, 0xff, 0xff, 0xff, 0xff]);
    const expectedValue = 2n ** 35n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 6 bytes min value", () => {
    const encodedBytes = new Uint8Array([256 - 8, 0, 0, 0, 0, 0x08]);
    const expectedValue = 2n ** 35n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 6 bytes max value", () => {
    const encodedBytes = new Uint8Array([256 - 8 + 3, 0xff, 0xff, 0xff, 0xff, 0xff]);
    const expectedValue = 2n ** 42n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 7 bytes min value", () => {
    const encodedBytes = new Uint8Array([256 - 4, 0, 0, 0, 0, 0, 0x04]);
    const expectedValue = 2n ** 42n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 7 bytes max value", () => {
    const encodedBytes = new Uint8Array([256 - 4 + 1, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    const expectedValue = 2n ** 49n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 8 bytes min value", () => {
    const encodedBytes = new Uint8Array([256 - 2, 0, 0, 0, 0, 0, 0, 0x02]);
    const expectedValue = 2n ** 49n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 8 bytes max value", () => {
    const encodedBytes = new Uint8Array([256 - 2, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    const expectedValue = 2n ** 56n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 9 bytes min value", () => {
    const encodedBytes = new Uint8Array([255, 0, 0, 0, 0, 0, 0, 0, 0x01]);
    const expectedValue = 2n ** 56n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 9 bytes max value", () => {
    const encodedBytes = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255]);
    const expectedValue = 2n ** 64n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 0 with extra bytes", () => {
    const encodedBytes = new Uint8Array([0, 1, 2, 3]);
    const expectedValue = 0;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, 1);
  });

  it("decode 7 bytes number with extra bytes ", () => {
    const encodedBytes = new Uint8Array([256 - 4 + 1, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x1, 0x2]);
    const expectedValue = 2n ** 49n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, 7);
  });

  it("decode 9 bytes number with extra bytes", () => {
    const encodedBytes = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255, 1, 2, 3]);
    const expectedValue = 2n ** 64n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, 9);
  });
});

// TODO [ToDr] Tests for uN / iN
