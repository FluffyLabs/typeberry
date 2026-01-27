import type { BytesBlob } from "@typeberry/bytes";
import { tryAsU8, type U8 } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";

/**
 * Globally unique stream identifier.
 *
 * Assigned during stream registration and used as the sole public
 * identifier for a stream throughout the protocol layer.
 */
export type StreamId = Opaque<string, "streamId">;

/** Cast a string as `StreamId`. Validates the `peerId:quicStreamId` format. */
export function tryAsStreamId(id: string): StreamId {
  const sep = id.lastIndexOf(":");
  const peerId = id.slice(0, sep);
  const quicStreamId = Number(id.slice(sep + 1));
  if (peerId.length === 0 || !Number.isInteger(quicStreamId) || quicStreamId < 0) {
    throw new Error(`Invalid StreamId: "${id}". Expected "peerId:quicStreamId".`);
  }
  return id as StreamId;
}

/** Unique stream kind. */
export type StreamKind<T extends U8 = U8> = T;
/** Try to cast the number as `StreamKind`. */
export function tryAsStreamKind<T extends number>(num: T): StreamKind<T & U8> {
  return tryAsU8(num) as T & U8;
}

/** Abstraction over sending messages tied to a particular stream. */
export interface StreamMessageSender {
  /** Globally unique stream identifier. */
  id: StreamId;

  /**
   * Send data blob to the other end.
   *
   * NOTE: in case the reader is slow, we might be dropping
   * messages. Check the result to know if the message was
   * sent/buffered correctly (`true`) or dropped (`false`)
   */
  bufferAndSend(data: BytesBlob, prefixWithLength?: boolean): boolean;

  /** Close the connection on our side (FIN). */
  close(): void;
}

/** Protocol handler for many streams of the same, given kind. */
export interface StreamHandler<TStreamKind extends StreamKind = StreamKind> {
  /** Kind of the stream */
  readonly kind: TStreamKind;

  /** Handle message for that particular stream kind. */
  onStreamMessage(streamSender: StreamMessageSender, message: BytesBlob): void;

  /** Handle closing of given stream. */
  onClose(streamId: StreamId, isError: boolean): void;
}

/** Extract the stream kind out of the the handler type. */
export type StreamKindOf<T extends StreamHandler> = T extends StreamHandler<infer TKind> ? TKind : never;
