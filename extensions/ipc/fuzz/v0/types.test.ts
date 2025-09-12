import assert from "node:assert";
import { describe, it } from "node:test";
import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { tryAsU8 } from "@typeberry/numbers";
import { KeyValue, type MessageData, MessageType, PeerInfo, Version, messageCodec, stateCodec } from "./types.js";

describe("IPC Data Structures", () => {
  describe("Version", () => {
    it("should encode and decode a version", () => {
      const version = Version.create({
        major: tryAsU8(1),
        minor: tryAsU8(2),
        patch: tryAsU8(3),
      });

      const encoded = Encoder.encodeObject(Version.Codec, version);
      const decoded = Decoder.decodeObject(Version.Codec, encoded);

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

      const encoded = Encoder.encodeObject(Version.Codec, version);
      const decoded = Decoder.decodeObject(Version.Codec, encoded);

      assert.strictEqual(decoded.major, 255);
      assert.strictEqual(decoded.minor, 255);
      assert.strictEqual(decoded.patch, 255);
    });
  });

  describe("PeerInfo", () => {
    it("should encode and decode peer info", () => {
      const appVersion = Version.create({
        major: tryAsU8(1),
        minor: tryAsU8(0),
        patch: tryAsU8(0),
      });

      const jamVersion = Version.create({
        major: tryAsU8(0),
        minor: tryAsU8(6),
        patch: tryAsU8(4),
      });

      const peerInfo = PeerInfo.create({
        name: "test-node",
        appVersion,
        jamVersion,
      });

      const encoded = Encoder.encodeObject(PeerInfo.Codec, peerInfo);
      const decoded = Decoder.decodeObject(PeerInfo.Codec, encoded);

      assert.strictEqual(decoded.name, "test-node");
      assert.strictEqual(decoded.appVersion.major, 1);
      assert.strictEqual(decoded.appVersion.minor, 0);
      assert.strictEqual(decoded.appVersion.patch, 0);
      assert.strictEqual(decoded.jamVersion.major, 0);
      assert.strictEqual(decoded.jamVersion.minor, 6);
      assert.strictEqual(decoded.jamVersion.patch, 4);
    });
  });

  describe("KeyValue", () => {
    it("should encode and decode key-value pairs", () => {
      const key = Bytes.fill(31, 0x42);
      const value = BytesBlob.parseBlob("0xdeadbeef");

      const keyValue = KeyValue.create({ key, value });

      const encoded = Encoder.encodeObject(KeyValue.Codec, keyValue);
      const decoded = Decoder.decodeObject(KeyValue.Codec, encoded);

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

      const encoded = Encoder.encodeObject(stateCodec, keyValues);
      const decoded = Decoder.decodeObject(stateCodec, encoded);

      assert.strictEqual(decoded.length, 2);
      assert.deepStrictEqual(decoded[0].key, keyValues[0].key);
      assert.deepStrictEqual(decoded[0].value, keyValues[0].value);
      assert.deepStrictEqual(decoded[1].key, keyValues[1].key);
      assert.deepStrictEqual(decoded[1].value, keyValues[1].value);
    });

    it("should handle empty state", () => {
      const keyValues: KeyValue[] = [];

      const encoded = Encoder.encodeObject(stateCodec, keyValues);
      const decoded = Decoder.decodeObject(stateCodec, encoded);

      assert.strictEqual(decoded.length, 0);
    });
  });

  describe("Message", () => {
    it("should encode and decode PeerInfo message", () => {
      const peerInfo = PeerInfo.create({
        name: "test-peer",
        appVersion: Version.create({
          major: tryAsU8(1),
          minor: tryAsU8(0),
          patch: tryAsU8(0),
        }),
        jamVersion: Version.create({
          major: tryAsU8(0),
          minor: tryAsU8(6),
          patch: tryAsU8(4),
        }),
      });

      const message: MessageData = {
        type: MessageType.PeerInfo,
        value: peerInfo,
      };

      const encoded = Encoder.encodeObject(messageCodec, message);
      const decoded = Decoder.decodeObject(messageCodec, encoded);

      assert.strictEqual(decoded.type, MessageType.PeerInfo);
      if (decoded.type !== MessageType.PeerInfo) {
        assert.fail();
      }
      assert.strictEqual(decoded.value.name, "test-peer");
      assert.strictEqual(decoded.value.appVersion.major, 1);
      assert.strictEqual(decoded.value.jamVersion.minor, 6);
    });

    it("should encode and decode GetState message", () => {
      const headerHash = Bytes.fill(32, 0xab).asOpaque<HeaderHash>();

      const message: MessageData = {
        type: MessageType.GetState,
        value: headerHash,
      };

      const encoded = Encoder.encodeObject(messageCodec, message);
      const decoded = Decoder.decodeObject(messageCodec, encoded);

      assert.strictEqual(decoded.type, MessageType.GetState);
      if (decoded.type !== MessageType.GetState) {
        assert.fail();
      }
      assert.deepStrictEqual(decoded.value, headerHash);
    });

    it("should encode and decode State message", () => {
      const state = [
        KeyValue.create({
          key: Bytes.fill(31, 0x11),
          value: BytesBlob.parseBlob("0xaabbcc"),
        }),
      ];

      const message: MessageData = {
        type: MessageType.State,
        value: state,
      };

      const encoded = Encoder.encodeObject(messageCodec, message);
      const decoded = Decoder.decodeObject(messageCodec, encoded);

      assert.strictEqual(decoded.type, MessageType.State);
      if (decoded.type !== MessageType.State) {
        assert.fail();
      }
      assert.strictEqual(decoded.value.length, 1);
      assert.deepStrictEqual(decoded.value[0].key, state[0].key);
      assert.deepStrictEqual(decoded.value[0].value, state[0].value);
    });

    it("should encode and decode StateRoot message", () => {
      const stateRoot = Bytes.fill(32, 0xcd).asOpaque<StateRootHash>();

      const message: MessageData = {
        type: MessageType.StateRoot,
        value: stateRoot,
      };

      const encoded = Encoder.encodeObject(messageCodec, message);
      const decoded = Decoder.decodeObject(messageCodec, encoded);

      assert.strictEqual(decoded.type, MessageType.StateRoot);
      if (decoded.type !== MessageType.StateRoot) {
        assert.fail();
      }
      assert.deepStrictEqual(decoded.value, stateRoot);
    });

    // Note: SetState and ImportBlock tests would require creating complex Header and Block objects
    // These tests verify the message type handling works correctly
    it("should handle message type encoding consistency", () => {
      // Test that message type tags are encoded as single bytes
      const peerInfo = PeerInfo.create({
        name: "test",
        appVersion: Version.create({
          major: tryAsU8(1),
          minor: tryAsU8(0),
          patch: tryAsU8(0),
        }),
        jamVersion: Version.create({
          major: tryAsU8(0),
          minor: tryAsU8(6),
          patch: tryAsU8(4),
        }),
      });

      const message: MessageData = {
        type: MessageType.PeerInfo,
        value: peerInfo,
      };

      const encoded = Encoder.encodeObject(messageCodec, message);

      // First byte should be the message type (0 for PeerInfo)
      assert.strictEqual(encoded.raw[0], 0);
    });

    it("should encode different message types with correct tags", () => {
      const state = [
        KeyValue.create({
          key: Bytes.fill(31, 0x11),
          value: BytesBlob.parseBlob("0xaabbcc"),
        }),
      ];

      const stateMessage: MessageData = {
        type: MessageType.State,
        value: state,
      };

      const stateEncoded = Encoder.encodeObject(messageCodec, stateMessage);
      // First byte should be 4 for State message type
      assert.strictEqual(stateEncoded.raw[0], 4);

      const hash = Bytes.fill(32, 0xab).asOpaque<HeaderHash>();
      const getStateMessage: MessageData = {
        type: MessageType.GetState,
        value: hash,
      };

      const getStateEncoded = Encoder.encodeObject(messageCodec, getStateMessage);
      // First byte should be 3 for GetState message type
      assert.strictEqual(getStateEncoded.raw[0], 3);
    });
  });
});
