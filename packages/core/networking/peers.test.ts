import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { ED25519_KEY_BYTES, type Ed25519Key } from "@typeberry/crypto";
import { OK } from "@typeberry/utils";
import { type Peer, type PeerAddress, type PeerId, Peers, type Stream, type StreamCallback } from "./peers.js";

// Test implementations
class TestStream implements Stream {
  readable = new ReadableStream<Uint8Array>();
  writable = new WritableStream<Uint8Array>();
  onError: ((e: unknown) => void)[] = [];

  constructor(public readonly streamId: number) {}

  addOnError(onError: (e: unknown) => void): void {
    this.onError.push(onError);
  }

  async destroy(): Promise<void> {
    // Mock implementation
  }
}

class TestPeer implements Peer {
  streamId = 0;

  constructor(
    public readonly connectionId: string,
    public readonly address: PeerAddress,
    public readonly id: PeerId,
    public readonly key: Ed25519Key,
  ) {}

  addOnIncomingStream(_streamCallback: StreamCallback): void {
    // Mock implementation
  }

  openStream(): Stream {
    return new TestStream(this.streamId++);
  }

  async disconnect(): Promise<void> {
    // Mock implementation
  }
}

function createTestPeer(id: string, host = "127.0.0.1", port = 8080): TestPeer {
  return new TestPeer(`conn-${id}`, { host, port }, id as PeerId, Bytes.zero(ED25519_KEY_BYTES).asOpaque());
}

describe("Peers", () => {
  it("should track peer connection status", () => {
    const peers = new Peers<TestPeer>();
    const peer = createTestPeer("test-peer-1");

    assert.strictEqual(peers.isConnected(peer.id), false);

    peers.peerConnected(peer);
    assert.strictEqual(peers.isConnected(peer.id), true);

    peers.peerDisconnected(peer);
    assert.strictEqual(peers.isConnected(peer.id), false);
  });

  it("should call connection callbacks", () => {
    const peers = new Peers<TestPeer>();
    const peer = createTestPeer("test-peer-2");
    let connectedCalled = false;
    let disconnectedCalled = false;

    peers.addOnPeerConnected(() => {
      connectedCalled = true;
      return OK;
    });

    peers.addOnPeerDisconnected(() => {
      disconnectedCalled = true;
      return OK;
    });

    peers.peerConnected(peer);
    assert.strictEqual(connectedCalled, true);

    peers.peerDisconnected(peer);
    assert.strictEqual(disconnectedCalled, true);
  });

  it("should handle multiple callbacks", () => {
    const peers = new Peers<TestPeer>();
    const peer = createTestPeer("test-peer-3");
    let callback1Called = false;
    let callback2Called = false;

    peers.addOnPeerConnected(() => {
      callback1Called = true;
      return OK;
    });

    peers.addOnPeerConnected(() => {
      callback2Called = true;
      return OK;
    });

    peers.peerConnected(peer);
    assert.strictEqual(callback1Called, true);
    assert.strictEqual(callback2Called, true);
  });

  it("should allow callback removal", () => {
    const peers = new Peers<TestPeer>();
    const peer = createTestPeer("test-peer-4");
    let callbackCalled = false;

    const removeCallback = peers.addOnPeerConnected(() => {
      callbackCalled = true;
      return OK;
    });

    removeCallback();
    peers.peerConnected(peer);
    assert.strictEqual(callbackCalled, false);
  });

  it("should replace existing peer with same ID", () => {
    const peers = new Peers<TestPeer>();
    const peer1 = createTestPeer("same-id", "127.0.0.1", 8080);
    const peer2 = createTestPeer("same-id", "127.0.0.1", 8081);

    peers.peerConnected(peer1);
    assert.strictEqual(peers.isConnected(peer1.id), true);

    peers.peerConnected(peer2);
    assert.strictEqual(peers.isConnected(peer2.id), true);
  });
});
