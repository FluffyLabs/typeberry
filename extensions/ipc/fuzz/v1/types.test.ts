import assert from "node:assert";
import { describe, it } from "node:test";
import { type HeaderHash, type StateRootHash, tryAsTimeSlot } from "@typeberry/block";
import { testBlockView } from "@typeberry/block/test-helpers.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU8, tryAsU32 } from "@typeberry/numbers";
import { KeyValue, Version, stateCodec } from "../v0/types.js";
import {
  AncestryItem,
  ErrorMessage,
  Features,
  Initialize,
  type MessageData,
  MessageType,
  PeerInfo,
  ancestryCodec,
  messageCodec,
} from "./types.js";

const spec = tinyChainSpec;

describe("Fuzzer V1 Data Structures", () => {
  describe("Version", () => {
    it("should encode and decode a version", () => {
      const version = Version.create({
        major: tryAsU8(1),
        minor: tryAsU8(2),
        patch: tryAsU8(3),
      });

      const encoded = Encoder.encodeObject(Version.Codec, version, spec);
      const decoded = Decoder.decodeObject(Version.Codec, encoded, spec);

      assert.strictEqual(decoded.major, 1);
      assert.strictEqual(decoded.minor, 2);
      assert.strictEqual(decoded.patch, 3);
    });

    it("should handle maximum values", () => {
      const version = Version.create({
        major: tryAsU8(255),
        minor: tryAsU8(255),
        patch: tryAsU8(255),
      });

      const encoded = Encoder.encodeObject(Version.Codec, version, spec);
      const decoded = Decoder.decodeObject(Version.Codec, encoded, spec);

      assert.strictEqual(decoded.major, 255);
      assert.strictEqual(decoded.minor, 255);
      assert.strictEqual(decoded.patch, 255);
    });

    it("should parse version from string", () => {
      const version = Version.tryFromString("1.2.3");

      assert.strictEqual(version.major, 1);
      assert.strictEqual(version.minor, 2);
      assert.strictEqual(version.patch, 3);
    });
  });

  describe("PeerInfo", () => {
    it("should encode and decode peer info with features", () => {
      const appVersion = Version.create({
        major: tryAsU8(1),
        minor: tryAsU8(0),
        patch: tryAsU8(0),
      });

      const jamVersion = Version.create({
        major: tryAsU8(0),
        minor: tryAsU8(7),
        patch: tryAsU8(0),
      });

      const peerInfo = PeerInfo.create({
        fuzzVersion: tryAsU8(1),
        features: tryAsU32(Features.Ancestry | Features.Fork),
        appVersion,
        jamVersion,
        name: "test-fuzzer",
      });

      const encoded = Encoder.encodeObject(PeerInfo.Codec, peerInfo, spec);
      const decoded = Decoder.decodeObject(PeerInfo.Codec, encoded, spec);

      assert.strictEqual(decoded.fuzzVersion, 1);
      assert.strictEqual(decoded.features, 0b11);
      assert.strictEqual(decoded.name, "test-fuzzer");
      assert.strictEqual(decoded.appVersion.major, 1);
      assert.strictEqual(decoded.jamVersion.major, 0);
      assert.strictEqual(decoded.jamVersion.minor, 7);
    });

    it("should encode example from spec", () => {
      // Example from spec:
      // {
      //   "fuzz_version": 1,
      //   "features": 2,
      //   "jam_version": { "major": 0, "minor": 1, "patch": 23 },
      //   "app_version": { "major": 0, "minor": 7, "patch": 0 },
      //   "name": "fuzzer"
      // }
      // Expected: 0x0001020000000001170007000666757a7a6572

      const peerInfo = PeerInfo.create({
        fuzzVersion: tryAsU8(1),
        features: tryAsU32(Features.Fork),
        jamVersion: Version.create({
          major: tryAsU8(0),
          minor: tryAsU8(1),
          patch: tryAsU8(23),
        }),
        appVersion: Version.create({
          major: tryAsU8(0),
          minor: tryAsU8(7),
          patch: tryAsU8(0),
        }),
        name: "fuzzer",
      });

      const encoded = Encoder.encodeObject(PeerInfo.Codec, peerInfo, spec);
      const expectedHex = "0x01020000000001170007000666757a7a6572";

      assert.strictEqual(encoded.toString(), expectedHex);
    });
  });

  describe("KeyValue", () => {
    it("should encode and decode key-value pairs", () => {
      const key = Bytes.fill(31, 0x42);
      const value = BytesBlob.parseBlob("0xdeadbeef");

      const keyValue = KeyValue.create({ key, value });

      const encoded = Encoder.encodeObject(KeyValue.Codec, keyValue, spec);
      const decoded = Decoder.decodeObject(KeyValue.Codec, encoded, spec);

      assert.deepStrictEqual(decoded.key, key);
      assert.deepStrictEqual(decoded.value, value);
    });
  });

  describe("State", () => {
    it("should encode and decode state as sequence of key-value pairs", () => {
      const keyValues = [
        KeyValue.create({
          key: Bytes.fill(31, 0x01),
          value: BytesBlob.parseBlob("0x1111"),
        }),
        KeyValue.create({
          key: Bytes.fill(31, 0x02),
          value: BytesBlob.parseBlob("0x2222"),
        }),
      ];

      const encoded = Encoder.encodeObject(stateCodec, keyValues, spec);
      const decoded = Decoder.decodeObject(stateCodec, encoded, spec);

      assert.strictEqual(decoded.length, 2);
      assert.deepStrictEqual(decoded[0].key, keyValues[0].key);
      assert.deepStrictEqual(decoded[0].value, keyValues[0].value);
      assert.deepStrictEqual(decoded[1].key, keyValues[1].key);
      assert.deepStrictEqual(decoded[1].value, keyValues[1].value);
    });

    it("should handle empty state", () => {
      const keyValues: KeyValue[] = [];

      const encoded = Encoder.encodeObject(stateCodec, keyValues, spec);
      const decoded = Decoder.decodeObject(stateCodec, encoded, spec);

      assert.strictEqual(decoded.length, 0);
    });
  });

  describe("AncestryItem", () => {
    it("should encode and decode ancestry item", () => {
      const ancestryItem = AncestryItem.create({
        slot: tryAsTimeSlot(12345),
        headerHash: Bytes.fill(32, 0xab).asOpaque<HeaderHash>(),
      });

      const encoded = Encoder.encodeObject(AncestryItem.Codec, ancestryItem, spec);
      const decoded = Decoder.decodeObject(AncestryItem.Codec, encoded, spec);

      assert.strictEqual(decoded.slot, 12345);
      assert.deepStrictEqual(decoded.headerHash, Bytes.fill(32, 0xab).asOpaque<HeaderHash>());
    });
  });

  describe("Ancestry", () => {
    it("should encode and decode ancestry sequence", () => {
      const ancestry = [
        AncestryItem.create({
          slot: tryAsTimeSlot(100),
          headerHash: Bytes.fill(32, 0x01).asOpaque<HeaderHash>(),
        }),
        AncestryItem.create({
          slot: tryAsTimeSlot(101),
          headerHash: Bytes.fill(32, 0x02).asOpaque<HeaderHash>(),
        }),
      ];

      const encoded = Encoder.encodeObject(ancestryCodec, ancestry, spec);
      const decoded = Decoder.decodeObject(ancestryCodec, encoded, spec);

      assert.strictEqual(decoded.length, 2);
      assert.strictEqual(decoded[0].slot, 100);
      assert.strictEqual(decoded[1].slot, 101);
      assert.deepStrictEqual(decoded[0].headerHash, Bytes.fill(32, 0x01).asOpaque<HeaderHash>());
      assert.deepStrictEqual(decoded[1].headerHash, Bytes.fill(32, 0x02).asOpaque<HeaderHash>());
    });

    it("should handle empty ancestry", () => {
      const ancestry: AncestryItem[] = [];

      const encoded = Encoder.encodeObject(ancestryCodec, ancestry, spec);
      const decoded = Decoder.decodeObject(ancestryCodec, encoded, spec);

      assert.strictEqual(decoded.length, 0);
    });
  });

  describe("Initialize", () => {
    it("should encode and decode initialize message", () => {
      const header = testBlockView().header.materialize();
      const keyvals = [
        KeyValue.create({
          key: Bytes.fill(31, 0x11),
          value: BytesBlob.parseBlob("0xaabbcc"),
        }),
      ];
      const ancestry = [
        AncestryItem.create({
          slot: tryAsTimeSlot(42),
          headerHash: Bytes.fill(32, 0xcc).asOpaque<HeaderHash>(),
        }),
      ];

      const initialize = Initialize.create({
        header,
        keyvals,
        ancestry,
      });

      const encoded = Encoder.encodeObject(Initialize.Codec, initialize, spec);
      const decoded = Decoder.decodeObject(Initialize.Codec, encoded, spec);

      assert.deepStrictEqual(decoded.header, header);
      assert.strictEqual(decoded.keyvals.length, 1);
      assert.deepStrictEqual(decoded.keyvals[0].key, keyvals[0].key);
      assert.deepStrictEqual(decoded.keyvals[0].value, keyvals[0].value);
      assert.strictEqual(decoded.ancestry.length, 1);
      assert.strictEqual(decoded.ancestry[0].slot, 42);
    });
  });

  describe("ErrorMessage", () => {
    it("should encode and decode error message", () => {
      const error = ErrorMessage.create({ message: "error" });

      const encoded = Encoder.encodeObject(ErrorMessage.Codec, error, spec);
      const decoded = Decoder.decodeObject(ErrorMessage.Codec, encoded, spec);

      assert.ok(decoded instanceof ErrorMessage);
      assert.strictEqual(encoded.toString(), "0x056572726f72");
    });
  });

  describe("Message", () => {
    it("should encode and decode PeerInfo message", () => {
      const peerInfo = PeerInfo.create({
        fuzzVersion: tryAsU8(1),
        features: tryAsU32(Features.Ancestry),
        appVersion: Version.create({
          major: tryAsU8(1),
          minor: tryAsU8(0),
          patch: tryAsU8(0),
        }),
        jamVersion: Version.create({
          major: tryAsU8(0),
          minor: tryAsU8(7),
          patch: tryAsU8(0),
        }),
        name: "test-peer",
      });

      const message: MessageData = {
        type: MessageType.PeerInfo,
        value: peerInfo,
      };

      const encoded = Encoder.encodeObject(messageCodec, message, spec);
      const decoded = Decoder.decodeObject(messageCodec, encoded, spec);

      assert.strictEqual(decoded.type, MessageType.PeerInfo);
      if (decoded.type !== MessageType.PeerInfo) {
        assert.fail();
      }
      assert.strictEqual(decoded.value.name, "test-peer");
      assert.strictEqual(decoded.value.fuzzVersion, 1);
      assert.strictEqual(decoded.value.features, Features.Ancestry);
    });

    it("should encode and decode StateRoot message", () => {
      const stateRoot = Bytes.fill(32, 0xcd).asOpaque<StateRootHash>();

      const message: MessageData = {
        type: MessageType.StateRoot,
        value: stateRoot,
      };

      const encoded = Encoder.encodeObject(messageCodec, message, spec);
      const decoded = Decoder.decodeObject(messageCodec, encoded, spec);

      assert.strictEqual(decoded.type, MessageType.StateRoot);
      if (decoded.type !== MessageType.StateRoot) {
        assert.fail();
      }
      assert.deepStrictEqual(decoded.value, stateRoot);

      // Expected encoding from spec example:
      // 0x024559342d3a32a8cbc3c46399a80753abff8bf785aa9d6f623e0de045ba6701fe
      const expectedStateRoot = Bytes.parseBytes(
        "0x4559342d3a32a8cbc3c46399a80753abff8bf785aa9d6f623e0de045ba6701fe",
        HASH_SIZE,
      ).asOpaque<StateRootHash>();
      const expectedMessage: MessageData = {
        type: MessageType.StateRoot,
        value: expectedStateRoot,
      };

      const expectedEncoded = Encoder.encodeObject(messageCodec, expectedMessage, spec);
      const expectedHex = "0x024559342d3a32a8cbc3c46399a80753abff8bf785aa9d6f623e0de045ba6701fe";

      assert.strictEqual(expectedEncoded.toString(), expectedHex);
    });

    it("should encode and decode Initialize message", () => {
      const header = testBlockView().header.materialize();
      const keyvals = [
        KeyValue.create({
          key: Bytes.fill(31, 0x33),
          value: BytesBlob.parseBlob("0xffeedd"),
        }),
      ];
      const ancestry: AncestryItem[] = [];

      const initialize = Initialize.create({
        header,
        keyvals,
        ancestry,
      });

      const message: MessageData = {
        type: MessageType.Initialize,
        value: initialize,
      };

      const encoded = Encoder.encodeObject(messageCodec, message, spec);
      const decoded = Decoder.decodeObject(messageCodec, encoded, spec);

      assert.strictEqual(decoded.type, MessageType.Initialize);
      if (decoded.type !== MessageType.Initialize) {
        assert.fail();
      }
      assert.deepStrictEqual(decoded.value.header, header);
      assert.strictEqual(decoded.value.keyvals.length, 1);
      assert.strictEqual(decoded.value.ancestry.length, 0);
    });

    it("should encode and decode Error message", () => {
      const error = ErrorMessage.create({ message: "test error" });

      const message: MessageData = {
        type: MessageType.Error,
        value: error,
      };

      const encoded = Encoder.encodeObject(messageCodec, message, spec);
      const decoded = Decoder.decodeObject(messageCodec, encoded, spec);

      assert.strictEqual(decoded.type, MessageType.Error);
      if (decoded.type !== MessageType.Error) {
        assert.fail();
      }
      assert.ok(decoded.value instanceof ErrorMessage);
    });

    it("should handle message type encoding consistency", () => {
      const error = ErrorMessage.create({ message: "test error" });
      const message: MessageData = {
        type: MessageType.Error,
        value: error,
      };

      const encoded = Encoder.encodeObject(messageCodec, message, spec);

      // First byte should be the message type (255 for Error)
      assert.strictEqual(encoded.raw[0], 255);
    });

    it("should encode different message types with correct tags", () => {
      // Test Initialize message type tag
      const header = testBlockView().header.materialize();
      const initialize = Initialize.create({
        header,
        keyvals: [],
        ancestry: [],
      });

      const initializeMessage: MessageData = {
        type: MessageType.Initialize,
        value: initialize,
      };

      const initializeEncoded = Encoder.encodeObject(messageCodec, initializeMessage, spec);
      // First byte should be 1 for Initialize message type
      assert.strictEqual(initializeEncoded.raw[0], 1);

      // Test ImportBlock message type tag
      const block = testBlockView().materialize();
      const importBlockMessage: MessageData = {
        type: MessageType.ImportBlock,
        value: block,
      };

      const importBlockEncoded = Encoder.encodeObject(messageCodec, importBlockMessage, spec);
      // First byte should be 3 for ImportBlock message type
      assert.strictEqual(importBlockEncoded.raw[0], 3);
    });
  });
});
