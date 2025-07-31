import { events, type QUICStream } from "@matrixai/quic";
import type { Stream } from "./peers.js";
import { addEventListener } from "./quic-utils.js";

/** `QUICStream` adapter for our `Stream` API. */
export class QuicStream implements Stream {
  constructor(public readonly stream: QUICStream) {}

  get streamId() {
    return this.stream.streamId;
  }

  get readable() {
    return this.stream.readable;
  }

  get writable() {
    return this.stream.writable;
  }

  addOnError(onError: (e: unknown) => void): void {
    addEventListener(this.stream, events.EventQUICStreamError, (e) => {
      onError(e.detail);
    });
  }

  destroy(): Promise<void> {
    return this.stream.destroy();
  }
}
