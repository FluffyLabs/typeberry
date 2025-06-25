import type { BytesBlob } from "@typeberry/bytes";
import { type U8, type U32, tryAsU8, tryAsU32 } from "@typeberry/numbers";
import type { OK } from "@typeberry/utils";

/** Unique stream identifier. */
export type StreamId = U32;
/** Try to cast the number as `StreamId`. */
export function tryAsStreamId(num: number): StreamId {
  return tryAsU32(num);
}

/** Unique stream kind. */
export type StreamKind = U8;
/** Try to cast the number as `StreamKind`. */
export function tryAsStreamKind(num: number): StreamKind {
  return tryAsU8(num);
}

/** Abstraction over sending messages tied to a particular stream. */
export interface StreamMessageSender {
  /** Stream Id information. */
  streamId: StreamId;

  /**
   * Send data blob to the other end.
   *
   * NOTE: in case the reader is slow, we might be dropping
   * messages. Check the result to know if the message was
   * sent/buffered correctly (`true`) or dropped (`false`)
   */
  bufferAndSend(data: BytesBlob): boolean;

  /** Close the connection on our side (FIN). */
  close(): void;
}

/** Protocol handler for many streams of the same, given kind. */
export interface StreamHandler<TStreamKind extends StreamKind = StreamKind> {
  /** Kind of the stream */
  readonly kind: TStreamKind;

  /** Handle message for that particular stream kind. */
  onStreamMessage(streamSender: StreamMessageSender, message: BytesBlob): void;

  /** Handle closing of given `streamId`. */
  onClose(streamId: StreamId, isError: boolean): void;
}

/** A helper to manager streams. */
export interface StreamManager {
  /** Re-use an existing stream of given kind if present. */
  withStreamOfKind<TStreamKind extends StreamKind, THandler extends StreamHandler<TStreamKind>>(
    streamKind: TStreamKind,
    work: (handler: THandler, sender: StreamMessageSender) => OK,
  ): void;

  /** Open a new stream of given kind. */
  withNewStream<TStreamKind extends StreamKind, THandler extends StreamHandler<TStreamKind>>(
    kind: TStreamKind,
    work: (handler: THandler, sender: StreamMessageSender) => OK,
  ): void;
}
