import assert from "node:assert";
import { describe, it } from "node:test";
import { OK } from "@typeberry/utils";
import { PeersManagement } from "./peers.js";
import { createDisconnectedPeer, type TestPeerDisconnected } from "./testing.js";

describe("Peers", () => {
  it("should track peer connection status", () => {
    const peers = new PeersManagement<TestPeerDisconnected>();
    const peer = createDisconnectedPeer("test-peer-1");

    assert.strictEqual(peers.isConnected(peer.id), false);
    assert.strictEqual(peers.noOfConnectedPeers(), 0);

    peers.peerConnected(peer);
    assert.strictEqual(peers.isConnected(peer.id), true);
    assert.strictEqual(peers.noOfConnectedPeers(), 1);

    peers.peerDisconnected(peer);
    assert.strictEqual(peers.isConnected(peer.id), false);
    assert.strictEqual(peers.noOfConnectedPeers(), 0);
  });

  it("should call connection callbacks", () => {
    const peers = new PeersManagement<TestPeerDisconnected>();
    const peer = createDisconnectedPeer("test-peer-2");
    let connectedCalled = false;
    let disconnectedCalled = false;

    peers.onPeerConnected(() => {
      connectedCalled = true;
      return OK;
    });

    peers.onPeerDisconnected(() => {
      disconnectedCalled = true;
      return OK;
    });
    assert.strictEqual(connectedCalled, false);
    peers.peerConnected(peer);
    assert.strictEqual(connectedCalled, true);

    assert.strictEqual(disconnectedCalled, false);
    peers.peerDisconnected(peer);
    assert.strictEqual(disconnectedCalled, true);
  });

  it("should handle multiple callbacks", () => {
    const peers = new PeersManagement<TestPeerDisconnected>();
    const peer = createDisconnectedPeer("test-peer-3");
    let callback1Called = false;
    let callback2Called = false;

    peers.onPeerConnected(() => {
      callback1Called = true;
      return OK;
    });

    peers.onPeerConnected(() => {
      callback2Called = true;
      return OK;
    });

    peers.peerConnected(peer);
    assert.strictEqual(callback1Called, true);
    assert.strictEqual(callback2Called, true);
  });

  it("should allow callback removal", () => {
    const peers = new PeersManagement<TestPeerDisconnected>();
    const peer = createDisconnectedPeer("test-peer-4");
    let callbackCalled = false;

    const removeCallback = peers.onPeerConnected(() => {
      callbackCalled = true;
      return OK;
    });

    removeCallback();
    peers.peerConnected(peer);
    assert.strictEqual(callbackCalled, false);
  });

  it("should replace existing peer with same ID", () => {
    const peers = new PeersManagement<TestPeerDisconnected>();
    const peer1 = createDisconnectedPeer("same-id", "127.0.0.1", 8080);
    const peer2 = createDisconnectedPeer("same-id", "127.0.0.1", 8081);

    assert.strictEqual(peers.isConnected(peer1.id), false);

    peers.peerConnected(peer1);
    assert.strictEqual(peers.isConnected(peer1.id), true);
    assert.strictEqual(peers.noOfConnectedPeers(), 1);

    // since the second peer has exactly the same id we
    // just replace the place info and assume it is still connected.
    peers.peerConnected(peer2);
    assert.strictEqual(peers.isConnected(peer1.id), true);
    assert.strictEqual(peers.isConnected(peer2.id), true);
    assert.strictEqual(peers.noOfConnectedPeers(), 1);
  });
});
