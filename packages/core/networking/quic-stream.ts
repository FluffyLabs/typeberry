import { errors, events, type QUICStream } from "@matrixai/quic";
import { type Stream, type StreamErrorCallback, StreamErrorKind } from "./peers.js";
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

  addOnError(onError: StreamErrorCallback): void {
    addEventListener(this.stream, events.EventQUICStreamError, (e) => {
      const isLocalClose =
        e.detail instanceof errors.ErrorQUICStreamLocalRead ||
        e.detail instanceof errors.ErrorQUICStreamLocalWrite ||
        e.detail instanceof errors.ErrorQUICConnectionLocal;

      const isRemoteClose = e.detail instanceof errors.ErrorQUICConnectionPeer;

      const kind = isLocalClose
        ? StreamErrorKind.LocalClose
        : isRemoteClose
          ? StreamErrorKind.RemoteClose
          : StreamErrorKind.Exception;

      onError(e.detail, kind);
    });
  }

  destroy(): Promise<void> {
    return this.stream.destroy();
  }
}
