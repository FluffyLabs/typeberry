import { type ReadableStream, WritableStream } from "node:stream/web";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { ED25519_KEY_BYTES, type Ed25519Key } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import { OK, asOpaqueType } from "@typeberry/utils";
import type { DialOptions, Network } from "./network.js";
import type { Peer, PeerAddress, PeerCallback, PeerId, Stream, StreamCallback, StreamErrorCallback } from "./peers.js";

const logger = Logger.new(import.meta.filename, "test:net");

/**
 * Stream implementation that allows manual control over
 * received and sent bytes.
 */
export class TestManualStream implements Stream {
  readonly writable: WritableStream;
  readonly readable: ReadableStream;

  readonly _writtenData: Uint8Array[] = [];
  readonly _incomingData: WritableStream;
  private readonly _onError: StreamErrorCallback[] = [];

  constructor(public readonly streamId: number) {
    // simulate incoming data stream
    const { writable, readable } = new TransformStream();
    this.readable = readable;
    this._incomingData = writable;

    // intercept outgoing data
    const _writtenData = this._writtenData;
    this.writable = new WritableStream({
      write(chunk) {
        _writtenData.push(chunk);
      },
    });
  }

  addOnError(onError: StreamErrorCallback): void {
    this._onError.push(onError);
  }

  async destroy(): Promise<void> {
    await this.writable.abort("destroying");
  }

  _simulateIncomingData(kindData: Uint8Array) {
    const writer = this._incomingData.getWriter();
    writer.write(kindData);
    writer.releaseLock();
  }
}

export class TestDuplexStream implements Stream {
  static pair(id: number) {
    const id1 = id;
    const id2 = id + 1_000_000;

    const { writable: w1, readable: r1 } = new TransformStream({
      transform(chunk, ctrl) {
        logger.trace(`[${id}] <-- [${id2}] ${BytesBlob.blobFrom(chunk)}`);
        ctrl.enqueue(chunk);
      },
    });
    const { writable: w2, readable: r2 } = new TransformStream({
      transform(chunk, ctrl) {
        logger.trace(`[${id}] --> [${id2}] ${BytesBlob.blobFrom(chunk)}`);
        ctrl.enqueue(chunk);
      },
    });

    return [new TestDuplexStream(id1, r1, w2), new TestDuplexStream(id2, r2, w1)] as const;
  }

  _onError: StreamErrorCallback[] = [];

  addOnError(onError: StreamErrorCallback): void {
    this._onError.push(onError);
  }

  constructor(
    public readonly streamId: number,
    public readonly readable: ReadableStream,
    public readonly writable: WritableStream,
  ) {}

  async destroy(): Promise<void> {}
}

/**
 * A representation of some remote peer, that's actually
 * coupled with another instance of `TestPeer`.
 *
 * This allows us to have two peers connected together,
 * so that when one opens a stream, the other one
 * receives a callback about new stream being opened, etc.
 */
export class TestPeer implements Peer {
  static pairUp(a: TestPeer, b: TestPeer) {
    a._otherPeer = b;
    b._otherPeer = a;

    return [a, b] as const;
  }

  private readonly _onIncomingStreams: StreamCallback[] = [];
  private _otherPeer: TestPeer | null = null;

  constructor(
    public _streamId: number,
    public readonly connectionId: string,
    public readonly address: PeerAddress,
    public readonly id: PeerId,
    public readonly key: Ed25519Key,
  ) {
    this.addOnIncomingStream((stream) => {
      logger.log(`[${this.id}] incoming stream: ${stream.streamId}: ${this._onIncomingStreams.length} listeners`);
      return OK;
    });
  }

  addOnIncomingStream(streamCallback: StreamCallback): void {
    this._onIncomingStreams.push(streamCallback);
  }

  openStream(): Stream {
    const streamId = this._streamId++;
    const [txStream, rxStream] = TestDuplexStream.pair(streamId);
    logger.log(
      `[peer:${this.id}] --> [peer:${this._otherPeer?.id}] opening streams ${txStream.streamId} -> ${rxStream.streamId}`,
    );
    // Allow the "virtual" connection to be full estabilished,
    // before triggering the callbacks. We currently assume
    // this happens synchronously, but if that causes issues
    // we may also trigger that manually.
    setImmediate(() => {
      for (const cb of this._otherPeer?._onIncomingStreams ?? []) {
        cb(rxStream);
      }
    });
    return txStream;
  }

  async disconnect(): Promise<void> {}
}

export class TestPeerDisconnected implements Peer {
  _streamId = 0;

  private readonly _onIncomingStreams: StreamCallback[] = [];
  readonly _openedStreams: TestManualStream[] = [];
  _disconnectCalled = false;

  constructor(
    public readonly connectionId: string,
    public readonly address: PeerAddress,
    public readonly id: PeerId,
    public readonly key: Ed25519Key,
  ) {}

  addOnIncomingStream(streamCallback: StreamCallback): void {
    this._onIncomingStreams.push(streamCallback);
  }

  openStream(): Stream {
    const stream = new TestManualStream(this._streamId++);
    this._openedStreams.push(stream);
    return stream;
  }

  async disconnect(): Promise<void> {
    this._disconnectCalled = true;
  }
}

/**
 * Create a standalone test peer, that allows fine-grained control over the received
 * and sent data.
 */
export function createDisconnectedPeer(id: string, host = "127.0.0.1", port = 8080): TestPeerDisconnected {
  return new TestPeerDisconnected(
    `conn-${id}`,
    { host, port },
    asOpaqueType(id),
    Bytes.zero(ED25519_KEY_BYTES).asOpaque(),
  );
}

/**
 * Creates two peer objects that are interconnected - sending data
 * over `writable` of one peer, will cause it to be receied on
 * `readable` on the other peer and vice-versa.
 */
export function createTestPeerPair(streamIdx: number, id1: string, id2: string) {
  const host = "127.0.0.1";
  const port = 8080;
  const key = Bytes.zero(ED25519_KEY_BYTES).asOpaque();

  return TestPeer.pairUp(
    new TestPeer(streamIdx, `conn-${id1}-${id2}`, { host, port }, asOpaqueType(id1), key),
    new TestPeer(streamIdx + 10_000, `conn-${id1}-${id2}`, { host, port }, asOpaqueType(id2), key),
  );
}

/**
 * Mock Network implementation for testing
 * Provides controlled peer connection/disconnection simulation
 */
export class MockNetwork implements Network<Peer> {
  private readonly _onConnectCallback: PeerCallback<Peer>[] = [];
  private readonly _onDisconnectCallback: PeerCallback<Peer>[] = [];

  constructor(public readonly name: string) {
    this.onPeerConnect((peer) => {
      logger.log(
        `(network: ${this.name}) New peer connected: ${peer.id}. ${this._onConnectCallback.length} listeners.`,
      );
      return OK;
    });
    this.onPeerDisconnect((peer) => {
      logger.log(
        `(network: ${this.name}) Peer disconnected: ${peer.id}. ${this._onDisconnectCallback.length} listeners.`,
      );
      return OK;
    });
  }

  async start(): Promise<void> {
    // Mock implementation
  }

  async stop(): Promise<void> {
    // Mock implementation
  }

  onPeerConnect(callback: PeerCallback<Peer>) {
    this._onConnectCallback.push(callback);
  }

  onPeerDisconnect(callback: PeerCallback<Peer>) {
    this._onDisconnectCallback.push(callback);
  }

  async dial(address: PeerAddress, _options: DialOptions): Promise<Peer> {
    const peer = createDisconnectedPeer(address.host);
    this._simulatePeerConnect(peer);
    return peer;
  }

  _simulatePeerConnect(peer: Peer) {
    for (const callback of this._onConnectCallback) {
      callback(peer);
    }
  }

  _simulatePeerDisconnect(peer: Peer) {
    for (const callback of this._onDisconnectCallback) {
      callback(peer);
    }
  }
}
