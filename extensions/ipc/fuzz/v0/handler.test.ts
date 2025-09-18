import assert from "node:assert";
import { Socket } from "node:net";
import { describe, it, type Mock, mock } from "node:test";
import type { Block, HeaderHash, StateRootHash } from "@typeberry/block";
import { testBlockView } from "@typeberry/block/test-helpers.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { tryAsU8 } from "@typeberry/numbers";
import { IpcSender } from "../../server.js";
import { type FuzzMessageHandler, FuzzTarget } from "./handler.js";
import { KeyValue, type Message, MessageType, messageCodec, PeerInfo, SetState, Version } from "./types.js";

const spec = tinyChainSpec;

class MockMessageHandler implements FuzzMessageHandler {
  getSerializedState: Mock<(value: HeaderHash) => Promise<KeyValue[]>> = mock.fn();
  resetState: Mock<(value: SetState) => Promise<StateRootHash>> = mock.fn();
  importBlockV0: Mock<(value: Block) => Promise<StateRootHash>> = mock.fn();
  getPeerInfoV0: Mock<(value: PeerInfo) => Promise<PeerInfo>> = mock.fn();
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

describe("FuzzTarget Handler", () => {
  describe("onSocketMessage", () => {
    it("should handle PeerInfo message and respond correctly", async () => {
      const mockMessageHandler = new MockMessageHandler();
      const mockSender = new MockSender();

      const inputPeerInfo = PeerInfo.create({
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

      const responsePeerInfo = PeerInfo.create({
        name: "response-peer",
        appVersion: Version.create({
          major: tryAsU8(1),
          minor: tryAsU8(1),
          patch: tryAsU8(0),
        }),
        jamVersion: Version.create({
          major: tryAsU8(0),
          minor: tryAsU8(6),
          patch: tryAsU8(5),
        }),
      });

      const incomingMessage: Message = {
        type: MessageType.PeerInfo,
        value: inputPeerInfo,
      };

      const expectedResponse: Message = {
        type: MessageType.PeerInfo,
        value: responsePeerInfo,
      };

      // Mock the handler method
      mockMessageHandler.getPeerInfoV0.mock.mockImplementation(async () => responsePeerInfo);

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      const testMessage = Encoder.encodeObject(messageCodec, incomingMessage);

      await fuzzTarget.onSocketMessage(testMessage.raw);

      assert.deepStrictEqual(mockSender._sentData, [Encoder.encodeObject(messageCodec, expectedResponse)]);
      assert.strictEqual(mockSender._closeCalled, 0);
    });

    it("should handle GetState message and respond correctly", async () => {
      const mockMessageHandler = new MockMessageHandler();
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
      const testMessage = Encoder.encodeObject(messageCodec, incomingMessage);

      // when
      await fuzzTarget.onSocketMessage(testMessage.raw);

      // then
      assert.strictEqual(mockMessageHandler.getSerializedState.mock.callCount(), 1);
      assert.deepStrictEqual(mockMessageHandler.getSerializedState.mock.calls[0].arguments, [headerHash]);
      assert.deepStrictEqual(mockSender._sentData, [Encoder.encodeObject(messageCodec, expectedResponse)]);

      // Verify close was not called
      assert.strictEqual(mockSender._closeCalled, 0);
    });

    it("should handle ImportBlock message and respond correctly", async () => {
      const mockMessageHandler = new MockMessageHandler();
      const mockSender = new MockSender();

      const testBlock = testBlockView().materialize();
      const expectedStateRoot = Bytes.fill(32, 0xef).asOpaque<StateRootHash>();

      const incomingMessage: Message = {
        type: MessageType.ImportBlock,
        value: testBlock,
      };

      const expectedResponse: Message = {
        type: MessageType.StateRoot,
        value: expectedStateRoot,
      };

      mockMessageHandler.importBlockV0.mock.mockImplementation(async () => expectedStateRoot);

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      const testMessage = Encoder.encodeObject(messageCodec, incomingMessage, spec);

      // when
      await fuzzTarget.onSocketMessage(testMessage.raw);

      assert.strictEqual(mockMessageHandler.importBlockV0.mock.callCount(), 1);
      assert.deepStrictEqual(mockMessageHandler.importBlockV0.mock.calls[0].arguments, [testBlock]);

      assert.deepStrictEqual(mockSender._sentData, [Encoder.encodeObject(messageCodec, expectedResponse, spec)]);
      assert.strictEqual(mockSender._closeCalled, 0);
    });

    it("should handle SetState message and respond correctly", async () => {
      const mockMessageHandler = new MockMessageHandler();
      const mockSender = new MockSender();

      const testSetState = SetState.create({
        header: testBlockView().header.materialize(),
        state: [],
      });
      const expectedStateRoot = Bytes.fill(32, 0xab).asOpaque<StateRootHash>();
      const incomingMessage: Message = {
        type: MessageType.SetState,
        value: testSetState,
      };
      const expectedResponse: Message = {
        type: MessageType.StateRoot,
        value: expectedStateRoot,
      };

      mockMessageHandler.resetState.mock.mockImplementation(async () => expectedStateRoot);

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      const testMessage = Encoder.encodeObject(messageCodec, incomingMessage, spec);

      // when
      await fuzzTarget.onSocketMessage(testMessage.raw);

      assert.strictEqual(mockMessageHandler.resetState.mock.callCount(), 1);
      assert.deepStrictEqual(mockMessageHandler.resetState.mock.calls[0].arguments, [testSetState]);
      assert.deepStrictEqual(mockSender._sentData, [Encoder.encodeObject(messageCodec, expectedResponse, spec)]);
      assert.strictEqual(mockSender._closeCalled, 0);
    });

    it("should close connection when receiving unexpected State message", async () => {
      const mockMessageHandler = new MockMessageHandler();
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
      const testMessage = Encoder.encodeObject(messageCodec, incomingMessage);

      // when
      await fuzzTarget.onSocketMessage(testMessage.raw);

      assert.strictEqual(mockSender._closeCalled, 1);
      assert.deepStrictEqual(mockSender._sentData, []);

      // Should not call any handler methods
      assert.strictEqual(mockMessageHandler.getPeerInfoV0.mock.callCount(), 0);
      assert.strictEqual(mockMessageHandler.getSerializedState.mock.callCount(), 0);
      assert.strictEqual(mockMessageHandler.resetState.mock.callCount(), 0);
      assert.strictEqual(mockMessageHandler.importBlockV0.mock.callCount(), 0);
    });

    it("should close connection when receiving unexpected StateRoot message", async () => {
      const mockMessageHandler = new MockMessageHandler();
      const mockSender = new MockSender();

      const stateRoot = Bytes.fill(32, 0xcd).asOpaque<StateRootHash>();

      const incomingMessage: Message = {
        type: MessageType.StateRoot,
        value: stateRoot,
      };

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      const testMessage = Encoder.encodeObject(messageCodec, incomingMessage);

      // when
      await fuzzTarget.onSocketMessage(testMessage.raw);

      assert.strictEqual(mockSender._closeCalled, 1);
      assert.deepStrictEqual(mockSender._sentData, []);
    });

    it("should handle decoding error gracefully", () => {
      const mockMessageHandler = new MockMessageHandler();
      const mockSender = new MockSender();

      const fuzzTarget = new FuzzTarget(mockMessageHandler, mockSender, spec);
      const testMessage = new Uint8Array([99, 1, 2, 3]);

      assert.rejects(async () => {
        await fuzzTarget.onSocketMessage(testMessage);
      }, new Error("Unknown message type: 99"));

      // Verify no handler methods were called
      assert.strictEqual(mockMessageHandler.getPeerInfoV0.mock.callCount(), 0);
      assert.strictEqual(mockMessageHandler.getSerializedState.mock.callCount(), 0);
      assert.strictEqual(mockMessageHandler.resetState.mock.callCount(), 0);
      assert.strictEqual(mockMessageHandler.importBlockV0.mock.callCount(), 0);
    });
  });
});
