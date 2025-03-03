import assert from "node:assert";
import { describe, it } from "node:test";
import { Ordering } from "@typeberry/ordering";
import { Bytes, BytesBlob, bytesBlobComparator } from "./bytes";

describe("BytesBlob", () => {
  it("should fail if 0x is missing", () => {
    try {
      BytesBlob.parseBlob("ff2f");
      assert.fail("Should throw an exception");
    } catch (e) {
      assert.strictEqual(`${e}`, "Error: Missing 0x prefix: ff2f.");
    }
  });

  it("should fail in case invalid characters are given", () => {
    try {
      BytesBlob.parseBlob("0xff2g");
      assert.fail("Should throw an exception");
    } catch (e) {
      assert.strictEqual(`${e}`, "Error: Invalid characters in hex byte string: g");
    }
  });

  it("parse 0x-prefixed hex string into blob of bytes", () => {
    const input = "0x2fa3f686df876995167e7c2e5d74c4c7b6e48f8068fe0e44208344d480f7904c";
    const result = BytesBlob.parseBlob(input);

    assert.deepStrictEqual(
      result.raw,
      new Uint8Array([
        47, 163, 246, 134, 223, 135, 105, 149, 22, 126, 124, 46, 93, 116, 196, 199, 182, 228, 143, 128, 104, 254, 14,
        68, 32, 131, 68, 212, 128, 247, 144, 76,
      ]),
    );
  });

  it("parse non 0x-prefixed hex string into blob of bytes", () => {
    const input = "2fa3f686df876995167e7c2e5d74c4c7b6e48f8068fe0e44208344d480f7904c";
    const result = BytesBlob.parseBlobNoPrefix(input);

    assert.deepStrictEqual(
      result.raw,
      new Uint8Array([
        47, 163, 246, 134, 223, 135, 105, 149, 22, 126, 124, 46, 93, 116, 196, 199, 182, 228, 143, 128, 104, 254, 14,
        68, 32, 131, 68, 212, 128, 247, 144, 76,
      ]),
    );
  });

  it("from bytes", () => {
    const result = BytesBlob.blobFromNumbers([47, 163, 246, 134]);

    assert.deepStrictEqual(result.raw, new Uint8Array([47, 163, 246, 134]));
  });

  describe("isLessThan", () => {
    it("should compare two blobs and return false", () => {
      const blob1 = BytesBlob.blobFromNumbers([48, 163, 246, 134]);
      const blob2 = BytesBlob.blobFromNumbers([47, 163, 246, 134]);

      const result = blob1.isLessThan(blob2);

      assert.strictEqual(result, false);
    });

    it("should compare two blobs and return true", () => {
      const blob1 = BytesBlob.blobFromNumbers([48, 163, 246, 134]);
      const blob2 = BytesBlob.blobFromNumbers([49, 163, 246, 134]);

      const result = blob1.isLessThan(blob2);

      assert.strictEqual(result, true);
    });
  });

  describe("chunks", () => {
    it("should split array into chunks of given size", () => {
      const blob = BytesBlob.blobFromNumbers([48, 163, 246, 134]);
      const chunkSize = 2;
      const expectedChunk1 = BytesBlob.blobFromNumbers([48, 163]);
      const expectedChunk2 = BytesBlob.blobFromNumbers([246, 134]);
      const expectedChunks = [expectedChunk1, expectedChunk2];

      const result = Array.from(blob.chunks(chunkSize));

      assert.deepStrictEqual(result, expectedChunks);
    });

    it("should split array of length that is not divisible by chunk size ", () => {
      const blob = BytesBlob.blobFromNumbers([48, 163, 246, 134, 93]);
      const chunkSize = 2;
      const expectedChunk1 = BytesBlob.blobFromNumbers([48, 163]);
      const expectedChunk2 = BytesBlob.blobFromNumbers([246, 134]);
      const expectedChunk3 = BytesBlob.blobFromNumbers([93]);
      const expectedChunks = [expectedChunk1, expectedChunk2, expectedChunk3];

      const result = Array.from(blob.chunks(chunkSize));

      assert.deepStrictEqual(result, expectedChunks);
    });
  });

  describe("compare", () => {
    it("should compare two equal blobs and return 'equal'", () => {
      const blob1 = BytesBlob.blobFromNumbers([47, 163, 246, 134]);
      const blob2 = BytesBlob.blobFromNumbers([47, 163, 246, 134]);

      const result = blob1.compare(blob2);

      assert.strictEqual(result, Ordering.Equal);
    });

    it("should compare two blobs and return 'greater'", () => {
      const blob1 = BytesBlob.blobFromNumbers([48, 163, 246, 134]);
      const blob2 = BytesBlob.blobFromNumbers([47, 163, 246, 134]);

      const result = blob1.compare(blob2);

      assert.strictEqual(result, Ordering.Greater);
    });

    it("should compare two blobs and return 'less'", () => {
      const blob1 = BytesBlob.blobFromNumbers([47, 163, 246, 134]);
      const blob2 = BytesBlob.blobFromNumbers([48, 163, 246, 134]);

      const result = blob1.compare(blob2);

      assert.strictEqual(result, Ordering.Less);
    });

    it("should return 'less' when blob1 is shorter but blobs have the same prefix", () => {
      const blob1 = BytesBlob.blobFromNumbers([163, 246, 134]);
      const blob2 = BytesBlob.blobFromNumbers([163, 246, 134, 48]);

      const result = blob1.compare(blob2);

      assert.strictEqual(result, Ordering.Less);
    });

    it("should return 'greater' when blob1 is longer but blobs have the same prefix", () => {
      const blob1 = BytesBlob.blobFromNumbers([163, 246, 134, 48]);
      const blob2 = BytesBlob.blobFromNumbers([163, 246, 134]);

      const result = blob1.compare(blob2);

      assert.strictEqual(result, Ordering.Greater);
    });
  });

  it("isLessThanOrEqualTo should compare two equal blobs and return true", () => {
    const blob1 = BytesBlob.blobFromNumbers([47, 163, 246, 134]);
    const blob2 = BytesBlob.blobFromNumbers([47, 163, 246, 134]);

    const result = blob1.isLessThanOrEqualTo(blob2);

    assert.strictEqual(result, true);
  });

  it("isLessThanOrEqualTo should compare two blobs and return false", () => {
    const blob1 = BytesBlob.blobFromNumbers([48, 163, 246, 134]);
    const blob2 = BytesBlob.blobFromNumbers([47, 163, 246, 134]);

    const result = blob1.isLessThanOrEqualTo(blob2);

    assert.strictEqual(result, false);
  });

  it("isLessThanOrEqualTo should compare two blobs and return true", () => {
    const blob1 = BytesBlob.blobFromNumbers([48, 163, 246, 134]);
    const blob2 = BytesBlob.blobFromNumbers([49, 163, 246, 134]);

    const result = blob1.isLessThanOrEqualTo(blob2);

    assert.strictEqual(result, true);
  });

  describe("comparator", () => {
    it("should return Ordering.Equal", () => {
      const a = Bytes.parseBlob("0x111111");
      const b = Bytes.parseBlob("0x111111");

      const result = bytesBlobComparator(a, b);

      assert.strictEqual(result, Ordering.Equal);
    });

    it("should return Ordering.Less", () => {
      const a = Bytes.parseBlob("0x011111");
      const b = Bytes.parseBlob("0x111111");

      const result = bytesBlobComparator(a, b);

      assert.strictEqual(result, Ordering.Less);
    });

    it("should return Ordering.Greater", () => {
      const a = Bytes.parseBlob("0x211111");
      const b = Bytes.parseBlob("0x111111");

      const result = bytesBlobComparator(a, b);

      assert.strictEqual(result, Ordering.Greater);
    });
  });
});

describe("Bytes", () => {
  it("should fail in case of length mismatch", () => {
    const input = "0x9c2d3bce7aa0a5857c67a85247365d2035f7d9daec2b515e86086584ad5e8644";

    try {
      Bytes.parseBytes(input, 16);
      assert.fail("Should throw an exception");
    } catch (e) {
      assert.strictEqual(`${e}`, "Error: Input string too long. Expected 16, got 32");
    }
  });

  it("parse 0x-prefixed, fixed length bytes vector", () => {
    const input = "0x9c2d3bce7aa0a5857c67a85247365d2035f7d9daec2b515e86086584ad5e8644";

    const bytes = Bytes.parseBytes(input, 32);

    assert.deepStrictEqual(
      bytes.raw,
      new Uint8Array([
        156, 45, 59, 206, 122, 160, 165, 133, 124, 103, 168, 82, 71, 54, 93, 32, 53, 247, 217, 218, 236, 43, 81, 94,
        134, 8, 101, 132, 173, 94, 134, 68,
      ]),
    );
  });

  it("parse non 0x-prefixed, fixed length bytes vector", () => {
    const input = "9c2d3bce7aa0a5857c67a85247365d2035f7d9daec2b515e86086584ad5e8644";

    const bytes = Bytes.parseBytesNoPrefix(input, 32);

    assert.deepStrictEqual(
      bytes.raw,
      new Uint8Array([
        156, 45, 59, 206, 122, 160, 165, 133, 124, 103, 168, 82, 71, 54, 93, 32, 53, 247, 217, 218, 236, 43, 81, 94,
        134, 8, 101, 132, 173, 94, 134, 68,
      ]),
    );
  });
});
