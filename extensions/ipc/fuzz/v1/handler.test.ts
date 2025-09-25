import assert from "node:assert";
import { Socket } from "node:net";
import { describe, it, type Mock, mock } from "node:test";
import { type BlockView, type HeaderHash, type StateRootHash, tryAsTimeSlot } from "@typeberry/block";
import { testBlockView } from "@typeberry/block/test-helpers.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { tryAsU8, tryAsU32 } from "@typeberry/numbers";
import { Result } from "@typeberry/utils";
import { IpcSender } from "../../server.js";
import { type FuzzMessageHandler, FuzzTarget } from "./handler.js";
import {
  AncestryItem,
  ErrorMessage,
  Features,
  Initialize,
  type Message,
  MessageType,
  messageCodec,
  PeerInfo,
  KeyValue,
  Version,
} from "./types.js";

const spec = tinyChainSpec;

class MockV1MessageHandler implements FuzzMessageHandler {
  getPeerInfo: Mock<(value: PeerInfo) => Promise<PeerInfo>> = mock.fn();
  initialize: Mock<(value: Initialize) => Promise<StateRootHash>> = mock.fn();
  importBlock: Mock<(value: BlockView) => Promise<Result<StateRootHash, ErrorMessage>>> = mock.fn();
  getSerializedState: Mock<(value: HeaderHash) => Promise<KeyValue[]>> = mock.fn();
}

class MockSender extends IpcSender {
  _sentData: BytesBlob[] = [];
  _closeCalled = 0;

  constructor() {
    super(new Socket());
  }

  send(data: BytesBlob): void {
    this._sentData.push(data);
  }

  close(): void {
    this._closeCalled++;
  }
}

describe("FuzzV1Target Handler", () => {
  describe("handshake and PeerInfo", () => {
    it("should handle PeerInfo message and complete handshake", async () => {
      const mockMessageHandler = new MockV1MessageHandler();
      const mockSender = new MockSender();

      const inputPeerInfo = PeerInfo.create({
        fuzzVersion: tryAsU8(1),
        features: tryAsU32(Features.Ancestry | Features.Fork),
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
        name: "test-fuzzer",
      });

      const responsePeerInfo = PeerInfo.create({
        fuzzVersion: tryAsU8(1),
        features: tryAsU32(Features.Ancestry), // Subset of input features
        appVersion: Version.create({
          major: tryAsU8(1),
          minor: tryAsU8(1),
          patch: tryAsU8(0),
        }),
        jamVersion: Version.create({
          major: tryAsU8(0),
          minor: tryAsU8(7),
          patch: tryAsU8(1),
        }),
        name: "response-target",
      });

      const incomingMessage: Message = {
        type: MessageType.PeerInfo,
        value: inputPeerInfo,
      };

      const expectedResponse: Message = {
        type: MessageType.PeerInfo,
        value: responsePeerInfo,
      };

      mockMessageHandler.getPeerInfo.mock.mockImplementation(async () => responsePeerInfo);

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      const testMessage = encode(incomingMessage);

      await fuzzTarget.onSocketMessage(testMessage);

      // Verify handshake completion and feature negotiation
      assert.strictEqual(fuzzTarget.hasFeature(Features.Ancestry), true);
      assert.strictEqual(fuzzTarget.hasFeature(Features.Fork), false);

      assert.strictEqual(mockSender._sentData.length, 1);
      const sentMessage = decodeMessage(mockSender._sentData[0]);
      assert.deepStrictEqual(sentMessage, expectedResponse);
      assert.strictEqual(mockSender._closeCalled, 0);
    });
  });

  describe("Initialize message", () => {
    it("should handle Initialize message and respond with StateRoot", async () => {
      const mockMessageHandler = new MockV1MessageHandler();
      const mockSender = new MockSender();

      // Complete handshake first
      await completeHandshake(mockMessageHandler, mockSender);

      const header = testBlockView().header.materialize();
      const keyvals = [
        KeyValue.create({
          key: Bytes.fill(31, 0x01),
          value: BytesBlob.parseBlob("0x1111"),
        }),
      ];
      const ancestry = [
        AncestryItem.create({
          slot: tryAsTimeSlot(42),
          headerHash: Bytes.fill(32, 0xaa).asOpaque<HeaderHash>(),
        }),
      ];

      const initialize = Initialize.create({
        header,
        keyvals,
        ancestry,
      });

      const expectedStateRoot = Bytes.fill(32, 0xef).asOpaque<StateRootHash>();

      const incomingMessage: Message = {
        type: MessageType.Initialize,
        value: initialize,
      };

      const expectedResponse: Message = {
        type: MessageType.StateRoot,
        value: expectedStateRoot,
      };

      mockMessageHandler.initialize.mock.mockImplementation(async () => expectedStateRoot);

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      await completeHandshake(mockMessageHandler, mockSender, fuzzTarget);
      mockSender._sentData = []; // Clear handshake response

      const testMessage = encode(incomingMessage);

      await fuzzTarget.onSocketMessage(testMessage);

      assert.strictEqual(mockMessageHandler.initialize.mock.callCount(), 1);
      assert.deepStrictEqual(mockMessageHandler.initialize.mock.calls[0].arguments, [initialize]);

      assert.strictEqual(mockSender._sentData.length, 1);
      const sentMessage = decodeMessage(mockSender._sentData[0]);
      assert.deepStrictEqual(sentMessage, expectedResponse);
      assert.strictEqual(mockSender._closeCalled, 0);
    });
  });

  describe("ImportBlock message", () => {
    it("should handle ImportBlock message and respond with StateRoot", async () => {
      const mockMessageHandler = new MockV1MessageHandler();
      const mockSender = new MockSender();

      const testBlock = testBlockView();
      const expectedStateRoot = Bytes.fill(32, 0xef).asOpaque<StateRootHash>();

      const incomingMessage: Message = {
        type: MessageType.ImportBlock,
        value: testBlock,
      };

      const expectedResponse: Message = {
        type: MessageType.StateRoot,
        value: expectedStateRoot,
      };

      mockMessageHandler.importBlock.mock.mockImplementation(async () => Result.ok(expectedStateRoot));

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      await completeHandshake(mockMessageHandler, mockSender, fuzzTarget);
      mockSender._sentData = []; // Clear handshake response

      const testMessage = encode(incomingMessage);

      await fuzzTarget.onSocketMessage(testMessage);

      assert.strictEqual(mockMessageHandler.importBlock.mock.callCount(), 1);

      assert.strictEqual(mockSender._sentData.length, 1);
      const sentMessage = decodeMessage(mockSender._sentData[0]);
      assert.deepStrictEqual(sentMessage, expectedResponse);
      assert.strictEqual(mockSender._closeCalled, 0);
    });

    it("should handle ImportBlock error and respond with Error", async () => {
      const mockMessageHandler = new MockV1MessageHandler();
      const mockSender = new MockSender();

      const testBlock = testBlockView();
      const expectedError = ErrorMessage.create({ message: "test error" });

      const incomingMessage: Message = {
        type: MessageType.ImportBlock,
        value: testBlock,
      };

      const expectedResponse: Message = {
        type: MessageType.Error,
        value: expectedError,
      };

      mockMessageHandler.importBlock.mock.mockImplementation(async () => Result.error(expectedError));

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      await completeHandshake(mockMessageHandler, mockSender, fuzzTarget);
      mockSender._sentData = []; // Clear handshake response

      const testMessage = encode(incomingMessage);

      await fuzzTarget.onSocketMessage(testMessage);

      assert.strictEqual(mockMessageHandler.importBlock.mock.callCount(), 1);

      assert.strictEqual(mockSender._sentData.length, 1);
      const sentMessage = decodeMessage(mockSender._sentData[0]);
      assert.deepStrictEqual(sentMessage, expectedResponse);
      assert.strictEqual(mockSender._closeCalled, 0);
    });
  });

  describe("GetState message", () => {
    it("should handle GetState message and respond with State", async () => {
      const mockMessageHandler = new MockV1MessageHandler();
      const mockSender = new MockSender();

      const headerHash = Bytes.fill(32, 0xab).asOpaque<HeaderHash>();
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

      const incomingMessage: Message = {
        type: MessageType.GetState,
        value: headerHash,
      };

      const expectedResponse: Message = {
        type: MessageType.State,
        value: keyValues,
      };

      mockMessageHandler.getSerializedState.mock.mockImplementation(async () => keyValues);

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      await completeHandshake(mockMessageHandler, mockSender, fuzzTarget);
      mockSender._sentData = []; // Clear handshake response

      const testMessage = encode(incomingMessage);

      await fuzzTarget.onSocketMessage(testMessage);

      assert.strictEqual(mockMessageHandler.getSerializedState.mock.callCount(), 1);
      assert.deepStrictEqual(mockMessageHandler.getSerializedState.mock.calls[0].arguments, [headerHash]);

      assert.strictEqual(mockSender._sentData.length, 1);
      const sentMessage = decodeMessage(mockSender._sentData[0]);
      assert.deepStrictEqual(sentMessage, expectedResponse);
      assert.strictEqual(mockSender._closeCalled, 0);
    });
  });

  describe("unexpected messages", () => {
    it("should close connection when receiving unexpected StateRoot message", async () => {
      const mockMessageHandler = new MockV1MessageHandler();
      const mockSender = new MockSender();

      const stateRoot = Bytes.fill(32, 0xcd).asOpaque<StateRootHash>();

      const incomingMessage: Message = {
        type: MessageType.StateRoot,
        value: stateRoot,
      };

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      await completeHandshake(mockMessageHandler, mockSender, fuzzTarget);
      mockSender._sentData = []; // Clear handshake response

      const testMessage = encode(incomingMessage);

      await fuzzTarget.onSocketMessage(testMessage);

      assert.strictEqual(mockSender._closeCalled, 1);
      assert.strictEqual(mockSender._sentData.length, 0);
    });

    it("should close connection when receiving unexpected State message", async () => {
      const mockMessageHandler = new MockV1MessageHandler();
      const mockSender = new MockSender();

      const keyValues = [
        KeyValue.create({
          key: Bytes.fill(31, 0x01),
          value: BytesBlob.parseBlob("0x1111"),
        }),
      ];

      const incomingMessage: Message = {
        type: MessageType.State,
        value: keyValues,
      };

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      await completeHandshake(mockMessageHandler, mockSender, fuzzTarget);
      mockSender._sentData = []; // Clear handshake response

      const testMessage = encode(incomingMessage);

      await fuzzTarget.onSocketMessage(testMessage);

      assert.strictEqual(mockSender._closeCalled, 1);
      assert.strictEqual(mockSender._sentData.length, 0);
    });

    it("should close connection when receiving unexpected Error message", async () => {
      const mockMessageHandler = new MockV1MessageHandler();
      const mockSender = new MockSender();

      const error = ErrorMessage.create({ message: "test error" });

      const incomingMessage: Message = {
        type: MessageType.Error,
        value: error,
      };

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      await completeHandshake(mockMessageHandler, mockSender, fuzzTarget);
      mockSender._sentData = []; // Clear handshake response

      const testMessage = encode(incomingMessage);

      await fuzzTarget.onSocketMessage(testMessage);

      assert.strictEqual(mockSender._closeCalled, 1);
      assert.strictEqual(mockSender._sentData.length, 0);
    });
  });

  describe("error handling", () => {
    it("should handle decoding error gracefully", async () => {
      const mockMessageHandler = new MockV1MessageHandler();
      const mockSender = new MockSender();

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);

      // Create malformed message with valid length prefix but invalid data
      const malformedMessage = new Uint8Array(8);
      const dataView = new DataView(malformedMessage.buffer);
      dataView.setUint32(0, 4, true); // Claim 4 bytes
      malformedMessage.set([99, 1, 2, 3], 4); // Invalid message type 99

      await fuzzTarget.onSocketMessage(malformedMessage);

      assert.strictEqual(mockSender._closeCalled, 1);

      // Verify no handler methods were called
      assert.strictEqual(mockMessageHandler.getPeerInfo.mock.callCount(), 0);
      assert.strictEqual(mockMessageHandler.initialize.mock.callCount(), 0);
      assert.strictEqual(mockMessageHandler.importBlock.mock.callCount(), 0);
      assert.strictEqual(mockMessageHandler.getSerializedState.mock.callCount(), 0);
    });
  });

  // Helper methods
  function encode(message: Message): Uint8Array {
    return Encoder.encodeObject(messageCodec, message, spec).raw;
  }

  function decodeMessage(data: BytesBlob): Message {
    return Decoder.decodeObject(messageCodec, data, spec);
  }

  async function completeHandshake(
    mockMessageHandler: MockV1MessageHandler,
    mockSender: MockSender,
    fuzzTarget?: FuzzTarget,
  ): Promise<FuzzTarget> {
    const target = fuzzTarget ?? new FuzzTarget(mockMessageHandler, mockSender, spec);

    const inputPeerInfo = PeerInfo.create({
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
      name: "test-fuzzer",
    });

    const responsePeerInfo = PeerInfo.create({
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
      name: "test-target",
    });

    mockMessageHandler.getPeerInfo.mock.mockImplementation(async () => responsePeerInfo);

    const handshakeMessage: Message = {
      type: MessageType.PeerInfo,
      value: inputPeerInfo,
    };

    const testMessage = encode(handshakeMessage);
    await target.onSocketMessage(testMessage);

    return target;
  }
});
