import { events, type QUICStream } from "@matrixai/quic";
import {
  ErrorQUICConnectionLocal,
  ErrorQUICConnectionPeer,
  ErrorQUICStreamLocalRead,
  ErrorQUICStreamLocalWrite,
} from "@matrixai/quic/errors.js";
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
        e.detail instanceof ErrorQUICStreamLocalRead ||
        e.detail instanceof ErrorQUICStreamLocalWrite ||
        e.detail instanceof ErrorQUICConnectionLocal;

      const isRemoteClose = e.detail instanceof ErrorQUICConnectionPeer;

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
