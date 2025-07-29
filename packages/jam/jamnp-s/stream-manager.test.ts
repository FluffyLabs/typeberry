import assert from "node:assert";
import { describe, it } from "node:test";
import type { BytesBlob } from "@typeberry/bytes";
import { TestStream, createTestPeer } from "@typeberry/networking/testing.js";
import { OK } from "@typeberry/utils";
import type { StreamHandler, StreamId, StreamKind, StreamMessageSender } from "./protocol/stream.js";
import { StreamManager } from "./stream-manager.js";

// Test StreamHandler implementation
class TestStreamHandler implements StreamHandler {
  messages: Array<{ streamSender: StreamMessageSender; message: BytesBlob }> = [];
  closeCalls: Array<{ streamId: StreamId; isError: boolean }> = [];

  constructor(public readonly kind: StreamKind) {}

  onStreamMessage(streamSender: StreamMessageSender, message: BytesBlob): void {
    this.messages.push({ streamSender, message });
  }

  onClose(streamId: StreamId, isError: boolean): void {
    this.closeCalls.push({ streamId, isError });
  }
}

function createTestHandler(kind: StreamKind): TestStreamHandler {
  return new TestStreamHandler(kind);
}

describe("StreamManager", () => {
  describe("stream management", () => {
    it("should return null for unknown stream ID", () => {
      const manager = new StreamManager();

      const peer = manager.getPeer(123 as StreamId);

      assert.strictEqual(peer, null);
    });

    it("should open new stream and call work function", async () => {
      const manager = new StreamManager();
      const peer = createTestPeer("peer1");
      const handler = createTestHandler(1 as StreamKind);
      manager.registerOutgoingHandlers(handler);

      let workCalled = false;
      let senderFlush: Promise<void> = Promise.resolve();
      manager.withNewStream(peer, 1 as StreamKind, (h, sender) => {
        workCalled = true;
        assert.strictEqual(h, handler);
        assert.strictEqual(typeof sender.streamId, "number");
        senderFlush = sender.flush();
        return OK;
      });

      assert.strictEqual(workCalled, true);
      assert.strictEqual(peer._openedStreams.length, 1);

      await senderFlush;
      // Check that stream kind was sent
      const stream = peer._openedStreams[0];
      const written = stream._writtenData;
      assert.strictEqual(written.length, 1);
      assert.deepStrictEqual(written[0], new Uint8Array([1]));
    });

    it("should throw error for unsupported outgoing stream kind", () => {
      const manager = new StreamManager();
      const peer = createTestPeer("peer1");

      assert.throws(() => {
        manager.withNewStream(peer, 99 as StreamKind, () => OK);
      }, /Unsupported outgoing stream kind: 99/);
    });

    it("should find existing stream of given kind", () => {
      const manager = new StreamManager();
      const peer = createTestPeer("peer1");
      const handler = createTestHandler(1 as StreamKind);
      manager.registerOutgoingHandlers(handler);

      // Open a stream first
      manager.withNewStream(peer, 1 as StreamKind, () => OK);

      // Now try to find it
      let foundStream = false;
      manager.withStreamOfKind(peer.id, 1 as StreamKind, (h) => {
        foundStream = true;
        assert.strictEqual(h, handler);
        return OK;
      });

      assert.strictEqual(foundStream, true);
    });

    it("should not call work function if stream kind not found", () => {
      const manager = new StreamManager();
      const peer = createTestPeer("peer1");

      let workCalled = false;
      manager.withStreamOfKind(peer.id, 1 as StreamKind, () => {
        workCalled = true;
        return OK;
      });

      assert.strictEqual(workCalled, false);
    });
  });

  describe("incoming streams", () => {
    it("should handle incoming stream with valid kind", async () => {
      const manager = new StreamManager();
      const peer = createTestPeer("peer1");
      const handler = createTestHandler(1 as StreamKind);
      manager.registerIncomingHandlers(handler);

      const stream = new TestStream(42);

      // Simulate incoming stream with kind byte
      const kindData = new Uint8Array([1, 0x41, 0x42]); // kind=1, followed by some data
      stream._simulateIncomingData(kindData);
      stream._incomingData.close();

      await manager.onIncomingStream(peer, stream);

      // Check that peer is tracked
      const retrievedPeer = manager.getPeer(42 as StreamId);
      assert.strictEqual(retrievedPeer, peer);
    });

    it("should throw error for stream without kind byte", async () => {
      const manager = new StreamManager();
      const peer = createTestPeer("peer1");
      const stream = new TestStream(42);

      // Simulate empty stream
      stream._incomingData.close();

      await assert.rejects(() => manager.onIncomingStream(peer, stream), /Expected 1-byte stream identifier/);
    });

    it("should throw error for unsupported incoming stream kind", async () => {
      const manager = new StreamManager();
      const peer = createTestPeer("peer2");
      const stream = new TestStream(42);

      // Simulate incoming stream with unsupported kind
      stream._simulateIncomingData(new Uint8Array([99])); // unsupported kind
      stream._incomingData.close();

      await assert.rejects(() => manager.onIncomingStream(peer, stream), /Unsupported stream kind: 99/);
    });
  });

  describe("message handling", () => {
    it("should handle fragmented messages", async () => {
      const manager = new StreamManager();
      const peer = createTestPeer("peer3");
      const handler = createTestHandler(1 as StreamKind);
      manager.registerIncomingHandlers(handler);

      const stream = new TestStream(42);

      // Send initial kind byte
      stream._simulateIncomingData(new Uint8Array([1]));

      // Start handling the stream
      const handlePromise = manager.onIncomingStream(peer, stream);

      // Send a complete message with length prefix
      const message = new Uint8Array([0x41, 0x42, 0x43]);
      const lengthPrefix = new Uint8Array([3, 0, 0, 0]); // length = 3
      stream._simulateIncomingData(new Uint8Array([...lengthPrefix, ...message]));

      // Close the stream
      stream._incomingData.close();

      await handlePromise;
      await manager.waitForFinish();

      // Check that handler received the message
      assert.strictEqual(handler.messages.length, 1);
      assert.deepStrictEqual(handler.messages[0].message.raw, message);
    });
  });

  describe("error handling", () => {
    it("should handle stream errors and disconnect peer", async () => {
      const manager = new StreamManager();
      const peer = createTestPeer("peer2");
      const handler = createTestHandler(1 as StreamKind);
      manager.registerIncomingHandlers(handler);

      const stream = new TestStream(42);

      // Send initial kind byte
      stream._simulateIncomingData(new Uint8Array([1]));

      // Start handling the stream
      await manager.onIncomingStream(peer, stream);

      // Simulate stream error
      await stream._incomingData.abort(new Error("Test error"));

      // Check that peer was disconnected
      assert.strictEqual(peer._disconnectCalled, true);

      // Check that handler's onClose was called with error=true
      assert.strictEqual(handler.closeCalls.length, 1);
      assert.strictEqual(handler.closeCalls[0].isError, true);
    });
  });

  describe("lifecycle", () => {
    it("should wait for all streams to finish", async () => {
      const manager = new StreamManager();
      const peer = createTestPeer("1");
      const handler = createTestHandler(1 as StreamKind);
      manager.registerIncomingHandlers(handler);

      const stream1 = new TestStream(42);
      const stream2 = new TestStream(43);

      // Start handling both streams
      stream1._simulateIncomingData(new Uint8Array([1]));
      stream2._simulateIncomingData(new Uint8Array([1]));

      // Close streams immediately
      stream1._incomingData.close();
      stream2._incomingData.close();

      const handle1 = manager.onIncomingStream(peer, stream1);
      const handle2 = manager.onIncomingStream(peer, stream2);

      await Promise.all([handle1, handle2]);
      await manager.waitForFinish();

      // If we reach here, waitForFinish worked correctly
      assert.ok(true);
    });
  });
});
