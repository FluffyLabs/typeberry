import assert from "node:assert";
import { describe, it } from "node:test";

import type { Ed25519Key, Ed25519Signature, WorkReportHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { verifyCulpritSignature, verifyVoteSignature } from "./verification-utils";

describe("verification-utils", () => {
  describe("verifyVoteSignature", () => {
    it("should return true for valid signature and valid work report", () => {
      const signature = Bytes.parseBytes(
        "0x0b1e29dbda5e3bba5dde21c81a8178b115ebf0cf5920fe1a38e897ecadd91718e34bf01c9fc7fdd0df31d83020231b6e8338c8dc204b618cbde16a03cb269d05",
        64,
      ) as Ed25519Signature;
      const key = Bytes.parseBytes(
        "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
        32,
      ) as Ed25519Key;
      const workReportHash = Bytes.parseBytes(
        "0x11da6d1f761ddf9bdb4c9d6e5303ebd41f61858d0a5647a1a7bfe089bf921be9",
        32,
      ) as WorkReportHash;
      const isWorkReportValid = true;

      const result = verifyVoteSignature(signature, key, workReportHash, isWorkReportValid);

      assert.strictEqual(result, true);
    });

    it("should return false for invalid signature (value of isWorkReportValid is changed)", () => {
      const signature = Bytes.parseBytes(
        "0x0b1e29dbda5e3bba5dde21c81a8178b115ebf0cf5920fe1a38e897ecadd91718e34bf01c9fc7fdd0df31d83020231b6e8338c8dc204b618cbde16a03cb269d05",
        64,
      ) as Ed25519Signature;
      const key = Bytes.parseBytes(
        "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
        32,
      ) as Ed25519Key;
      const workReportHash = Bytes.parseBytes(
        "0x11da6d1f761ddf9bdb4c9d6e5303ebd41f61858d0a5647a1a7bfe089bf921be9",
        32,
      ) as WorkReportHash;
      const isWorkReportValid = false;

      const result = verifyVoteSignature(signature, key, workReportHash, isWorkReportValid);

      assert.strictEqual(result, false);
    });

    it("should return true for valid signature and invalid work report", () => {
      const signature = Bytes.parseBytes(
        "0xd76bba06ffb8042bedce3f598e22423660e64f2108566cbd548f6d2c42b1a39607a214bddfa7ccccf83fe993728a58393c64283b8a9ab8f3dff49cbc3cc2350e",
        64,
      ) as Ed25519Signature;
      const key = Bytes.parseBytes(
        "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
        32,
      ) as Ed25519Key;
      const workReportHash = Bytes.parseBytes(
        "0x7b0aa1735e5ba58d3236316c671fe4f00ed366ee72417c9ed02a53a8019e85b8",
        32,
      ) as WorkReportHash;
      const isWorkReportValid = false;

      const result = verifyVoteSignature(signature, key, workReportHash, isWorkReportValid);

      assert.strictEqual(result, true);
    });

    it("should return false for invalid signature (the first byte in signature is changed)", () => {
      const signature = Bytes.parseBytes(
        "0x1b1e29dbda5e3bba5dde21c81a8178b115ebf0cf5920fe1a38e897ecadd91718e34bf01c9fc7fdd0df31d83020231b6e8338c8dc204b618cbde16a03cb269d05",
        64,
      ) as Ed25519Signature;
      const key = Bytes.parseBytes(
        "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
        32,
      ) as Ed25519Key;
      const workReportHash = Bytes.parseBytes(
        "0x11da6d1f761ddf9bdb4c9d6e5303ebd41f61858d0a5647a1a7bfe089bf921be9",
        32,
      ) as WorkReportHash;
      const isWorkReportValid = true;

      const result = verifyVoteSignature(signature, key, workReportHash, isWorkReportValid);

      assert.strictEqual(result, false);
    });
  });

  describe("verifyCulpritSignature", () => {
    it("should return true for valid signature", () => {
      const signature = Bytes.parseBytes(
        "0xf23e45d7f8977a8eda61513bd5cab1451eb64f265edf340c415f25480123391364521f9bb4c14f840a0dae20eb4dc4a735c961d9966da51dde0d85281dc1dc0b",
        64,
      ) as Ed25519Signature;
      const key = Bytes.parseBytes(
        "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
        32,
      ) as Ed25519Key;
      const workReportHash = Bytes.parseBytes(
        "0x11da6d1f761ddf9bdb4c9d6e5303ebd41f61858d0a5647a1a7bfe089bf921be9",
        32,
      ) as WorkReportHash;

      const result = verifyCulpritSignature(signature, key, workReportHash);

      assert.strictEqual(result, true);
    });

    it("should return false for invalid signature (the first byte in signature is changed)", () => {
      const signature = Bytes.parseBytes(
        "0xe23e45d7f8977a8eda61513bd5cab1451eb64f265edf340c415f25480123391364521f9bb4c14f840a0dae20eb4dc4a735c961d9966da51dde0d85281dc1dc0b",
        64,
      ) as Ed25519Signature;
      const key = Bytes.parseBytes(
        "0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
        32,
      ) as Ed25519Key;
      const workReportHash = Bytes.parseBytes(
        "0x11da6d1f761ddf9bdb4c9d6e5303ebd41f61858d0a5647a1a7bfe089bf921be9",
        32,
      ) as WorkReportHash;

      const result = verifyCulpritSignature(signature, key, workReportHash);

      assert.strictEqual(result, false);
    });
  });
});
