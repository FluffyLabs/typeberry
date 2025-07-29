import { Bytes } from "@typeberry/bytes";
import { ED25519_KEY_BYTES, type Ed25519Key } from "@typeberry/crypto";
import type { Peer, PeerAddress, PeerId, Stream, StreamCallback } from "./peers.js";

// Test implementations
export class TestStream implements Stream {
  writable: WritableStream;
  readable: ReadableStream;

  _writtenData: Uint8Array[] = [];
  _incomingData: WritableStream;

  _simulateIncomingData(kindData: Uint8Array) {
    const writer = this._incomingData.getWriter();
    writer.write(kindData);
    writer.releaseLock();
  }

  onError: ((e: unknown) => void)[] = [];

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

  addOnError(onError: (e: unknown) => void): void {
    this.onError.push(onError);
  }

  async destroy(): Promise<void> {
    await this.writable.abort("destroying");
  }
}

export class TestPeer implements Peer {
  streamId = 0;

  _onIncomingStreams: StreamCallback[] = [];
  _openedStreams: TestStream[] = [];
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
    const stream = new TestStream(this.streamId++);
    this._openedStreams.push(stream);
    return stream;
  }

  async disconnect(): Promise<void> {
    this._disconnectCalled = true;
  }
}

export function createTestPeer(id: string, host = "127.0.0.1", port = 8080): TestPeer {
  return new TestPeer(`conn-${id}`, { host, port }, id as PeerId, Bytes.zero(ED25519_KEY_BYTES).asOpaque());
}
