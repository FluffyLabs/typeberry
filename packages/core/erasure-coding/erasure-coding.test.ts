import assert from "node:assert";
import { describe, it } from "node:test";
import { TEST_DATA } from "./ec-test-data";
import { decodeData, encodeData } from "./erasure-coding";

function stringToBytes(input: string): Uint8Array {
  const chunkSize = 2; // 2 chars === 1 byte
  const chunks: string[] = [];

  for (let i = 0; i < input.length; i += chunkSize) {
    chunks.push(input.substring(i, i + chunkSize));
  }

  const numbers = chunks.map((x) => Number.parseInt(x, 16));
  const result = new Uint8Array(numbers.length);

  for (let i = 0; i < result.length; i++) {
    result[i] = numbers[i];
  }

  return result;
}

let seed = 1;
function random() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function getRandomItems(arr: [number, Uint8Array][], n: number): [number, Uint8Array][] {
  if (n > arr.length) {
    throw new Error("Requested more items than available in the array");
  }

  const result: [number, Uint8Array][] = [];
  const copy = [...arr];

  for (let i = 0; i < n; i++) {
    const randomIndex = i + Math.floor(random() * (copy.length - i));
    [copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]];
    result.push(copy[i]);
  }

  return result;
}

const data = TEST_DATA.data as string;
const segmentEc = TEST_DATA.segment.segments[0].segment_ec;

describe("erasure coding", () => {
  seed = Math.floor(1000 * Math.random());

  it("should encode data", () => {
    const encoded = encodeData(stringToBytes(data));
    const expected = segmentEc.map(stringToBytes);

    assert.deepStrictEqual(encoded.length, expected.length);
    assert.deepStrictEqual(encoded, expected);
  });

  it(`should decode data (random seed: ${seed})`, () => {
    const chunks = segmentEc.map((chunk, idx) => [idx, stringToBytes(chunk)] as [number, Uint8Array]);
    const selectedChunks = getRandomItems(chunks, 342);

    const decoded = decodeData(selectedChunks);
    const resultAsString = Array.from(decoded)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    assert.deepStrictEqual(resultAsString, data);
  });
});
